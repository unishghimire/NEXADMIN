import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { adminDb } from '../_lib/firebaseAdmin';
import { logAuditEvent } from '../_lib/auditLogger';
import { isValidId, isNonEmptyString, sanitizeString, getHeaderString } from '../_lib/validation';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type {
    StageValidationReport,
    StageMissingResult,
    StageInvalidResult,
    StageQualificationPreview,
    QualifiedTeamEntry,
    EliminatedTeamEntry,
    TournamentStageSummaryItem,
    StageActionType
} from '../../src/shared/types/stage-validation';

// Default Free Fire placement points
const DEFAULT_PLACEMENT_POINTS: Record<string, number> = {
    '1': 12, '2': 9, '3': 8, '4': 7, '5': 6,
    '6': 5, '7': 4, '8': 3, '9': 2, '10': 1,
    '11': 0, '12': 0
};

interface ScoringConfig {
    killPoints: number;
    placementPoints: Record<string, number>;
}

function resolveScoringConfig(tournamentData: any): ScoringConfig {
    if (tournamentData.scoringSnapshot?.placementPoints) {
        return {
            killPoints: Number(tournamentData.scoringSnapshot.killPoints) || 1,
            placementPoints: tournamentData.scoringSnapshot.placementPoints
        };
    }
    if (tournamentData.pointSystem?.placementPoints) {
        const map: Record<string, number> = {};
        for (const p of tournamentData.pointSystem.placementPoints) {
            map[String(p.rank)] = Number(p.points) || 0;
        }
        return {
            killPoints: Number(tournamentData.pointSystem.pointsPerKill) || 1,
            placementPoints: map
        };
    }
    return {
        killPoints: 1,
        placementPoints: DEFAULT_PLACEMENT_POINTS
    };
}

function calculateTeamScore(pos: number, kills: number, scoring: ScoringConfig) {
    const p = Math.max(1, Math.floor(Number(pos) || 1));
    const k = Math.max(0, Math.floor(Number(kills) || 0));
    const placementPoints = scoring.placementPoints[String(p)] ?? 0;
    const killPoints = k * scoring.killPoints;
    const totalPoints = placementPoints + killPoints;
    return { placementPoints, killPoints, totalPoints };
}

/**
 * Server-Side Stage Validator:
 * Inspects all groups, teams, matches, and results for a given stage of a tournament.
 */
