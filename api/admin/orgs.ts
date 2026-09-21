import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { adminAuth, adminDb } from '../_lib/firebaseAdmin';
import { logAuditEvent } from '../_lib/auditLogger';
import { isValidId, sanitizeString, getHeaderString } from '../_lib/validation';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { action, orgId, applicationId, reason, isPowerOrg } = req.body || {};

    const clientIp = getHeaderString(req.headers['x-forwarded-for']).split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = getHeaderString(req.headers['user-agent']);

    try {
        if (action === 'approve-standard') {
            if (!isValidId(applicationId)) {
                return res.status(400).json({ success: false, error: 'Invalid applicationId' });
            }

            const appRef = adminDb.collection('orgApplications').doc(applicationId);
            const appDoc = await appRef.get();
            if (!appDoc.exists) {
                return res.status(404).json({ success: false, error: 'Application not found' });
            }

            const appData = appDoc.data()!;
            const targetUserId = appData.userId;

            const userRef = adminDb.collection('users').doc(targetUserId);
            const userDoc = await userRef.get();
            if (!userDoc.exists) {
                return res.status(404).json({ success: false, error: 'User account not found' });
            }

            // 1. Update Custom Claims
            await adminAuth.setCustomUserClaims(targetUserId, { role: 'organizer' });

            // 2. Update user profile
            await userRef.update({
                role: 'organizer',
                orgStatus: 'approved',
                orgName: appData.orgName || '',
                orgPhone: appData.whatsapp || '',
                orgEmail: appData.email || '',
                orgTier: 'standard',
                updatedAt: FieldValue.serverTimestamp()
            });

            await adminDb.collection('users_public').doc(targetUserId).set({
                role: 'organizer',
                orgName: appData.orgName || '',
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });

            // 3. Update application status
            await appRef.update({
                status: 'approved',
                reviewedAt: FieldValue.serverTimestamp(),
                reviewedBy: admin.uid
            });

            // 4. Send notification
            await adminDb.collection('notifications').add({
                userId: targetUserId,
                title: 'Organization Approved!',
                message: 'Your host application has been approved! You can now access the Organizer Panel.',
                type: 'success',
                read: false,
                link: '/organizer-panel',
                timestamp: FieldValue.serverTimestamp()
            });

            // 5. Audit log
            await logAuditEvent({
                adminId: admin.uid,
                adminEmail: admin.email,
                action: 'ORGANIZATION_APPROVED',
                resource: 'organizations',
                targetId: targetUserId,
                details: { applicationId, orgName: appData.orgName },
                ip: clientIp,
                userAgent
            });

            return res.status(200).json({ success: true, message: 'Organization application approved' });
        }

        if (action === 'approve-power') {
            if (!isValidId(applicationId)) {
                return res.status(400).json({ success: false, error: 'Invalid applicationId' });
            }

            const appRef = adminDb.collection('power_org_applications').doc(applicationId);
            const appDoc = await appRef.get();
            if (!appDoc.exists) {
                return res.status(404).json({ success: false, error: 'Power Org application not found' });
            }

            const appData = appDoc.data()!;
            const targetUserId = appData.userId;

            const userRef = adminDb.collection('users').doc(targetUserId);
            const userDoc = await userRef.get();
            if (!userDoc.exists) {
                return res.status(404).json({ success: false, error: 'User account not found' });
            }

            // Update user to Power Org
            await userRef.update({
                isPowerOrganizer: true,
                isPowerOrg: true,
                orgTier: 'power',
                powerOrgApplicationStatus: 'approved',
                updatedAt: FieldValue.serverTimestamp()
            });

            await adminDb.collection('users_public').doc(targetUserId).set({
                isPowerOrganizer: true,
                isPowerOrg: true,
                orgTier: 'power',
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });

            await appRef.update({
                status: 'approved',
                reviewedAt: FieldValue.serverTimestamp(),
                reviewedBy: admin.uid
            });

            await adminDb.collection('notifications').add({
                userId: targetUserId,
                title: 'Power Organizer Status Granted! 🏆',
                message: 'Congratulations! Your application for Power Organizer has been verified and approved.',
                type: 'success',
                read: false,
                link: '/organizer-panel',
                timestamp: FieldValue.serverTimestamp()
            });

            await logAuditEvent({
                adminId: admin.uid,
                adminEmail: admin.email,
                action: 'POWER_ORGANIZER_GRANTED',
                resource: 'organizations',
                targetId: targetUserId,
                details: { applicationId, orgName: appData.orgName },
                ip: clientIp,
                userAgent
            });

            return res.status(200).json({ success: true, message: 'Power Organizer status granted' });
        }

        if (action === 'reject-standard' || action === 'reject-power') {
            if (!isValidId(applicationId)) {
                return res.status(400).json({ success: false, error: 'Invalid applicationId' });
            }

            const collectionName = action === 'reject-power' ? 'power_org_applications' : 'orgApplications';
            const appRef = adminDb.collection(collectionName).doc(applicationId);
            const appDoc = await appRef.get();
            if (!appDoc.exists) {
                return res.status(404).json({ success: false, error: 'Application not found' });
            }

            const appData = appDoc.data()!;
            await appRef.update({
                status: 'rejected',
                rejectionReason: sanitizeString(reason) || 'Does not meet current requirements',
                reviewedAt: FieldValue.serverTimestamp(),
                reviewedBy: admin.uid
            });

            const userRef = adminDb.collection('users').doc(appData.userId);
            const userDoc = await userRef.get();
            if (userDoc.exists) {
                if (action === 'reject-standard') {
                    await userRef.update({
                        orgStatus: 'rejected',
                        updatedAt: FieldValue.serverTimestamp()
                    });
                } else {
                    await userRef.update({
                        powerOrgApplicationStatus: 'rejected',
                        updatedAt: FieldValue.serverTimestamp()
                    });
                }
            }

            await logAuditEvent({
                adminId: admin.uid,
                adminEmail: admin.email,
                action: action === 'reject-power' ? 'POWER_ORGANIZER_REJECTED' : 'ORGANIZATION_REJECTED',
                resource: 'organizations',
                targetId: appData.userId,
                details: { applicationId, reason: sanitizeString(reason) },
                ip: clientIp,
                userAgent
            });

            return res.status(200).json({ success: true, message: 'Application rejected' });
        }

        if (action === 'toggle-power') {
            if (!isValidId(orgId)) {
                return res.status(400).json({ success: false, error: 'Invalid orgId' });
            }

            const userRef = adminDb.collection('users').doc(orgId);
            const userDoc = await userRef.get();
            if (!userDoc.exists) {
                return res.status(404).json({ success: false, error: 'User account not found' });
            }

            const newStatus = Boolean(isPowerOrg);
            const newTier = newStatus ? 'power' : 'standard';

            await userRef.update({
                isPowerOrganizer: newStatus,
                isPowerOrg: newStatus,
                orgTier: newTier,
                powerOrgApplicationStatus: newStatus ? 'approved' : 'none',
                updatedAt: FieldValue.serverTimestamp()
            });

            await adminDb.collection('users_public').doc(orgId).set({
                isPowerOrganizer: newStatus,
                isPowerOrg: newStatus,
                orgTier: newTier,
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });

            await logAuditEvent({
                adminId: admin.uid,
                adminEmail: admin.email,
                action: newStatus ? 'GRANT_POWER_ORGANIZER' : 'REVOKE_POWER_ORGANIZER',
                resource: 'organizations',
                targetId: orgId,
                details: { newStatus, newTier },
                ip: clientIp,
                userAgent
            });

            return res.status(200).json({ success: true, message: `Power status ${newStatus ? 'granted' : 'revoked'}` });
        }

        return res.status(400).json({ success: false, error: 'Invalid action' });
    } catch (err: any) {
        console.error('Error in /api/admin/orgs:', err);
        return res.status(500).json({ success: false, error: 'Internal Server Error', message: err?.message });
    }
}
