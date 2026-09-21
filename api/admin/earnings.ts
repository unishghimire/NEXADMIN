import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { adminDb } from '../_lib/firebaseAdmin';
import { logAuditEvent } from '../_lib/auditLogger';
import { isValidId, getHeaderString } from '../_lib/validation';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { earningId } = req.body || {};

    if (!isValidId(earningId)) {
        return res.status(400).json({ success: false, error: 'Invalid earningId' });
    }

    const clientIp = getHeaderString(req.headers['x-forwarded-for']).split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = getHeaderString(req.headers['user-agent']);

    try {
        const result = await adminDb.runTransaction(async (t) => {
            const earningRef = adminDb.collection('tournamentEarnings').doc(earningId);
            const earningDoc = await t.get(earningRef);

            if (!earningDoc.exists) {
                throw new Error('Earning record not found');
            }

            const earningData = earningDoc.data()!;
            if (earningData.status === 'released') {
                throw new Error('Earnings have already been released');
            }

            const orgShare = Number(earningData.orgShare) || 0;
            const orgId = earningData.orgId;

            if (!orgId) {
                throw new Error('Organizer ID missing in earnings record');
            }

            // Verify organizer account exists before any writes
            const orgRef = adminDb.collection('users').doc(orgId);
            const orgDoc = await t.get(orgRef);
            if (!orgDoc.exists) {
                throw new Error('Organizer user account not found');
            }

            // Mark earning as released
            t.update(earningRef, {
                status: 'released',
                releasedAt: FieldValue.serverTimestamp(),
                releasedBy: admin.uid
            });

            // Credit organizer wallet balance
            t.update(orgRef, {
                orgWalletBalance: FieldValue.increment(orgShare),
                balance: FieldValue.increment(orgShare),
                orgPendingEarnings: FieldValue.increment(-orgShare),
                updatedAt: FieldValue.serverTimestamp()
            });

            // Create ledger payout transaction
            const txRef = adminDb.collection('transactions').doc();
            t.set(txRef, {
                id: txRef.id,
                userId: orgId,
                username: earningData.orgName || 'Organizer',
                type: 'earning_payout',
                amount: orgShare,
                method: 'Tournament Organizer Share',
                status: 'success',
                desc: `Organizer profit share released for "${earningData.tournamentName || 'Tournament'}"`,
                tournamentId: earningData.tournamentId || '',
                releasedBy: admin.uid,
                timestamp: FieldValue.serverTimestamp()
            });

            return { orgId, orgShare, tournamentName: earningData.tournamentName };
        });

        // Write immutable audit log
        await logAuditEvent({
            adminId: admin.uid,
            adminEmail: admin.email,
            action: 'TOURNAMENT_EARNINGS_RELEASED',
            resource: 'tournaments',
            targetId: earningId,
            details: {
                orgId: result.orgId,
                orgShare: result.orgShare,
                tournamentName: result.tournamentName
            },
            ip: clientIp,
            userAgent
        });

        // Notify organizer
        await adminDb.collection('notifications').add({
            userId: result.orgId,
            title: 'Tournament Earnings Released! 💰',
            message: `Your profit share of Rs. ${result.orgShare} for "${result.tournamentName}" has been credited to your wallet.`,
            type: 'success',
            read: false,
            link: '/organizer-panel',
            timestamp: FieldValue.serverTimestamp()
        }).catch(() => {});

        return res.status(200).json({
            success: true,
            message: 'Earnings released successfully',
            earningId,
            orgShare: result.orgShare
        });
    } catch (err: any) {
        console.error('Error in /api/admin/earnings:', err);
        return res.status(400).json({
            success: false,
            error: 'Failed to release earnings',
            message: err?.message || 'Operation failed'
        });
    }
}