function validateStageServerSide(tournamentData: any, stageNum: number): {
    report: StageValidationReport;
    qualificationPreview: StageQualificationPreview | null;
} {
    const stageNumber = Number(stageNum) || 1;
    const stagesConfig = Array.isArray(tournamentData.stages) ? tournamentData.stages : [];
    const stageConfig = stagesConfig.find((s: any) => s.stageNumber === stageNumber) || {
        stageNumber,
        name: `Stage ${stageNumber}`,
        stageType: stageNumber === 1 ? 'qualifiers' : 'quarter_finals',
        advancingPerGroup: 6,
        status: 'active'
    };

    const allGroups = Array.isArray(tournamentData.groups) ? tournamentData.groups : [];
    // Groups for this stage: check g.stageNumber === stageNumber or fallback to all groups if no stageNumber specified on group
    const stageGroups = allGroups.filter((g: any) => {
        if (g.stageNumber !== undefined && g.stageNumber !== null) {
            return Number(g.stageNumber) === stageNumber;
        }
        // If unassigned, assign to stage 1
        return stageNumber === 1;
    });

    const scoring = resolveScoringConfig(tournamentData);
    const scoringValid = typeof scoring.killPoints === 'number' && scoring.killPoints >= 0 && !!scoring.placementPoints;

    let totalTeamsInStage = 0;
    let totalMatchesInStage = 0;
    let completedMatchesInStage = 0;
    let expectedResults = 0;
    let recordedResults = 0;

    const missingResults: StageMissingResult[] = [];
    const invalidResults: StageInvalidResult[] = [];
    const validationErrors: string[] = [];

    // Group standings for qualification calculation
    const groupStandingsMap: Record<string, {
        groupId: string;
        groupName: string;
        teams: Array<{
            teamId: string;
            teamName: string;
            totalPoints: number;
            placementPoints: number;
            killPoints: number;
            matches: number;
            bestPlacement: number;
        }>;
    }> = {};

    for (const group of stageGroups) {
        const teams = Array.isArray(group.teams) ? group.teams : [];
        const matches = Array.isArray(group.matches) ? group.matches : [];

        totalTeamsInStage += teams.length;
        totalMatchesInStage += matches.length;

        const teamStatsMap: Record<string, {
            teamId: string;
            teamName: string;
            totalPoints: number;
            placementPoints: number;
            killPoints: number;
            matches: number;
            bestPlacement: number;
        }> = {};

        // Initialize team stats
        for (const t of teams) {
            teamStatsMap[t.id] = {
                teamId: t.id,
                teamName: t.name || t.teamName || 'Unknown Team',
                totalPoints: 0,
                placementPoints: 0,
                killPoints: 0,
                matches: 0,
                bestPlacement: 999
            };
        }

        for (let mIdx = 0; mIdx < matches.length; mIdx++) {
            const match = matches[mIdx];
            const matchNumber = match.matchNumber || mIdx + 1;
            const roundNumber = match.round || 1;
            const matchResults = Array.isArray(match.results) ? match.results : [];

            if (match.status === 'completed') {
                completedMatchesInStage++;
            }

            // In Battle Royale lobbies, every registered team must participate in each match
            const placementSet = new Set<number>();
            const seenTeamIds = new Set<string>();

            for (const team of teams) {
                expectedResults++;
                const resultEntry = matchResults.find((r: any) => r.teamId === team.id || r.participantId === team.id);

                if (!resultEntry) {
                    missingResults.push({
                        groupId: group.id,
                        groupName: group.name,
                        teamId: team.id,
                        teamName: team.name || team.teamName || 'Team',
                        matchId: match.id,
                        matchNumber,
                        roundNumber,
                        map: match.map || 'Default',
                        reason: match.status !== 'completed' ? 'Match is not completed' : 'No result recorded for team'
                    });
                } else {
                    recordedResults++;
                    seenTeamIds.add(team.id);

                    const pos = Number(resultEntry.placement || resultEntry.position);
                    const kls = Number(resultEntry.kills);

                    // Check for invalid placement or kills
                    if (isNaN(pos) || pos < 1) {
                        invalidResults.push({
                            groupId: group.id,
                            groupName: group.name,
                            teamId: team.id,
                            teamName: team.name || team.teamName || 'Team',
                            matchId: match.id,
                            matchNumber,
                            placement: pos,
                            kills: kls,
                            reason: `Placement must be >= 1 (got ${resultEntry.placement})`
                        });
                    }

                    if (isNaN(kls) || kls < 0) {
                        invalidResults.push({
                            groupId: group.id,
                            groupName: group.name,
                            teamId: team.id,
                            teamName: team.name || team.teamName || 'Team',
                            matchId: match.id,
                            matchNumber,
                            placement: pos,
                            kills: kls,
                            reason: `Kills must be >= 0 (got ${resultEntry.kills})`
                        });
                    }

                    // Check for duplicate placement in the same match
                    if (pos >= 1) {
                        if (placementSet.has(pos)) {
                            invalidResults.push({
                                groupId: group.id,
                                groupName: group.name,
                                teamId: team.id,
                                teamName: team.name || team.teamName || 'Team',
                                matchId: match.id,
                                matchNumber,
                                placement: pos,
                                kills: kls,
                                reason: `Duplicate placement: Multiple teams finished in Position ${pos}`
                            });
                        }
                        placementSet.add(pos);
                    }

                    // Recalculate score server-side
                    const scored = calculateTeamScore(pos, kls, scoring);
                    const stats = teamStatsMap[team.id];
                    if (stats) {
                        stats.matches += 1;
                        stats.placementPoints += scored.placementPoints;
                        stats.killPoints += scored.killPoints;
                        stats.totalPoints += scored.totalPoints;
                        stats.bestPlacement = Math.min(stats.bestPlacement, pos);
                    }
                }
            }

            // Check if there are results for teams NOT registered in this group
            for (const r of matchResults) {
                const teamId = r.teamId || r.participantId;
                if (!teams.some((t: any) => t.id === teamId)) {
                    invalidResults.push({
                        groupId: group.id,
                        groupName: group.name,
                        teamId: teamId || 'unknown',
                        teamName: r.teamName || 'Unknown Team',
                        matchId: match.id,
                        matchNumber,
                        placement: r.placement,
                        kills: r.kills,
                        reason: `Team does not belong to ${group.name}`
                    });
                }
            }
        }

        groupStandingsMap[group.id] = {
            groupId: group.id,
            groupName: group.name,
            teams: Object.values(teamStatsMap)
        };
    }

    if (stageGroups.length === 0) {
        validationErrors.push(`No groups configured for Stage ${stageNumber}`);
    }
    if (totalTeamsInStage === 0) {
        validationErrors.push(`No teams registered in Stage ${stageNumber}`);
    }
    if (totalMatchesInStage === 0) {
        validationErrors.push(`No matches scheduled for Stage ${stageNumber}`);
    }
    if (missingResults.length > 0) {
        validationErrors.push(`${missingResults.length} required result(s) are missing`);
    }
    if (invalidResults.length > 0) {
        validationErrors.push(`${invalidResults.length} invalid result(s) detected`);
    }
    if (!scoringValid) {
        validationErrors.push('Scoring configuration is invalid');
    }

    const isGroupsValid = stageGroups.length > 0;
    const isTeamsValid = totalTeamsInStage > 0;
    const isMatchesValid = totalMatchesInStage > 0 && totalMatchesInStage === completedMatchesInStage;
    const isResultsValid = expectedResults > 0 && missingResults.length === 0 && invalidResults.length === 0;

    const isReadyToProcess = isGroupsValid && isTeamsValid && isMatchesValid && isResultsValid && scoringValid;
    const isAlreadyProcessed = stageConfig.status === 'processed' || tournamentData.processedStages?.[stageNumber] === true;

    const report: StageValidationReport = {
        stageNumber,
        stageName: stageConfig.name || `Stage ${stageNumber}`,
        stageStatus: isAlreadyProcessed ? 'processed' : (isMatchesValid && isResultsValid ? 'completed' : 'active'),
        isReadyToProcess: isReadyToProcess && !isAlreadyProcessed,
        groups: {
            total: stageGroups.length,
            completed: stageGroups.filter((g: any) => g.status === 'completed' || (g.matches?.length > 0 && g.matches.every((m: any) => m.status === 'completed'))).length,
            isValid: isGroupsValid,
            names: stageGroups.map((g: any) => g.name)
        },
        teams: {
            total: totalTeamsInStage,
            participating: totalTeamsInStage,
            isValid: isTeamsValid
        },
        matches: {
            total: totalMatchesInStage,
            completed: completedMatchesInStage,
            isValid: isMatchesValid
        },
        results: {
            expected: expectedResults,
            recorded: recordedResults,
            missing: missingResults.length,
            invalid: invalidResults.length,
            isValid: isResultsValid
        },
        scoringValid,
        validationErrors,
        missingResults,
        invalidResults,
        validationStatus: isReadyToProcess || isAlreadyProcessed ? 'PASSED' : 'FAILED',
        processingStatus: isAlreadyProcessed ? 'PROCESSED' : (isReadyToProcess ? 'READY' : 'NOT_READY'),
        validatedAt: new Date().toISOString()
    };

    // Build Qualification Preview if results are ready or partially ready
    let qualificationPreview: StageQualificationPreview | null = null;
    const advancingPerGroup = Number(stageConfig.advancingPerGroup) || 6;
    const isFinalStage = stageNumber >= (stagesConfig.length || 1);

    const qualifiedTeams: QualifiedTeamEntry[] = [];
    const eliminatedTeams: EliminatedTeamEntry[] = [];
    const tiesRequiringReview: Array<{ groupId: string; groupName: string; teamId: string; teamName: string; points: number }> = [];

    const overrides = tournamentData.qualificationOverrides?.[stageNumber] || {};

    for (const groupKey of Object.keys(groupStandingsMap)) {
        const groupData = groupStandingsMap[groupKey];
        // Sort teams with authoritative tie-breakers:
        // 1. totalPoints desc
        // 2. placementPoints desc
        // 3. killPoints desc
        // 4. bestPlacement asc (1st is better than 2nd)
        // 5. teamName asc
        const sorted = [...groupData.teams].sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            if (b.placementPoints !== a.placementPoints) return b.placementPoints - a.placementPoints;
            if (b.killPoints !== a.killPoints) return b.killPoints - a.killPoints;
            if (a.bestPlacement !== b.bestPlacement) return a.bestPlacement - b.bestPlacement;
            return a.teamName.localeCompare(b.teamName);
        });

        // Check for ties at the cutoff
        if (sorted.length > advancingPerGroup) {
            const lastQual = sorted[advancingPerGroup - 1];
            const firstElim = sorted[advancingPerGroup];
            if (lastQual && firstElim && lastQual.totalPoints === firstElim.totalPoints) {
                tiesRequiringReview.push({
                    groupId: groupData.groupId,
                    groupName: groupData.groupName,
                    teamId: firstElim.teamId,
                    teamName: firstElim.teamName,
                    points: firstElim.totalPoints
                });
            }
        }

        sorted.forEach((team, idx) => {
            const calculatedQualifies = idx < advancingPerGroup;
            const override = overrides[team.teamId];
            const effectiveQualifies = override ? (override.status === 'qualified') : calculatedQualifies;

            const entryBase = {
                rank: idx + 1,
                teamId: team.teamId,
                teamName: team.teamName,
                groupId: groupData.groupId,
                groupName: groupData.groupName,
                totalPoints: team.totalPoints,
                placementPoints: team.placementPoints,
                killPoints: team.killPoints,
                matches: team.matches,
                isOverridden: !!override,
                overrideReason: override?.reason,
                overriddenBy: override?.overriddenBy,
                overriddenAt: override?.overriddenAt
            };

            if (effectiveQualifies) {
                qualifiedTeams.push(entryBase);
            } else {
                eliminatedTeams.push(entryBase);
            }
        });
    }

    qualificationPreview = {
        stageNumber,
        stageName: stageConfig.name || `Stage ${stageNumber}`,
        advancingPerGroup,
        qualificationType: 'top_n_per_group',
        totalQualified: qualifiedTeams.length,
        totalEliminated: eliminatedTeams.length,
        qualified: qualifiedTeams,
        eliminated: eliminatedTeams,
        tiesRequiringReview,
        isFinalStage,
        status: isAlreadyProcessed ? 'FINALIZED' : (tiesRequiringReview.length > 0 ? 'PENDING' : 'PREVIEW_READY')
    };

    return { report, qualificationPreview };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const clientIp = getHeaderString(req.headers['x-forwarded-for']).split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = getHeaderString(req.headers['user-agent']);

    // ═══════════════════════════════════════════════════════════════
    // GET: Fetch Stage Validation / Overview
    // ═══════════════════════════════════════════════════════════════
    if (req.method === 'GET') {
        const tournamentId = String(req.query.tournamentId || '').trim();
        const stageNum = parseInt(String(req.query.stageNumber || '1'), 10) || 1;

        // Specific tournament stage query
        if (tournamentId) {
            const tournRef = adminDb.collection('tournaments').doc(tournamentId);
            const tournSnap = await tournRef.get();
            if (!tournSnap.exists) {
                return res.status(404).json({ error: 'Tournament not found' });
            }
            const tournData = tournSnap.data()!;

            // Compute validation for all stages of this tournament
            const stagesConfig = Array.isArray(tournData.stages) ? tournData.stages : [];
            const stageReports: StageValidationReport[] = [];
            const stageCount = Math.max(1, stagesConfig.length);

            for (let s = 1; s <= stageCount; s++) {
                const { report } = validateStageServerSide(tournData, s);
                stageReports.push(report);
            }

            const currentStageValidation = validateStageServerSide(tournData, stageNum);

            // Fetch stage-related audit logs
            const auditsSnap = await adminDb.collection('resultAudits')
                .where('eventId', '==', tournamentId)
                .limit(50)
                .get();

            const auditLogs = auditsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            return res.status(200).json({
                tournamentId,
                title: tournData.title,
                currentStage: Number(tournData.currentStage || 1),
                stageReports,
                selectedStageReport: currentStageValidation.report,
                qualificationPreview: currentStageValidation.qualificationPreview,
                auditLogs
            });
        }

        // List mode: Summarize all tournaments with stage validation health
        try {
            const tournamentsSnap = await adminDb.collection('tournaments')
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();

            const summaries: TournamentStageSummaryItem[] = [];

            for (const doc of tournamentsSnap.docs) {
                const data = doc.data();
                const stagesConfig = Array.isArray(data.stages) ? data.stages : [];
                const totalStages = Math.max(1, stagesConfig.length);
                const currentStageNum = Number(data.currentStage || 1);

                // Run validation for current stage
                const { report } = validateStageServerSide(data, currentStageNum);

                const now = Date.now();
                const completedAtMs = data.completedAt ? new Date(data.completedAt).getTime() : null;
                const deadlineMs = completedAtMs ? completedAtMs + (48 * 3600 * 1000) : null;
                const isOverdue = deadlineMs ? now > deadlineMs && !data.resultPublishedAt : false;
                const hoursRemaining = deadlineMs ? Math.max(0, Math.round((deadlineMs - now) / 3600000)) : 48;

                const baseAmount = Number(data.prizePool || data.entryFeeTotal || 500);
                const penaltyAmount = Math.max(50, Math.round(baseAmount * 0.10));

                summaries.push({
                    id: doc.id,
                    title: data.title || 'Untitled Tournament',
                    game: data.game || 'Free Fire',
                    format: data.format || 'Battle Royale',
                    status: data.status || 'upcoming',
                    hostUid: data.hostUid || '',
                    orgId: data.orgId,
                    orgName: data.orgName || data.organizerName || 'NexPlay Esports',
                    currentStage: currentStageNum,
                    totalStages,
                    stages: [report],
                    totalGroups: report.groups.total,
                    totalTeams: report.teams.total,
                    totalMatches: report.matches.total,
                    completedResults: report.results.recorded,
                    missingResultsCount: report.results.missing,
                    invalidResultsCount: report.results.invalid,
                    validationStatus: report.validationStatus,
                    processingStatus: report.processingStatus,
                    qualificationStatus: data.processedStages?.[currentStageNum] ? 'FINALIZED' : (report.isReadyToProcess ? 'PREVIEW_READY' : 'PENDING'),
                    settlementStatus: data.penaltyApplied ? 'PENALTY_APPLIED' : (data.tournamentEarningsReleased ? 'SETTLED' : (data.resultStatus === 'PUBLISHED' ? 'READY_FOR_RELEASE' : 'PENDING')),
                    completedAt: data.completedAt,
                    resultDeadlineAt: deadlineMs ? new Date(deadlineMs).toISOString() : undefined,
                    isOverdue,
                    hoursRemaining,
                    penaltyApplied: !!data.penaltyApplied,
                    penaltyAmount
                });
            }

            return res.status(200).json({ tournaments: summaries });
        } catch (err: any) {
            console.error('Failed to list tournament stages:', err);
            return res.status(500).json({ error: 'Failed to retrieve tournament stages summary' });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // POST: Stage Actions (Validate, Process, Override, Correct)
    // ═══════════════════════════════════════════════════════════════
    if (req.method === 'POST') {
        const body = req.body || {};
        const action: StageActionType = body.action;
        const tournamentId = String(body.tournamentId || '').trim();
        const stageNumber = parseInt(String(body.stageNumber || '1'), 10) || 1;
        const reason = sanitizeString(body.reason || '');

        if (!isValidId(tournamentId)) {
            return res.status(400).json({ error: 'Invalid or missing tournament ID' });
        }

        const tournRef = adminDb.collection('tournaments').doc(tournamentId);
        const tournSnap = await tournRef.get();
        if (!tournSnap.exists) {
            return res.status(404).json({ error: 'Tournament not found' });
        }
        const tournamentData = tournSnap.data()!;

        // ─────────────────────────────────────────────────────────────
        // 1. VALIDATE STAGE
        // ─────────────────────────────────────────────────────────────
        if (action === 'VALIDATE_STAGE') {
            const { report, qualificationPreview } = validateStageServerSide(tournamentData, stageNumber);

            await logAuditEvent({
                adminId: admin.uid,
                adminEmail: admin.email,
                action: 'STAGE_VALIDATED',
                resource: 'tournaments',
                targetId: tournamentId,
                details: {
                    stageNumber,
                    validationStatus: report.validationStatus,
                    missingResultsCount: report.results.missing,
                    invalidResultsCount: report.results.invalid
                },
                ip: clientIp,
                userAgent
            });

            return res.status(200).json({
                success: true,
                stageNumber,
                report,
                qualificationPreview
            });
        }

        // ─────────────────────────────────────────────────────────────
        // 2. PROCESS STAGE (STRICT SERVER-SIDE ENFORCEMENT)
        // ─────────────────────────────────────────────────────────────
        if (action === 'PROCESS_STAGE') {
            // STRICT RULE: Backend MUST independently re-validate before processing!
            const { report, qualificationPreview } = validateStageServerSide(tournamentData, stageNumber);

            if (!report.isReadyToProcess) {
                return res.status(400).json({
                    error: 'Stage cannot be processed: results are incomplete or invalid',
                    report,
                    missingResults: report.missingResults,
                    invalidResults: report.invalidResults
                });
            }

            // PREVENT DUPLICATE PROCESSING
            if (report.stageStatus === 'processed' || tournamentData.processedStages?.[stageNumber] === true) {
                return res.status(409).json({
                    error: `Stage ${stageNumber} has already been processed. Duplicate processing is blocked.`
                });
            }

            if (!qualificationPreview) {
                return res.status(400).json({ error: 'Failed to generate qualification preview for stage' });
            }

            const now = new Date();
            const stagesConfig = Array.isArray(tournamentData.stages) ? tournamentData.stages : [];
            const nextStageNumber = stageNumber + 1;
            const hasNextStage = stagesConfig.some((s: any) => s.stageNumber === nextStageNumber);

            try {
                await adminDb.runTransaction(async (t) => {
                    const freshSnap = await t.get(tournRef);
                    const freshData = freshSnap.data()!;

                    if (freshData.processedStages?.[stageNumber] === true) {
                        throw new Error('DUPLICATE_PROCESSING_LOCKED');
                    }

                    const updates: Record<string, any> = {
                        [`processedStages.${stageNumber}`]: true,
                        [`stageResults.${stageNumber}`]: {
                            processedAt: now.toISOString(),
                            processedBy: admin.uid,
                            qualifiedTeams: qualificationPreview.qualified,
                            eliminatedTeams: qualificationPreview.eliminated
                        },
                        updatedAt: FieldValue.serverTimestamp()
                    };

                    // Advance to Next Stage if configured
                    if (hasNextStage) {
                        const nextStageConfig = stagesConfig.find((s: any) => s.stageNumber === nextStageNumber);
                        const qualifiedTeamObjects = qualificationPreview.qualified.map(q => ({
                            id: q.teamId,
                            name: q.teamName
                        }));

                        // Generate groups for next stage (cross-group distribution)
                        const numNextGroups = nextStageConfig?.groupsCount || 1;
                        const teamsPerNextGroup = Math.ceil(qualifiedTeamObjects.length / numNextGroups);
                        const nextGroups: any[] = [];

                        for (let g = 0; g < numNextGroups; g++) {
                            const groupName = `Group ${String.fromCharCode(65 + g)}`;
                            const groupTeams = qualifiedTeamObjects.slice(g * teamsPerNextGroup, (g + 1) * teamsPerNextGroup);
                            nextGroups.push({
                                id: `stage${nextStageNumber}_group${String.fromCharCode(65 + g).toLowerCase()}`,
                                stageNumber: nextStageNumber,
                                name: groupName,
                                teams: groupTeams,
                                matches: [],
                                status: 'upcoming'
                            });
                        }

                        updates.currentStage = nextStageNumber;
                        // Append next stage groups into existing groups array
                        const existingGroups = Array.isArray(freshData.groups) ? freshData.groups : [];
                        updates.groups = [...existingGroups, ...nextGroups];
                    } else {
                        // FINAL STAGE COMPLETED
                        updates.status = 'completed';
                        updates.completedAt = now.toISOString();
                        updates.resultPublishedAt = now.toISOString();
                        updates.resultPublishedBy = admin.uid;
                        updates.resultStatus = 'PUBLISHED';
                        updates.resultDeadlineAt = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();

                        // Financial Settlement: Paid vs Free
                        const isPaid = (Number(freshData.entryFee) > 0) || (Number(freshData.prizePool) > 0);
                        const prizePool = Number(freshData.prizePool || 0);

                        if (isPaid && prizePool > 0) {
                            const orgShare = Math.round(prizePool * 0.80);
                            const nexplayShare = Math.round(prizePool * 0.20);

                            const earningsRef = adminDb.collection('tournamentEarnings').doc(tournamentId);
                            t.set(earningsRef, {
                                id: tournamentId,
                                tournamentId,
                                tournamentTitle: freshData.title || 'Tournament',
                                orgId: freshData.orgId || freshData.hostUid,
                                orgName: freshData.orgName || freshData.organizerName || 'Organizer',
                                totalPrizePool: prizePool,
                                orgShare,
                                nexplayShare,
                                platformCutPercentage: 20,
                                status: 'pending',
                                createdAt: FieldValue.serverTimestamp(),
                                eligibleForReleaseAt: now.toISOString()
                            }, { merge: true });
                        }
                    }

                    t.update(tournRef, updates);

                    // Write audit record inside transaction batch
                    const auditRef = adminDb.collection('resultAudits').doc();
                    t.set(auditRef, {
                        id: auditRef.id,
                        eventId: tournamentId,
                        eventType: 'tournament',
                        stageNumber,
                        action: hasNextStage ? 'STAGE_PROCESSED' : 'FINAL_STAGE_COMPLETED',
                        adminId: admin.uid,
                        adminEmail: admin.email,
                        qualifiedCount: qualificationPreview.qualified.length,
                        eliminatedCount: qualificationPreview.eliminated.length,
                        hasNextStage,
                        timestamp: FieldValue.serverTimestamp()
                    });
                });

                await logAuditEvent({
                    adminId: admin.uid,
                    adminEmail: admin.email,
                    action: 'STAGE_PROCESSED',
                    resource: 'tournaments',
                    targetId: tournamentId,
                    details: {
                        stageNumber,
                        hasNextStage,
                        qualifiedCount: qualificationPreview.qualified.length
                    },
                    ip: clientIp,
                    userAgent
                });

                return res.status(200).json({
                    success: true,
                    message: hasNextStage ? `Stage ${stageNumber} processed! Advanced to Stage ${nextStageNumber}.` : `Final Stage ${stageNumber} processed! Tournament completed.`,
                    hasNextStage,
                    nextStageNumber: hasNextStage ? nextStageNumber : undefined,
                    qualifiedTeams: qualificationPreview.qualified,
                    eliminatedTeams: qualificationPreview.eliminated
                });
            } catch (err: any) {
                if (err.message === 'DUPLICATE_PROCESSING_LOCKED') {
                    return res.status(409).json({ error: 'Stage was already processed by another administrator.' });
                }
                console.error('Error processing stage:', err);
                return res.status(500).json({ error: err.message || 'Failed to process tournament stage' });
            }
        }

        // ─────────────────────────────────────────────────────────────
        // 3. OVERRIDE QUALIFICATION (AUDITED OVERRIDE PROCESS)
        // ─────────────────────────────────────────────────────────────
        if (action === 'OVERRIDE_QUALIFICATION') {
            const teamId = String(body.teamId || '').trim();
            const newStatus = body.newStatus === 'qualified' ? 'qualified' : 'eliminated';

            if (!teamId) return res.status(400).json({ error: 'Team ID is required' });
            if (!reason || reason.length < 5) {
                return res.status(400).json({ error: 'A detailed reason (min 5 characters) is mandatory to override qualification' });
            }

            const overrideEntry = {
                status: newStatus,
                reason,
                overriddenBy: admin.uid,
                overriddenEmail: admin.email,
                overriddenAt: new Date().toISOString()
            };

            await tournRef.update({
                [`qualificationOverrides.${stageNumber}.${teamId}`]: overrideEntry,
                updatedAt: FieldValue.serverTimestamp()
            });

            await adminDb.collection('resultAudits').add({
                eventId: tournamentId,
                eventType: 'tournament',
                stageNumber,
                teamId,
                action: 'QUALIFICATION_OVERRIDDEN',
                reason,
                newStatus,
                adminId: admin.uid,
                adminEmail: admin.email,
                timestamp: FieldValue.serverTimestamp()
            });

            await logAuditEvent({
                adminId: admin.uid,
                adminEmail: admin.email,
                action: 'QUALIFICATION_OVERRIDDEN',
                resource: 'tournaments',
                targetId: tournamentId,
                details: { stageNumber, teamId, newStatus, reason },
                ip: clientIp,
                userAgent
            });

            return res.status(200).json({
                success: true,
                message: `Qualification successfully overridden for team ${teamId}`,
                override: overrideEntry
            });
        }

        // ─────────────────────────────────────────────────────────────
        // 4. CORRECT RESULT / REOPEN RESULT
        // ─────────────────────────────────────────────────────────────
        if (action === 'CORRECT_RESULT' || action === 'REOPEN_RESULT') {
            if (!reason || reason.length < 5) {
                return res.status(400).json({ error: 'A detailed reason (min 5 characters) is required for result correction or reopening' });
            }

            if (action === 'REOPEN_RESULT') {
                await tournRef.update({
                    resultStatus: 'RESULT_REOPENED',
                    updatedAt: FieldValue.serverTimestamp()
                });

                await adminDb.collection('resultAudits').add({
                    eventId: tournamentId,
                    eventType: 'tournament',
                    stageNumber,
                    action: 'RESULT_REOPENED',
                    reason,
                    adminId: admin.uid,
                    adminEmail: admin.email,
                    timestamp: FieldValue.serverTimestamp()
                });

                return res.status(200).json({ success: true, message: 'Result reopened for editing' });
            }

            // Single team match correction
            const matchId = String(body.matchId || '').trim();
            const teamId = String(body.teamId || '').trim();
            const placement = parseInt(String(body.placement), 10);
            const kills = parseInt(String(body.kills), 10);

            if (!matchId || !teamId || isNaN(placement) || isNaN(kills)) {
                return res.status(400).json({ error: 'Missing matchId, teamId, placement, or kills' });
            }

            const scoring = resolveScoringConfig(tournamentData);
            const scored = calculateTeamScore(placement, kills, scoring);

            const allGroups = Array.isArray(tournamentData.groups) ? [...tournamentData.groups] : [];
            let matchFound = false;

            for (const group of allGroups) {
                const matches = Array.isArray(group.matches) ? group.matches : [];
                for (const match of matches) {
                    if (match.id === matchId) {
                        const results = Array.isArray(match.results) ? [...match.results] : [];
                        const rIdx = results.findIndex((r: any) => r.teamId === teamId || r.participantId === teamId);
                        const newEntry = {
                            teamId,
                            placement,
                            kills,
                            placementPoints: scored.placementPoints,
                            killPoints: scored.killPoints,
                            totalPoints: scored.totalPoints
                        };

                        if (rIdx >= 0) {
                            results[rIdx] = { ...results[rIdx], ...newEntry };
                        } else {
                            results.push(newEntry);
                        }
                        match.results = results;
                        matchFound = true;
                        break;
                    }
                }
                if (matchFound) break;
            }

            if (!matchFound) {
                return res.status(404).json({ error: 'Match not found in tournament groups' });
            }

            await tournRef.update({
                groups: allGroups,
                updatedAt: FieldValue.serverTimestamp()
            });

            await adminDb.collection('resultAudits').add({
                eventId: tournamentId,
                eventType: 'tournament',
                stageNumber,
                matchId,
                teamId,
                action: 'RESULT_CORRECTED',
                reason,
                newPlacement: placement,
                newKills: kills,
                adminId: admin.uid,
                adminEmail: admin.email,
                timestamp: FieldValue.serverTimestamp()
            });

            return res.status(200).json({
                success: true,
                message: 'Result corrected and re-scored successfully',
                scored
            });
        }

        return res.status(400).json({ error: `Unsupported action: ${action}` });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
