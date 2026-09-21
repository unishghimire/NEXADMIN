export function isValidId(id: any): boolean {
    return typeof id === 'string' && id.trim().length > 0 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
}

export function isNonEmptyString(val: any, maxLen: number = 500): boolean {
    return typeof val === 'string' && val.trim().length > 0 && val.length <= maxLen;
}

export function isPositiveNumber(val: any): boolean {
    return typeof val === 'number' && !isNaN(val) && val > 0 && isFinite(val);
}

export function isNonNegativeNumber(val: any): boolean {
    return typeof val === 'number' && !isNaN(val) && val >= 0 && isFinite(val);
}

export function isValidRole(role: any): boolean {
    return role === 'player' || role === 'organizer' || role === 'admin';
}

export function sanitizeString(val: any): string {
    if (typeof val !== 'string') return '';
    return val.trim().replace(/[<>]/g, '');
}

export function getHeaderString(header: string | string[] | undefined, defaultVal: string = ''): string {
    if (!header) return defaultVal;
    return (Array.isArray(header) ? header[0] : header) || defaultVal;
}
