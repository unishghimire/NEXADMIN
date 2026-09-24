import { auth } from '../config/firebase';

interface ApiResponse<T = any> {
    success: boolean;
    error?: string;
    message?: string;
    [key: string]: any;
}

async function getAuthToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('Authentication required. Please log in as an administrator.');
    }
    return user.getIdToken(false);
}

async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await getAuthToken();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...((options.headers as Record<string, string>) || {})
    };

    const response = await fetch(endpoint, {
        ...options,
        headers
    });

    const data: ApiResponse<T> = await response.json().catch(() => ({
        success: false,
        error: 'Invalid response from server'
    }));

    if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
    }

    return data as T;
}

export const adminApiClient = {
    // Users Management
    updateUserRole: (userId: string, newRole: 'player' | 'organizer' | 'admin', reason?: string) =>
        apiRequest('/api/admin/users', {
            method: 'POST',
            body: JSON.stringify({ action: 'update-role', userId, newRole, reason })
        }),

    suspendUser: (userId: string, reason?: string) =>
        apiRequest('/api/admin/users', {
            method: 'POST',
            body: JSON.stringify({ action: 'suspend', userId, reason })
        }),

    restoreUser: (userId: string, reason?: string) =>
        apiRequest('/api/admin/users', {
            method: 'POST',
            body: JSON.stringify({ action: 'restore', userId, reason })
        }),

    // Organizations Management
    approveStandardOrg: (applicationId: string) =>
        apiRequest('/api/admin/orgs', {
            method: 'POST',
            body: JSON.stringify({ action: 'approve-standard', applicationId })
        }),

    approvePowerOrg: (applicationId: string) =>
        apiRequest('/api/admin/orgs', {
            method: 'POST',
            body: JSON.stringify({ action: 'approve-power', applicationId })
        }),

    rejectOrg: (applicationId: string, reason: string, isPowerOrg: boolean = false) =>
        apiRequest('/api/admin/orgs', {
            method: 'POST',
            body: JSON.stringify({
                action: isPowerOrg ? 'reject-power' : 'reject-standard',
                applicationId,
                reason
            })
        }),

    togglePowerOrg: (orgId: string, isPowerOrg: boolean) =>
        apiRequest('/api/admin/orgs', {
            method: 'POST',
            body: JSON.stringify({ action: 'toggle-power', orgId, isPowerOrg })
        }),

    // Financial Controls
    approveTransaction: (transactionId: string) =>
        apiRequest('/api/admin/transactions', {
            method: 'POST',
            body: JSON.stringify({ action: 'approve', transactionId })
        }),

    rejectTransaction: (transactionId: string, reason?: string) =>
        apiRequest('/api/admin/transactions', {
            method: 'POST',
            body: JSON.stringify({ action: 'reject', transactionId, reason })
        }),

    refundTransaction: (transactionId: string, reason?: string) =>
        apiRequest('/api/admin/transactions', {
            method: 'POST',
            body: JSON.stringify({ action: 'refund', transactionId, reason })
        }),

    adjustBalance: (userId: string, amount: number, type: 'credit' | 'debit', reason?: string) =>
        apiRequest('/api/admin/balance', {
            method: 'POST',
            body: JSON.stringify({ userId, amount, type, reason })
        }),

    releaseEarnings: (earningId: string) =>
        apiRequest('/api/admin/earnings', {
            method: 'POST',
            body: JSON.stringify({ earningId })
        }),

    // Platform Configuration
    getSettings: () =>
        apiRequest('/api/admin/settings', { method: 'GET' }),

    updateSettings: (settings: Record<string, any>) =>
        apiRequest('/api/admin/settings', {
            method: 'POST',
            body: JSON.stringify(settings)
        }),

    // Audit Logging
    getAuditLogs: (params: { limit?: number; action?: string; resource?: string } = {}) => {
        const query = new URLSearchParams();
        if (params.limit) query.set('limit', String(params.limit));
        if (params.action) query.set('action', params.action);
        if (params.resource) query.set('resource', params.resource);
        return apiRequest(`/api/admin/audit-logs?${query.toString()}`, { method: 'GET' });
    },

    // Tournament Oversight
    cancelTournament: (tournamentId: string, reason?: string) =>
        apiRequest('/api/wallet/cancel-tournament', {
            method: 'POST',
            body: JSON.stringify({ tournamentId, reason })
        }),

    // Media & Assets
    uploadImage: (image: string, name?: string) =>
        apiRequest('/api/upload/image', {
            method: 'POST',
            body: JSON.stringify({ image, name })
        }),

    deleteMedia: (mediaId: string, url?: string) =>
        apiRequest('/api/media/delete', {
            method: 'POST',
            body: JSON.stringify({ mediaId, url })
        }),

    // Discord Integration
    sendDiscordAnnouncement: (payload: { webhookUrl: string; embeds?: any[]; content?: string }) =>
        apiRequest('/api/discord/announce', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),

    testDiscordWebhook: (webhookUrl: string, hookName?: string) =>
        apiRequest('/api/discord/test', {
            method: 'POST',
            body: JSON.stringify({ webhookUrl, hookName })
        }),

    // Disputes & Moderation
    resolveDispute: (disputeId: string, action: 'warn' | 'ban' | 'dismiss', reason?: string) =>
        apiRequest('/api/admin/disputes', {
            method: 'POST',
            body: JSON.stringify({ disputeId, action, reason })
        }),

    // Result Update & Settlement Oversight
    getResultData: (eventId: string, eventType?: 'tournament' | 'scrim') => {
        const params = new URLSearchParams({ eventId });
        if (eventType) params.set('eventType', eventType);
        return apiRequest(`/api/admin/results?${params.toString()}`, { method: 'GET' });
    },

    updateResult: (payload: {
        action: 'SAVE_DRAFT' | 'VALIDATE' | 'PUBLISH' | 'REOPEN' | 'CORRECT' | 'LOCK';
        eventId: string;
        eventType?: 'tournament' | 'scrim';
        matchId?: string;
        results?: any[];
        reason?: string;
        scoringConfig?: any;
    }) =>
        apiRequest('/api/admin/results', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),

    // Tournament Stage Validation & Processing Oversight
    getStagesSummary: () =>
        apiRequest('/api/admin/stages', { method: 'GET' }),

    getTournamentStages: (tournamentId: string, stageNumber?: number) => {
        const params = new URLSearchParams({ tournamentId });
        if (stageNumber) params.set('stageNumber', String(stageNumber));
        return apiRequest(`/api/admin/stages?${params.toString()}`, { method: 'GET' });
    },

    validateStage: (tournamentId: string, stageNumber: number) =>
        apiRequest('/api/admin/stages', {
            method: 'POST',
            body: JSON.stringify({ action: 'VALIDATE_STAGE', tournamentId, stageNumber })
        }),

    processStage: (tournamentId: string, stageNumber: number) =>
        apiRequest('/api/admin/stages', {
            method: 'POST',
            body: JSON.stringify({ action: 'PROCESS_STAGE', tournamentId, stageNumber })
        }),

    overrideQualification: (payload: {
        tournamentId: string;
        stageNumber: number;
        teamId: string;
        newStatus: 'qualified' | 'eliminated';
        reason: string;
    }) =>
        apiRequest('/api/admin/stages', {
            method: 'POST',
            body: JSON.stringify({ action: 'OVERRIDE_QUALIFICATION', ...payload })
        }),

    correctStageResult: (payload: {
        tournamentId: string;
        stageNumber: number;
        matchId: string;
        teamId: string;
        placement: number;
        kills: number;
        reason: string;
    }) =>
        apiRequest('/api/admin/stages', {
            method: 'POST',
            body: JSON.stringify({ action: 'CORRECT_RESULT', ...payload })
        })
};

export const adminApi = adminApiClient;

