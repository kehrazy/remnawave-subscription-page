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
            const profile = await this.axiosService.axiosInstance.get<string>(
                `/api/openvpn/subscriptions/${encodeURIComponent(resolvedShortUuid ?? shortUuid)}/${uuid}.ovpn`,
                { responseType: 'text', timeout: 30_000 },
            );
            return response.set({
                'Cache-Control': 'no-store',
                'Content-Type': 'application/x-openvpn-profile',
                'Content-Disposition': `attachment; filename="openvpn-${uuid}.ovpn"`,
            }).send(profile.data);
        } catch (error) {
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
