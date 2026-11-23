import { Request, Response } from 'express';

import { Get, Controller, Res, Req, Param, Logger, ParseUUIDPipe, HttpException, All, Query } from '@nestjs/common';
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

    @All([':shortUuid/amneziawg/devices', ':shortUuid/amneziawg/devices/:deviceUuid'])
    async devices(
        @ResolvedShortUuid() resolvedShortUuid: string | undefined | null,
        @Param('shortUuid') shortUuid: string,
        @Param('deviceUuid') deviceUuid: string | undefined,
        @Req() request: Request,
        @Res() response: Response,
    ) {
        if (!['GET', 'POST', 'DELETE'].includes(request.method)) throw new HttpException('Method unavailable', 405);
        if (deviceUuid && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceUuid))
            throw new HttpException('Invalid device', 400);
        try {
            const result = await this.axiosService.axiosInstance.request({
                url: `/api/amneziawg/subscriptions/${encodeURIComponent(resolvedShortUuid ?? shortUuid)}/devices${deviceUuid ? '/' + deviceUuid : ''}`,
                method: request.method,
                data: request.method === 'POST' ? { name: request.body?.name } : undefined,
                timeout: 60_000,
            });
            return response.set('Cache-Control', 'no-store').status(result.status).json(result.data);
        } catch (error) {
            const status = error instanceof AxiosError ? error.response?.status : undefined;
            throw new HttpException('AmneziaWG device operation failed', status && [400, 404, 409].includes(status) ? status : 502);
        }
    }

    @Get(':shortUuid/:vpnProtocol/:uuid')
    async vpnProfile(
        @ResolvedShortUuid() resolvedShortUuid: string | undefined | null,
        @Param('shortUuid') shortUuid: string,
        @Param('uuid', new ParseUUIDPipe()) uuid: string,
        @Param('vpnProtocol') vpnProtocol: string,
        @Query('device') device: string | undefined,
        @Res() response: Response,
    ) {
        if (!['openvpn', 'amneziawg'].includes(vpnProtocol)) throw new HttpException('Profile unavailable', 404);
        if (device && device !== 'default' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(device))
            throw new HttpException('Invalid device', 400);
        const extension = vpnProtocol === 'openvpn' ? 'ovpn' : 'conf';
        try {
            const path = `/api/${vpnProtocol}/subscriptions/${encodeURIComponent(resolvedShortUuid ?? shortUuid)}`;
            const [profile, metadata, devices] = await Promise.all([
                this.axiosService.axiosInstance.get<string>(`${path}/${uuid}.${extension}`, {
                    responseType: 'text', timeout: 30_000, params: { device },
                }),
                this.axiosService.axiosInstance.get<{
                    response: { uuid: string; name: string }[];
                }>(path, { timeout: 30_000 }),
                vpnProtocol === 'amneziawg' && device && device !== 'default'
                    ? this.axiosService.axiosInstance.get<{ response: { uuid: string; name: string }[] }>(`${path}/devices`, { timeout: 30_000 })
                    : undefined,
            ]);
            const endpoint = metadata.data.response.find((item) => item.uuid === uuid);
            if (!endpoint) throw new HttpException('VPN profile unavailable', 404);
            const deviceName = devices?.data.response.find((item) => item.uuid === device)?.name;
            const name = (deviceName ? `${endpoint.name} (${deviceName})` : endpoint.name)
                .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/gu, ' ')
                .replace(/\s+/gu, ' ')
                .trim() || (vpnProtocol === 'openvpn' ? 'OpenVPN' : 'AmneziaWG');
            return response
                .attachment(`${name}.${extension}`)
                .type(vpnProtocol === 'openvpn' ? 'application/x-openvpn-profile' : 'text/plain')
                .set('Cache-Control', 'no-store')
                .send(vpnProtocol === 'amneziawg' ? profile.data : [
                    `# OVPN_ACCESS_SERVER_PROFILE=${name}`,
                    `# OVPN_ACCESS_SERVER_FRIENDLY_NAME=${name}`,
                    profile.data,
                ].join('\n'));
        } catch (error) {
            if (error instanceof HttpException) throw error;
            const status = error instanceof AxiosError ? error.response?.status : undefined;
            throw new HttpException('VPN profile unavailable', status === 404 ? 404 : 502);
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
