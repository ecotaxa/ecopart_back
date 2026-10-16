import { NextFunction, Request, Response } from 'express';

export interface AttemptLimitOptions {
    max: number;
    window_ms: number;
    // The counter a request belongs to, or null to let it through uncounted (e.g. no e-mail: validation answers).
    key: (req: Request) => string | null;
    now?: () => number;
}

// Fixed-window counter kept in memory: the API runs as a single process, and a restart only resets the counts.
// Requests are counted per target e-mail rather than per IP address: behind the reverse proxy that serves /api,
// every request may carry the proxy's address, and an IP limit would then throttle all users at once.
export function limitAttempts(options: AttemptLimitOptions) {
    const now = options.now ?? Date.now;
    const windows = new Map<string, { count: number; reset_at: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
        const key = options.key(req);
        if (key === null) return next();

        const current = now();
        // Expired windows are dropped once the map grows, so it never keeps every e-mail ever seen.
        if (windows.size > 10000) {
            for (const [k, w] of windows) if (w.reset_at <= current) windows.delete(k);
        }

        let window = windows.get(key);
        if (!window || window.reset_at <= current) {
            window = { count: 0, reset_at: current + options.window_ms };
            windows.set(key, window);
        }
        window.count++;

        if (window.count > options.max) {
            res.setHeader('Retry-After', Math.ceil((window.reset_at - current) / 1000).toString());
            return res.status(429).send({ errors: ["Too many attempts, please try again later"] });
        }
        next();
    };
}

// The e-mail of the request body, normalised so that case and spaces do not open new counters.
export function bodyEmail(req: Request): string | null {
    const email = req.body?.email;
    return typeof email === 'string' && email.trim() !== '' ? email.trim().toLowerCase() : null;
}
