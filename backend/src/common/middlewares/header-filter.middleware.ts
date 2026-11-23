import { Request, Response, NextFunction } from 'express';

import { IGNORED_HEADERS } from '@common/constants';

export function headerFilterMiddleware(req: Request, _res: Response, next: NextFunction) {
    for (const key of Object.keys(req.headers)) {
        // Request parsers need the HTTP framing headers to read a JSON body.
        if (key === 'content-length' || key === 'transfer-encoding') continue;
        if (IGNORED_HEADERS.has(key)) {
            delete req.headers[key];
        }
    }

    if (!req.headers['user-agent']) {
        req.socket?.destroy();
        return;
    }

    next();
}
