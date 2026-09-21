import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { adminDb } from '../_lib/firebaseAdmin';
import { logAuditEvent } from '../_lib/auditLogger';
import { isNonNegativeNumber, sanitizeString, getHeaderString } from '../_lib/validation';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. GET: Fetch settings
    if (req.method === 'GET') {
        try {
            let settingsDoc = await adminDb.collection('settings').doc('site').get();
            if (!settingsDoc.exists) {
                settingsDoc = await adminDb.collection('settings').doc('general').get();
            }
            const data = settingsDoc.exists ? settingsDoc.data() : {};
            return res.status(200).json({ success: true, settings: data });
        } catch (err: any) {
            console.error('Error fetching settings:', err);
            return res.status(500).json({ success: false, error: 'Failed to fetch settings' });
        }
    }

    // 2. POST: Update settings (Admin only)
    if (req.method === 'POST') {
        const admin = await requireAdmin(req, res);
        if (!admin) return;

        const {
            minWithdrawal,
            platformCommissionPercent,
            minAuthenticScrimsForPowerOrg,
            supportEmail,
            supportPhone,
            notice,
            isNoticeActive,
            maintenanceMode,
            isOrgFormOpen,
            orgFormDescription,
            discordWebhooks,
            discordWebhookTournaments,
            discordWebhookScrims,
            autoDiscordTournamentAnnouncements
        } = req.body || {};

        const clientIp = getHeaderString(req.headers['x-forwarded-for']).split(',')[0]?.trim() || req.socket.remoteAddress;
        const userAgent = getHeaderString(req.headers['user-agent']);

        try {
            const settingsData: Record<string, any> = {
                minWithdrawal: isNonNegativeNumber(Number(minWithdrawal)) ? Number(minWithdrawal) : 50,
                platformCommissionPercent: Math.min(100, Math.max(0, Number(platformCommissionPercent) || 15)),
                minAuthenticScrimsForPowerOrg: Math.max(1, Number(minAuthenticScrimsForPowerOrg) || 20),
                supportEmail: sanitizeString(supportEmail) || 'support@nexplay.gg',
                supportPhone: sanitizeString(supportPhone) || '',
                notice: sanitizeString(notice) || '',
                isNoticeActive: Boolean(isNoticeActive),
                maintenanceMode: Boolean(maintenanceMode),
                isOrgFormOpen: isOrgFormOpen ?? true,
                orgFormDescription: sanitizeString(orgFormDescription) || '',
                discordWebhooks: typeof discordWebhooks === 'object' && discordWebhooks !== null ? discordWebhooks : {},
                discordWebhookTournaments: sanitizeString(discordWebhookTournaments) || '',
                discordWebhookScrims: sanitizeString(discordWebhookScrims) || '',
                autoDiscordTournamentAnnouncements: Boolean(autoDiscordTournamentAnnouncements),
                updatedBy: admin.uid,
                updatedAt: FieldValue.serverTimestamp()
            };

            await adminDb.collection('settings').doc('site').set(settingsData, { merge: true });
            await adminDb.collection('settings').doc('general').set(settingsData, { merge: true });

            // Write immutable audit log
            await logAuditEvent({
                adminId: admin.uid,
                adminEmail: admin.email,
                action: 'PLATFORM_SETTINGS_UPDATED',
                resource: 'settings',
                targetId: 'site',
                details: {
                    minWithdrawal: settingsData.minWithdrawal,
                    platformCommissionPercent: settingsData.platformCommissionPercent,
                    minAuthenticScrimsForPowerOrg: settingsData.minAuthenticScrimsForPowerOrg,
                    maintenanceMode: settingsData.maintenanceMode
                },
                ip: clientIp,
                userAgent
            });

            return res.status(200).json({
                success: true,
                message: 'Platform settings updated successfully',
                settings: settingsData
            });
        } catch (err: any) {
            console.error('Error updating settings:', err);
            return res.status(500).json({ success: false, error: 'Failed to update settings', message: err?.message });
        }
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
