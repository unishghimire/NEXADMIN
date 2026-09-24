import { Timestamp } from 'firebase/firestore';

export type ResultStatus = 
    | 'RESULT_PENDING'
    | 'DEADLINE_ACTIVE'
    | 'OVERDUE'
    | 'PUBLISHED'
    | 'RESULT_REOPENED'
    | 'LOCKED';

export type ResultActionType = 
    | 'RESULT_CREATED'
    | 'RESULT_UPDATED'
    | 'RESULT_PUBLISHED'
    | 'RESULT_REOPENED'
    | 'RESULT_CORRECTED'
    | 'RESULT_LOCKED'
    | 'RESULT_PENALTY_APPLIED';

export type ResultEventType = 'tournament' | 'scrim';

export type ResultScoringType = 'NORMAL' | 'PER_KILL';

export interface ParticipantResultItem {
    id: string;                      // teamId or playerId or slot docId
    name: string;
    inGameName?: string;
    inGameId?: string;
    logoUrl?: string;
    placement: number;               // 1..N
    kills: number;                   // non-negative integer
    placementPoints: number;         // server-calculated
    killPoints: number;              // server-calculated
    totalPoints: number;             // server-calculated
    rewardAmount?: number;           // For per-kill: kills * rewardPerKill
    qualificationStatus?: 'qualified' | 'eliminated' | 'pending';
}

export interface MatchResultData {
    id: string;                      // match id (e.g. 'match-1', 'm1')
    matchNumber: number;
    map: string;
    status: 'scheduled' | 'live' | 'completed';
    results: ParticipantResultItem[];
    screenshotUrl?: string;
    updatedAt?: string | Timestamp | any;
    updatedBy?: string;
}

export interface ResultAuditEntry {
    id: string;
    eventId: string;
    eventType: ResultEventType;
    matchId?: string;
    action: ResultActionType;
    reason?: string;
    adminId: string;
    adminEmail?: string;
    previousValues?: any;
    newValues?: any;
    timestamp: string | Timestamp | any;
}

export interface ResultDeadlineInfo {
    completedAt: string | null;
    resultDeadlineAt: string | null;
    isOverdue: boolean;
    remainingMs: number;
    penaltyApplied: boolean;
    penaltyAmount: number;
    penaltyBase: number;
    status: ResultStatus;
}

export interface SettlementSummary {
    entryFeeTotal: number;
    prizePoolTotal: number;
    profit: number;
    orgShare: number;
    nexplayShare: number;
    commissionPercent: number;
    status: 'pending' | 'released' | 'no_earnings';
    isFreeEvent: boolean;
    lockedMoneyHandled?: boolean;
}
