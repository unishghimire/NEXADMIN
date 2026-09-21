import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { isNonEmptyString } from '../_lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { webhookUrl, embeds, content } = req.body || {};

    if (!isNonEmptyString(webhookUrl) || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        return res.status(400).json({ success: false, error: 'Invalid or missing Discord webhook URL' });
    }

    try {
        const payload: Record<string, any> = {};
        if (content) payload.content = String(content).slice(0, 2000);
        if (Array.isArray(embeds)) payload.embeds = embeds.slice(0, 10);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            return res.status(response.status).json({
                success: false,
                error: 'Discord API error',
                details: text
            });
        }

        return res.status(200).json({ success: true, message: 'Announcement sent to Discord' });
    } catch (err: any) {
        console.error('Error sending Discord announcement:', err);
        return res.status(500).json({ success: false, error: 'Failed to send Discord announcement', message: err?.message });
    }
}
