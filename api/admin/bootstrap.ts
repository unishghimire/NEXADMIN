import type { VercelRequest, VercelResponse } from '../_lib/types';
import { adminAuth, adminDb } from '../_lib/firebaseAdmin';
import { logAuditEvent } from '../_lib/auditLogger';
import { checkRateLimit } from '../_lib/rateLimiter';
import { isValidId, getHeaderString } from '../_lib/validation';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const clientIp = getHeaderString(req.headers['x-forwarded-for']).split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const rateLimit = checkRateLimit(`bootstrap:${clientIp}`, 5, 15 * 60 * 1000); // 5 attempts per 15 min

    if (!rateLimit.allowed) {
        return res.status(429).json({ success: false, error: 'Too Many Requests' });
    }

    const bootstrapKey = getHeaderString(req.headers['x-bootstrap-key']);
    const expectedKey = process.env.ADMIN_BOOTSTRAP_KEY;

    if (!expectedKey || !bootstrapKey || bootstrapKey !== expectedKey) {
        console.warn(`Failed bootstrap attempt from IP ${clientIp}`);
        return res.status(401).json({ success: false, error: 'Unauthorized. Invalid or unconfigured bootstrap key.' });
    }

    const { userId, email } = req.body || {};

    try {
        let targetUid = userId;

        if (!targetUid && email) {
            const userRecord = await adminAuth.getUserByEmail(email);
            targetUid = userRecord.uid;
        }

        if (!isValidId(targetUid)) {
            return res.status(400).json({ success: false, error: 'Valid userId or email required' });
        }

        // Set admin custom claims
        await adminAuth.setCustomUserClaims(targetUid, { role: 'admin' });

        // Update Firestore profile
        await adminDb.collection('users').doc(targetUid).set({
            role: 'admin',
            updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        await adminDb.collection('users_public').doc(targetUid).set({
            role: 'admin',
            updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        // Write immutable audit log
        await logAuditEvent({
            adminId: 'SYSTEM_BOOTSTRAP',
            adminEmail: 'bootstrap@nexplay.gg',
            action: 'ADMIN_BOOTSTRAP_EXECUTED',
            resource: 'system',
            targetId: targetUid,
            details: { targetUid, email },
            ip: clientIp,
            userAgent: getHeaderString(req.headers['user-agent'])
        });

        return res.status(200).json({
            success: true,
            message: `Admin privileges successfully bootstrapped for user ${targetUid}`,
            userId: targetUid
        });
    } catch (err: any) {
        console.error('Error during admin bootstrap:', err);
        return res.status(500).json({ success: false, error: 'Bootstrap failed', message: err?.message });
    }
}
