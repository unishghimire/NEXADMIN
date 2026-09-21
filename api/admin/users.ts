import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { adminAuth, adminDb } from '../_lib/firebaseAdmin';
import { logAuditEvent } from '../_lib/auditLogger';
import { isValidId, isValidRole, sanitizeString, getHeaderString } from '../_lib/validation';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { action, userId, newRole, reason } = req.body || {};

    if (!isValidId(userId)) {
        return res.status(400).json({ success: false, error: 'Invalid or missing userId' });
    }

    const clientIp = getHeaderString(req.headers['x-forwarded-for']).split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = getHeaderString(req.headers['user-agent']);

    try {
        if (action === 'update-role') {
            if (!isValidRole(newRole)) {
                return res.status(400).json({ success: false, error: 'Invalid role specified. Must be player, organizer, or admin.' });
            }

            // Prevent self-demotion if it would leave the platform without an admin
            if (userId === admin.uid && newRole !== 'admin') {
                return res.status(400).json({ success: false, error: 'Administrators cannot demote themselves.' });
            }

            const userRef = adminDb.collection('users').doc(userId);
            const userDoc = await userRef.get();
            if (!userDoc.exists) {
                return res.status(404).json({ success: false, error: 'Target user not found' });
            }

            const oldRole = userDoc.data()?.role || 'player';

            // 1. Update Custom Claims in Firebase Auth (authoritative)
            await adminAuth.setCustomUserClaims(userId, { role: newRole });

            // 2. Update Firestore documents
            await userRef.update({
                role: newRole,
                updatedAt: FieldValue.serverTimestamp()
            });

            await adminDb.collection('users_public').doc(userId).set({
                role: newRole,
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });

            // 3. Write immutable audit log
            await logAuditEvent({
                adminId: admin.uid,
                adminEmail: admin.email,
                action: 'USER_ROLE_CHANGED',
                resource: 'users',
                targetId: userId,
                details: {
                    oldRole,
                    newRole,
                    reason: sanitizeString(reason) || 'Admin dashboard action'
                },
                ip: clientIp,
                userAgent
            });

            return res.status(200).json({
                success: true,
                message: `User role updated from ${oldRole} to ${newRole}`,
                userId,
                newRole
            });
        }

        if (action === 'suspend') {
            // Disable Firebase Auth account
            await adminAuth.updateUser(userId, { disabled: true });

            // Update Firestore
            await adminDb.collection('users').doc(userId).update({
                status: 'suspended',
                suspendedAt: FieldValue.serverTimestamp(),
                suspendedBy: admin.uid,
                suspensionReason: sanitizeString(reason) || 'Administrative suspension'
            });

            await logAuditEvent({
                adminId: admin.uid,
                adminEmail: admin.email,
                action: 'USER_SUSPENDED',
                resource: 'users',
                targetId: userId,
                details: { reason: sanitizeString(reason) || 'Administrative suspension' },
                ip: clientIp,
                userAgent
            });

            return res.status(200).json({
                success: true,
                message: 'User account suspended and disabled',
                userId
            });
        }

        if (action === 'restore') {
            // Re-enable Firebase Auth account
            await adminAuth.updateUser(userId, { disabled: false });

            // Update Firestore
            await adminDb.collection('users').doc(userId).update({
                status: 'active',
                restoredAt: FieldValue.serverTimestamp(),
                restoredBy: admin.uid
            });

            await logAuditEvent({
                adminId: admin.uid,
                adminEmail: admin.email,
                action: 'USER_RESTORED',
                resource: 'users',
                targetId: userId,
                details: { reason: sanitizeString(reason) || 'Administrative restoration' },
                ip: clientIp,
                userAgent
            });

            return res.status(200).json({
                success: true,
                message: 'User account restored and re-enabled',
                userId
            });
        }

        return res.status(400).json({ success: false, error: 'Invalid action' });
    } catch (err: any) {
        console.error('Error in /api/admin/users:', err);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: err?.message || 'Failed to process user operation'
        });
    }
}
