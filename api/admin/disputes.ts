import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { adminAuth, adminDb } from '../_lib/firebaseAdmin';
import { logAuditEvent } from '../_lib/auditLogger';
import { isValidId, sanitizeString, getHeaderString } from '../_lib/validation';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { disputeId, action, reason } = req.body || {};

    if (!isValidId(disputeId)) {
        return res.status(400).json({ success: false, error: 'Invalid disputeId' });
    }

    if (action !== 'warn' && action !== 'ban' && action !== 'dismiss') {
        return res.status(400).json({ success: false, error: 'Invalid action. Must be warn, ban, or dismiss.' });
    }

    const clientIp = getHeaderString(req.headers['x-forwarded-for']).split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = getHeaderString(req.headers['user-agent']);

    try {
        const disputeRef = adminDb.collection('disputes').doc(disputeId);
        const disputeSnap = await disputeRef.get();

        if (!disputeSnap.exists) {
            return res.status(404).json({ success: false, error: 'Dispute record not found' });
        }

        const disputeData = disputeSnap.data()!;
        const reportedUserId = disputeData.reportedUserId || disputeData.targetUserId || disputeData.reportedUser;
        const finalStatus = action === 'dismiss' ? 'dismissed' : 'resolved';
        const cleanReason = sanitizeString(reason) || `Dispute ${action}ed by administrator`;

        // Update dispute document
        await disputeRef.update({
            status: finalStatus,
            resolutionAction: action,
            resolutionReason: cleanReason,
            resolvedBy: admin.uid,
            resolvedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        // If action is ban, suspend the reported user
        if (action === 'ban' && isValidId(reportedUserId)) {
            try {
                await adminAuth.updateUser(reportedUserId, { disabled: true });
                await adminDb.collection('users').doc(reportedUserId).update({
                    status: 'suspended',
                    isBanned: true,
                    suspendedAt: FieldValue.serverTimestamp(),
                    suspendedBy: admin.uid,
                    suspensionReason: `Dispute penalty: ${cleanReason}`
                });
            } catch (banErr) {
                console.error(`Failed to ban reported user ${reportedUserId}:`, banErr);
            }
        }

        // Write immutable audit log
        await logAuditEvent({
            adminId: admin.uid,
            adminEmail: admin.email,
            action: `DISPUTE_${action.toUpperCase()}ED`,
            resource: 'disputes',
            targetId: disputeId,
            details: {
                action,
                reason: cleanReason,
                reportedUserId: reportedUserId || null,
                tournamentId: disputeData.tournamentId || null
            },
            ip: clientIp,
            userAgent
        });

        return res.status(200).json({
            success: true,
            message: `Dispute ${action}ed successfully`,
            disputeId,
            action
        });
    } catch (err: any) {
        console.error('Error in /api/admin/disputes:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to resolve dispute',
            message: err?.message || 'Internal server error'
        });
    }
}
