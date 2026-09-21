import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { isNonEmptyString } from '../_lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { webhookUrl, hookName } = req.body || {};

    if (!isNonEmptyString(webhookUrl) || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        return res.status(400).json({ success: false, error: 'Invalid or missing Discord webhook URL' });
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'NexPlay Admin Suite',
                avatar_url: 'https://i.ibb.co/vz02vK9/logo.png',
                embeds: [{
                    title: '✅ Discord Webhook Connected',
                    description: `The **${hookName || 'Default'}** webhook channel has been verified by Administrator **${admin.email}**.`,
                    color: 0x5865F2,
                    timestamp: new Date().toISOString()
                }]
            })
        });

        if (!response.ok) {
            const text = await response.text();
            return res.status(response.status).json({ success: false, error: 'Discord webhook test failed', details: text });
        }

        return res.status(200).json({ success: true, message: 'Discord webhook test succeeded' });
    } catch (err: any) {
        console.error('Error testing Discord webhook:', err);
        return res.status(500).json({ success: false, error: 'Failed to test Discord webhook', message: err?.message });
    }
}
