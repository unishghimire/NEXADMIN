import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { adminDb } from '../_lib/firebaseAdmin';
import { logAuditEvent } from '../_lib/auditLogger';
import { isValidId, isPositiveNumber, sanitizeString, getHeaderString } from '../_lib/validation';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { userId, amount, type, reason } = req.body || {};

    if (!isValidId(userId)) {
        return res.status(400).json({ success: false, error: 'Invalid userId' });
    }

    const numericAmount = Number(amount);
    if (!isPositiveNumber(numericAmount)) {
        return res.status(400).json({ success: false, error: 'Amount must be a positive number' });
    }

    if (type !== 'credit' && type !== 'debit') {
        return res.status(400).json({ success: false, error: 'Type must be either credit or debit' });
    }

    const clientIp = getHeaderString(req.headers['x-forwarded-for']).split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const userAgent = getHeaderString(req.headers['user-agent'], 'unknown');

    try {
        const adjustmentAmount = type === 'credit' ? numericAmount : -numericAmount;

        await adminDb.runTransaction(async (t) => {
            const userRef = adminDb.collection('users').doc(userId);
            const userDoc = await t.get(userRef);

            if (!userDoc.exists) {
                throw new Error('User not found');
            }

            const currentBalance = userDoc.data()?.balance || 0;
            if (type === 'debit' && currentBalance < numericAmount) {
                throw new Error(`Insufficient user balance. Current balance is Rs. ${currentBalance}`);
            }

            t.update(userRef, {
                balance: FieldValue.increment(adjustmentAmount),
                updatedAt: FieldValue.serverTimestamp()
            });

            // Create transaction ledger record
            const txRef = adminDb.collection('transactions').doc();
            t.set(txRef, {
                id: txRef.id,
                userId,
                username: userDoc.data()?.username || 'User',
                type: 'adjustment',
                amount: numericAmount,
                method: 'Admin Adjustment',
                status: 'success',
                desc: `${type === 'credit' ? 'Admin Credit' : 'Admin Debit'}: ${sanitizeString(reason) || 'Manual administrative adjustment'}`,
                adjustedBy: admin.uid,
                timestamp: FieldValue.serverTimestamp()
            });
        });

        // Write immutable audit log
        await logAuditEvent({
            adminId: admin.uid,
            adminEmail: admin.email,
            action: `MANUAL_BALANCE_${type.toUpperCase()}`,
            resource: 'users',
            targetId: userId,
            details: {
                amount: numericAmount,
                type,
                reason: sanitizeString(reason)
            },
            ip: clientIp,
            userAgent
        });

        return res.status(200).json({
            success: true,
            message: `User balance ${type}ed by Rs. ${numericAmount}`,
            userId,
            amount: numericAmount,
            type
        });
    } catch (err: any) {
        console.error('Error in /api/admin/balance:', err);
        return res.status(400).json({
            success: false,
            error: 'Balance adjustment failed',
            message: err?.message || 'Operation failed'
        });
    }
}
