import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { adminDb } from '../_lib/firebaseAdmin';
import { logAuditEvent } from '../_lib/auditLogger';
import { isValidId, sanitizeString, getHeaderString } from '../_lib/validation';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { action, transactionId, reason } = req.body || {};

    if (!isValidId(transactionId)) {
        return res.status(400).json({ success: false, error: 'Invalid transactionId' });
    }

    const clientIp = getHeaderString(req.headers['x-forwarded-for']).split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = getHeaderString(req.headers['user-agent']);

    try {
        const result = await adminDb.runTransaction(async (t) => {
            const txRef = adminDb.collection('transactions').doc(transactionId);
            const txDoc = await t.get(txRef);

            if (!txDoc.exists) {
                throw new Error('Transaction not found');
            }

            const txData = txDoc.data()!;
            const userId = txData.userId;
            const amount = Number(txData.amount) || 0;
            const type = txData.type; // 'deposit' | 'withdrawal'
            const currentStatus = txData.status;

            const userRef = adminDb.collection('users').doc(userId);
            const userDoc = await t.get(userRef);
            if (!userDoc.exists) {
                throw new Error('Associated user account not found');
            }
            const userData = userDoc.data() || {};
            const userBalance = Number(userData.balance) || 0;

            if (action === 'approve') {
                if (currentStatus !== 'pending') {
                    throw new Error(`Transaction is already ${currentStatus}`);
                }

                if (type === 'deposit') {
                    // Credit user balance
                    t.update(userRef, {
                        balance: FieldValue.increment(amount),
                        updatedAt: FieldValue.serverTimestamp()
                    });
                } else if (type === 'withdrawal') {
                    // For withdrawals, balance was reserved upon request or deducted.
                    // Mark as completed.
                }

                t.update(txRef, {
                    status: 'success',
                    approvedBy: admin.uid,
                    approvedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                });

                return { action: 'approve', userId, amount, type };
            }

            if (action === 'reject') {
                if (currentStatus !== 'pending') {
                    throw new Error(`Transaction is already ${currentStatus}`);
                }

                // If a withdrawal was rejected, refund the user's reserved balance
                if (type === 'withdrawal') {
                    t.update(userRef, {
                        balance: FieldValue.increment(amount),
                        updatedAt: FieldValue.serverTimestamp()
                    });
                }

                t.update(txRef, {
                    status: 'rejected',
                    rejectionReason: sanitizeString(reason) || 'Rejected by administrator',
                    rejectedBy: admin.uid,
                    rejectedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                });

                return { action: 'reject', userId, amount, type };
            }

            if (action === 'refund') {
                if (currentStatus !== 'success') {
                    throw new Error('Only successful transactions can be refunded');
                }

                if (type === 'deposit') {
                    // Prevent balance from dropping below zero
                    if (userBalance < amount) {
                        throw new Error(`Cannot refund deposit: User balance (Rs. ${userBalance}) is less than refund amount (Rs. ${amount})`);
                    }
                    // Deduct credited balance
                    t.update(userRef, {
                        balance: FieldValue.increment(-amount),
                        updatedAt: FieldValue.serverTimestamp()
                    });
                } else if (type === 'withdrawal') {
                    // Return withdrawn balance
                    t.update(userRef, {
                        balance: FieldValue.increment(amount),
                        updatedAt: FieldValue.serverTimestamp()
                    });
                }

                t.update(txRef, {
                    status: 'refunded',
                    refundReason: sanitizeString(reason) || 'Refunded by administrator',
                    refundedBy: admin.uid,
                    refundedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                });

                return { action: 'refund', userId, amount, type };
            }

            throw new Error('Invalid action');
        });

        // Write immutable audit log
        await logAuditEvent({
            adminId: admin.uid,
            adminEmail: admin.email,
            action: `TRANSACTION_${result.action.toUpperCase()}D`,
            resource: 'transactions',
            targetId: transactionId,
            details: {
                userId: result.userId,
                amount: result.amount,
                type: result.type,
                reason: sanitizeString(reason)
            },
            ip: clientIp,
            userAgent
        });

        // Dispatch notification to user
        await adminDb.collection('notifications').add({
            userId: result.userId,
            title: `Transaction ${result.action.toUpperCase()}D`,
            message: `Your ${result.type} of Rs. ${result.amount} has been ${result.action}d.${reason ? ` Reason: ${reason}` : ''}`,
            type: result.action === 'approve' ? 'success' : 'alert',
            read: false,
            link: '/wallet',
            timestamp: FieldValue.serverTimestamp()
        }).catch(() => {});

        return res.status(200).json({
            success: true,
            message: `Transaction ${result.action}d successfully`,
            transactionId
        });
    } catch (err: any) {
        console.error('Error in /api/admin/transactions:', err);
        return res.status(400).json({
            success: false,
            error: 'Transaction processing failed',
            message: err?.message || 'Operation could not be completed'
        });
    }
}
