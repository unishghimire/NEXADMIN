import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { adminDb } from '../_lib/firebaseAdmin';
import { logAuditEvent } from '../_lib/auditLogger';
import { isValidId, getHeaderString } from '../_lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { mediaId, url } = req.body || {};

    if (!isValidId(mediaId)) {
        return res.status(400).json({ success: false, error: 'Invalid mediaId' });
    }

    const clientIp = getHeaderString(req.headers['x-forwarded-for']).split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = getHeaderString(req.headers['user-agent']);

    try {
        const mediaRef = adminDb.collection('media').doc(mediaId);
        const docSnap = await mediaRef.get();

        if (docSnap.exists) {
            await mediaRef.delete();
        }

        // Write immutable audit log
        await logAuditEvent({
            adminId: admin.uid,
            adminEmail: admin.email,
            action: 'MEDIA_DELETED',
            resource: 'media',
            targetId: mediaId,
            details: { url: url || docSnap.data()?.url },
            ip: clientIp,
            userAgent
        });

        return res.status(200).json({ success: true, message: 'Media item deleted' });
    } catch (err: any) {
        console.error('Error in /api/media/delete:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete media', message: err?.message });
    }
}
