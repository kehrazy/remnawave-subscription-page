import { Request, Response } from 'express';

import { Get, Controller, Res, Req, Param, Logger, ParseUUIDPipe, HttpException } from '@nestjs/common';
import { AxiosError } from 'axios';

import { AxiosService } from '@common/axios/axios.service';

import { TRequestTemplateTypeKeys } from '@remnawave/backend-contract';

import { ClientIp } from '@common/decorators/get-ip';
import { ResolvedShortUuid } from '@common/decorators/get-resolved-short-uuid';
import { IsBrowser } from '@common/decorators/is-browser';

import { WebpageService } from '@modules/webpage/webpage.service';

import { SubscriptionService } from './subscription.service';

@Controller()
export class SubscriptionController {
    private readonly logger = new Logger(SubscriptionController.name);

    constructor(
        private readonly subscriptionService: SubscriptionService,
        private readonly webpageService: WebpageService,
        private readonly axiosService: AxiosService,
    ) {}

    @Get(':shortUuid/openvpn/:uuid')
    async openVpnProfile(
        @ResolvedShortUuid() resolvedShortUuid: string | undefined | null,
        @Param('shortUuid') shortUuid: string,
        @Param('uuid', new ParseUUIDPipe()) uuid: string,
        @Res() response: Response,
    ) {
        try {
            const path = `/api/openvpn/subscriptions/${encodeURIComponent(resolvedShortUuid ?? shortUuid)}`;
            const [profile, metadata] = await Promise.all([
                this.axiosService.axiosInstance.get<string>(`${path}/${uuid}.ovpn`, {
                    responseType: 'text', timeout: 30_000,
                }),
                this.axiosService.axiosInstance.get<{
                    response: { uuid: string; name: string }[];
                }>(path, { timeout: 30_000 }),
            ]);
            const endpoint = metadata.data.response.find((item) => item.uuid === uuid);
            if (!endpoint) throw new HttpException('OpenVPN profile unavailable', 404);
            const name = endpoint.name
                .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/gu, ' ')
                .replace(/\s+/gu, ' ')
                .trim() || 'OpenVPN';
            return response
                .attachment(`${name}.ovpn`)
                .type('application/x-openvpn-profile')
                .set('Cache-Control', 'no-store')
                .send([
                    `# OVPN_ACCESS_SERVER_PROFILE=${name}`,
                    `# OVPN_ACCESS_SERVER_FRIENDLY_NAME=${name}`,
                    profile.data,
                ].join('\n'));
        } catch (error) {
            if (error instanceof HttpException) throw error;
            const status = error instanceof AxiosError ? error.response?.status : undefined;
            throw new HttpException('OpenVPN profile unavailable', status === 404 ? 404 : 502);
        }
    }

    @Get([':shortUuid', ':shortUuid/:clientType'])
    async root(
        @ClientIp() clientIp: string,
        @ResolvedShortUuid() resolvedShortUuid: string | undefined | null,
        @Req() request: Request,
        @Res() response: Response,
        @Param('shortUuid') shortUuid: string,
        @Param('clientType') clientType: string,
        @IsBrowser() isBrowser: boolean,
    ) {
        if (isBrowser) {
            return this.webpageService.serveWebpage(
                clientIp,
                request,
                response,
                resolvedShortUuid ?? shortUuid,
            );
        }

        return this.subscriptionService.serveSubscriptionPage(
            clientIp,
            request,
            response,
            resolvedShortUuid ?? shortUuid,
            clientType ? (clientType as TRequestTemplateTypeKeys) : undefined,
        );
    }
}
