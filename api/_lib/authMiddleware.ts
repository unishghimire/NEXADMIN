import type { VercelRequest, VercelResponse } from './types';
import { adminAuth, adminDb } from './firebaseAdmin';
import { DecodedIdToken } from 'firebase-admin/auth';
import { checkRateLimit } from './rateLimiter';

export interface AdminContext {
    uid: string;
    email: string;
    role: string;
    decodedToken: DecodedIdToken;
}

export async function requireAdmin(
    req: VercelRequest,
    res: VercelResponse
): Promise<AdminContext | null> {
    // 1. Rate limiting by IP
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const rateLimit = checkRateLimit(`ip:${clientIp}`, 120, 60 * 1000);
    
    res.setHeader('X-RateLimit-Limit', '120');
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetTime / 1000).toString());

    if (!rateLimit.allowed) {
        res.status(429).json({
            success: false,
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please wait before retrying.'
        });
        return null;
    }

    // 2. Extract Bearer token
    const rawAuth = req.headers.authorization;
    const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : (rawAuth || '');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Authentication required. Missing or malformed Bearer token.'
        });
        return null;
    }

    const idToken = authHeader.split('Bearer ')[1].trim();
    if (!idToken) {
        res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Authentication required. Token is empty.'
        });
        return null;
    }

    // 3. Verify Firebase ID Token
    let decodedToken: DecodedIdToken;
    try {
        decodedToken = await adminAuth.verifyIdToken(idToken, true);
    } catch (tokenErr: any) {
        console.warn('Authentication failed - invalid or expired token:', tokenErr?.code || tokenErr?.message);
        res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: tokenErr?.code === 'auth/id-token-expired'
                ? 'Session expired. Please sign in again.'
                : 'Invalid authentication token.'
        });
        return null;
    }

    const uid = decodedToken.uid;
    const email = decodedToken.email || '';

    // 4. Authoritative Admin Role Verification
    // Check Custom Claims first (primary source of truth)
    const hasAdminClaim = decodedToken.role === 'admin';

    if (hasAdminClaim) {
        return { uid, email, role: 'admin', decodedToken };
    }

    // Fallback: Check Firestore document users/{uid}
    try {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (userDoc.exists && userDoc.data()?.role === 'admin') {
            // Automatically promote custom claims if not set yet for faster future checks
            adminAuth.setCustomUserClaims(uid, { role: 'admin' }).catch(() => {});
            return { uid, email, role: 'admin', decodedToken };
        }
    } catch (dbErr) {
        console.error('Failed to verify admin status in Firestore:', dbErr);
    }

    // Access Denied: User is authenticated (e.g. as Player or Organizer), but is NOT an Administrator
    console.warn(`SECURITY ALERT: Non-admin user attempted to access Admin API. UID: ${uid}, Email: ${email}`);
    res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied. Administrative privileges are strictly required.'
    });
    return null;
}
