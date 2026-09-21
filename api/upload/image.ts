import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { isNonEmptyString } from '../_lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const apiKey = process.env.IMGBB_API_KEY || process.env.VITE_IMGBB_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ success: false, error: 'ImgBB API key not configured on server' });
    }

    const { image, name } = req.body || {};

    if (!isNonEmptyString(image)) {
        return res.status(400).json({ success: false, error: 'Missing image data (base64 string required)' });
    }

    // Strip data URI prefix if present
    const cleanBase64 = image.replace(/^data:image\/[a-z]+;base64,/, '');

    // Max 5MB check
    const sizeInBytes = (cleanBase64.length * 3) / 4;
    if (sizeInBytes > 5 * 1024 * 1024) {
        return res.status(400).json({ success: false, error: 'Image exceeds maximum 5MB size limit' });
    }

    try {
        const formData = new URLSearchParams();
        formData.append('key', apiKey);
        formData.append('image', cleanBase64);
        if (name) formData.append('name', String(name).slice(0, 100));

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            console.error('ImgBB upload error:', data);
            return res.status(502).json({
                success: false,
                error: 'Failed to upload image to ImgBB',
                details: data?.error?.message || 'External provider error'
            });
        }

        return res.status(200).json({
            success: true,
            url: data.data.url,
            display_url: data.data.display_url,
            thumb_url: data.data.thumb?.url,
            delete_url: data.data.delete_url
        });
    } catch (err: any) {
        console.error('Error in /api/upload/image:', err);
        return res.status(500).json({ success: false, error: 'Internal Server Error', message: err?.message });
    }
}
