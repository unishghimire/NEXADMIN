import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';

export interface AuditEventParams {
    adminId: string;
    adminEmail?: string;
    action: string;
    resource: 'users' | 'organizations' | 'transactions' | 'settings' | 'tournaments' | 'media' | 'disputes' | 'system';
    targetId?: string;
    details?: Record<string, any>;
    status?: 'SUCCESS' | 'FAILED';
    ip?: string;
    userAgent?: string;
}

export async function logAuditEvent(params: AuditEventParams): Promise<string> {
    try {
        const auditRef = adminDb.collection('auditLogs').doc();
        const eventData = {
            id: auditRef.id,
            adminId: params.adminId,
            adminEmail: params.adminEmail || 'unknown@nexplay.gg',
            action: params.action,
            resource: params.resource,
            targetId: params.targetId || null,
            details: params.details || {},
            status: params.status || 'SUCCESS',
            ip: params.ip || 'unknown',
            userAgent: params.userAgent || 'unknown',
            timestamp: FieldValue.serverTimestamp()
        };

        await auditRef.set(eventData);
        return auditRef.id;
    } catch (error) {
        console.error('CRITICAL: Failed to write immutable audit log:', error);
        // Do not fail the calling admin function if audit logging encounters a non-fatal storage blip,
        // but ensure it is logged to Vercel runtime logs with full severity.
        return '';
    }
}
