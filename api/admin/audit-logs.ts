import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { adminDb } from '../_lib/firebaseAdmin';
import { getHeaderString } from '../_lib/validation';
import type { Query } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const limitRaw = getHeaderString(req.query.limit as any, '50');
    const limitParam = Math.min(100, Math.max(1, parseInt(limitRaw) || 50));
    const actionFilter = getHeaderString(req.query.action as any);
    const resourceFilter = getHeaderString(req.query.resource as any);

    try {
        let q: Query = adminDb.collection('auditLogs').orderBy('timestamp', 'desc');

        if (actionFilter) {
            q = q.where('action', '==', actionFilter);
        }
        if (resourceFilter) {
            q = q.where('resource', '==', resourceFilter);
        }

        q = q.limit(limitParam);

        const snap = await q.get();
        const logs = snap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                adminId: data.adminId,
                adminEmail: data.adminEmail,
                action: data.action,
                resource: data.resource,
                targetId: data.targetId,
                details: data.details,
                status: data.status,
                ip: data.ip,
                timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp
            };
        });

        return res.status(200).json({
            success: true,
            logs,
            count: logs.length
        });
    } catch (err: any) {
        console.error('Error fetching audit logs:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch audit logs', message: err?.message });
    }
}
