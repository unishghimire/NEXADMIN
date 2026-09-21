interface RateLimitEntry {
    count: number;
    resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
        if (now > entry.resetTime) {
            rateLimitMap.delete(key);
        }
    }
}, 5 * 60 * 1000);

export function checkRateLimit(identifier: string, maxRequests: number = 60, windowMs: number = 60 * 1000): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = rateLimitMap.get(identifier);

    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
        return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
    }

    if (entry.count >= maxRequests) {
        return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    entry.count += 1;
    return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
}
