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

    const { tournamentId, reason } = req.body || {};

    if (!isValidId(tournamentId)) {
        return res.status(400).json({ success: false, error: 'Invalid tournamentId' });
    }

    const clientIp = getHeaderString(req.headers['x-forwarded-for']).split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = getHeaderString(req.headers['user-agent']);

    try {
        // 1. Fetch tournament / scrim document
        const tournRef = adminDb.collection('tournaments').doc(tournamentId);
        let tournDoc = await tournRef.get();
        let isScrim = false;

        if (!tournDoc.exists) {
            const scrimRef = adminDb.collection('scrims').doc(tournamentId);
            tournDoc = await scrimRef.get();
            isScrim = true;
        }

        if (!tournDoc.exists) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        const eventData = tournDoc.data()!;

        // 1.1 Idempotency check: prevent double cancellation and duplicate refunds
        if (eventData.status === 'cancelled') {
            return res.status(400).json({ success: false, error: 'Event is already cancelled' });
        }

        const entryFee = Number(eventData.entryFee) || 0;

        // 2. Fetch all participants for this event
        const fieldName = isScrim ? 'scrimId' : 'tournamentId';
        const participantsSnap = await adminDb.collection('participants').where(fieldName, '==', tournamentId).get();

        let refundedCount = 0;
        let totalRefunded = 0;

        // 3. Batch process refunds in safe chunks of 100 participants (max 300 writes per batch)
        // Firestore has a strict limit of 500 writes per batch.
        const targetDocRef = isScrim ? adminDb.collection('scrims').doc(tournamentId) : tournRef;
        const eligibleDocs = participantsSnap.docs.filter(d => d.data().status !== 'refunded');

        const CHUNK_SIZE = 100;
        for (let i = 0; i < eligibleDocs.length; i += CHUNK_SIZE) {
            const chunk = eligibleDocs.slice(i, i + CHUNK_SIZE);
            const batch = adminDb.batch();

            for (const doc of chunk) {
                const pData = doc.data();
                const targetUserId = pData.userId || pData.captainUid;

                if (targetUserId && entryFee > 0) {
                    const userRef = adminDb.collection('users').doc(targetUserId);
                    batch.update(userRef, {
                        balance: FieldValue.increment(entryFee),
                        updatedAt: FieldValue.serverTimestamp()
                    });

                    const txRef = adminDb.collection('transactions').doc();
                    batch.set(txRef, {
                        id: txRef.id,
                        userId: targetUserId,
                        type: 'refund',
                        amount: entryFee,
                        status: 'success',
                        desc: `Auto-refund for cancelled event: "${eventData.title || tournamentId}"`,
                        tournamentId,
                        timestamp: FieldValue.serverTimestamp()
                    });

                    refundedCount++;
                    totalRefunded += entryFee;
                }

                // Mark participant status as refunded
                batch.update(doc.ref, {
                    status: 'refunded',
                    refundedAt: FieldValue.serverTimestamp()
                });
            }

            await batch.commit();
        }

        // 4. Update event status to cancelled
        await targetDocRef.update({
            status: 'cancelled',
            cancelledAt: FieldValue.serverTimestamp(),
            cancelledBy: admin.uid,
            cancelReason: reason || 'Cancelled by administrator',
            updatedAt: FieldValue.serverTimestamp()
        });

        // 5. Write immutable audit log
        await logAuditEvent({
            adminId: admin.uid,
            adminEmail: admin.email,
            action: 'EVENT_CANCELLED_AND_REFUNDED',
            resource: 'tournaments',
            targetId: tournamentId,
            details: {
                title: eventData.title,
                refundedCount,
                totalRefunded,
                isScrim,
                reason
            },
            ip: clientIp,
            userAgent
        });

        return res.status(200).json({
            success: true,
            message: `Event cancelled successfully. ${refundedCount} participants refunded a total of Rs. ${totalRefunded}.`,
            refundedCount,
            totalRefunded
        });
    } catch (err: any) {
        console.error('Error in /api/wallet/cancel-tournament:', err);
        return res.status(500).json({ success: false, error: 'Failed to cancel event', message: err?.message });
    }
}
