import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { adminAuth, adminDb } from '../_lib/firebaseAdmin';
import { logAuditEvent } from '../_lib/auditLogger';
import { isValidId, isValidRole, getHeaderString } from '../_lib/validation';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { userId, role } = req.body || {};

    if (!isValidId(userId)) {
        return res.status(400).json({ success: false, error: 'Invalid userId' });
    }

    if (!isValidRole(role)) {
        return res.status(400).json({ success: false, error: 'Invalid role. Must be player, organizer, or admin.' });
    }

    const clientIp = getHeaderString(req.headers['x-forwarded-for']).split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = getHeaderString(req.headers['user-agent']);

    try {
        // Set Custom User Claims on Firebase Auth
        await adminAuth.setCustomUserClaims(userId, { role });

        // Update Firestore
        await adminDb.collection('users').doc(userId).set({
            role,
            updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        await adminDb.collection('users_public').doc(userId).set({
            role,
            updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        // Write immutable audit log
        await logAuditEvent({
            adminId: admin.uid,
            adminEmail: admin.email,
            action: 'CUSTOM_CLAIMS_SET',
            resource: 'users',
            targetId: userId,
            details: { role },
            ip: clientIp,
            userAgent
        });

        return res.status(200).json({
            success: true,
            message: `Custom claims set to role: ${role}`,
            userId,
            role
        });
    } catch (err: any) {
        console.error('Error setting custom claims:', err);
        return res.status(500).json({ success: false, error: 'Failed to set custom claims', message: err?.message });
    }
}
