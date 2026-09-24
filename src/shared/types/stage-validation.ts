// ═══════════════════════════════════════════════════════════════
// TOURNAMENT STAGE RESULT VALIDATION & PROCESSING TYPES
// ═══════════════════════════════════════════════════════════════

export type StageValidationStatus = 'PASSED' | 'FAILED' | 'PENDING';
export type StageProcessingStatus = 'NOT_READY' | 'READY' | 'PROCESSING' | 'PROCESSED';
export type StageQualificationStatus = 'PENDING' | 'PREVIEW_READY' | 'FINALIZED' | 'OVERRIDDEN';

export type StageActionType =
    | 'VALIDATE_STAGE'
    | 'PROCESS_STAGE'
    | 'OVERRIDE_QUALIFICATION'
    | 'CORRECT_RESULT'
    | 'REOPEN_RESULT';

export interface StageMissingResult {
    groupId: string;
    groupName: string;
    teamId: string;
    teamName: string;
    matchId: string;
    matchNumber: number;
    roundNumber: number;
    map?: string;
    reason: string;
}

export interface StageInvalidResult {
    groupId: string;
    groupName: string;
    teamId: string;
    teamName: string;
    matchId: string;
    matchNumber: number;
    placement?: number;
    kills?: number;
    reason: string;
}

export interface StageValidationReport {
    stageNumber: number;
    stageName: string;
    stageStatus: 'pending' | 'active' | 'completed' | 'processed';
    isReadyToProcess: boolean;
    groups: {
        total: number;
        completed: number;
        isValid: boolean;
        names: string[];
    };
    teams: {
        total: number;
        participating: number;
        isValid: boolean;
    };
    matches: {
        total: number;
        completed: number;
        isValid: boolean;
    };
    results: {
        expected: number;
        recorded: number;
        missing: number;
        invalid: number;
        isValid: boolean;
    };
    scoringValid: boolean;
    validationErrors: string[];
    missingResults: StageMissingResult[];
    invalidResults: StageInvalidResult[];
    validationStatus: StageValidationStatus;
    processingStatus: StageProcessingStatus;
    validatedAt?: string;
    validatedBy?: string;
}

export interface QualifiedTeamEntry {
    rank: number;
    teamId: string;
    teamName: string;
    groupId: string;
    groupName: string;
    totalPoints: number;
    placementPoints: number;
    killPoints: number;
    matches: number;
    isOverridden?: boolean;
    overrideReason?: string;
    overriddenBy?: string;
    overriddenAt?: string;
}

export interface EliminatedTeamEntry {
    rank: number;
    teamId: string;
    teamName: string;
    groupId: string;
    groupName: string;
    totalPoints: number;
    placementPoints: number;
    killPoints: number;
    matches: number;
    isOverridden?: boolean;
    overrideReason?: string;
    overriddenBy?: string;
    overriddenAt?: string;
}

export interface StageQualificationPreview {
    stageNumber: number;
    stageName: string;
    advancingPerGroup: number;
    qualificationType: 'top_n_per_group' | 'total_top_n' | 'final_ranking';
    totalQualified: number;
    totalEliminated: number;
    qualified: QualifiedTeamEntry[];
    eliminated: EliminatedTeamEntry[];
    tiesRequiringReview: Array<{
        groupId: string;
        groupName: string;
        teamId: string;
        teamName: string;
        points: number;
    }>;
    isFinalStage: boolean;
    status: StageQualificationStatus;
}

export interface TournamentStageSummaryItem {
    id: string;
    title: string;
    game: string;
    format: string;
    status: string;
    hostUid: string;
    orgId?: string;
    orgName: string;
    currentStage: number;
    totalStages: number;
    stages: StageValidationReport[];
    // Rollup metrics
    totalGroups: number;
    totalTeams: number;
    totalMatches: number;
    completedResults: number;
    missingResultsCount: number;
    invalidResultsCount: number;
    validationStatus: StageValidationStatus;
    processingStatus: StageProcessingStatus;
    qualificationStatus: StageQualificationStatus;
    settlementStatus: 'PENDING' | 'READY_FOR_RELEASE' | 'SETTLED' | 'PENALTY_APPLIED';
    completedAt?: string;
    resultDeadlineAt?: string;
    isOverdue: boolean;
    hoursRemaining: number;
    penaltyApplied: boolean;
    penaltyAmount: number;
}

export interface StageAuditLogEntry {
    id: string;
    timestamp: string;
    actor: {
        uid: string;
        email?: string;
        role: string;
    };
    action:
        | 'STAGE_VALIDATED'
        | 'STAGE_PROCESSING_STARTED'
        | 'STAGE_PROCESSED'
        | 'QUALIFICATION_GENERATED'
        | 'QUALIFICATION_OVERRIDDEN'
        | 'NEXT_STAGE_CREATED'
        | 'RESULT_CORRECTED'
        | 'RESULT_REOPENED'
        | 'RESULT_PUBLISHED'
        | 'RESULT_LOCKED'
        | 'PROFIT_RELEASED'
        | 'LOCK_AMOUNT_RELEASED'
        | 'PENALTY_APPLIED';
    eventId: string;
    eventTitle?: string;
    stageNumber?: number;
    matchId?: string;
    teamId?: string;
    teamName?: string;
    previousState?: any;
    newState?: any;
    reason?: string;
    transactionId?: string;
    details?: string;
}

export interface StageFilterOptions {
    searchQuery?: string;
    statusFilter?: string;
    validationFilter?: 'ALL' | 'PASSED' | 'FAILED' | 'PENDING';
    processingFilter?: 'ALL' | 'NOT_READY' | 'READY' | 'PROCESSED';
    missingFilter?: boolean;
    invalidFilter?: boolean;
    overdueFilter?: boolean;
    organizerFilter?: string;
}
