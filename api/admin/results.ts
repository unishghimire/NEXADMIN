import type { VercelRequest, VercelResponse } from '../_lib/types';
import { requireAdmin } from '../_lib/authMiddleware';
import { adminDb } from '../_lib/firebaseAdmin';
import { logAuditEvent } from '../_lib/auditLogger';
import { isValidId, isNonEmptyString, sanitizeString, getHeaderString } from '../_lib/validation';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// Default Free Fire placement points
const DEFAULT_PLACEMENT_POINTS: Record<string, number> = {
    '1': 12, '2': 9, '3': 8, '4': 7, '5': 6,
    '6': 5, '7': 4, '8': 3, '9': 2, '10': 1,
    '11': 0, '12': 0
};

interface ServerScoringConfig {
    mode: 'NORMAL' | 'PER_KILL';
    killPoints: number;
    placementPoints: Record<string, number>;
    rewardPerKill?: number;
    minimumKillsForReward?: number;
    currency?: string;
}

/**
 * Server-side score calculator for a single participant.
 * Prevents client-side manipulation of points or rewards.
 */
function calculateParticipantScore(
    placement: number,
    kills: number,
    scoring: ServerScoringConfig,
    bonus: number = 0,
    penalty: number = 0
): { placementPoints: number; killPoints: number; totalPoints: number; rewardAmount: number } {
    const pos = Math.max(1, Math.floor(Number(placement) || 1));
    const kls = Math.max(0, Math.floor(Number(kills) || 0));
    const bns = Math.max(0, Math.floor(Number(bonus) || 0));
    const pnl = Math.max(0, Math.floor(Number(penalty) || 0));

    if (scoring.mode === 'PER_KILL') {
        const rewardPerKill = Number(scoring.rewardPerKill) || 10;
        const minKills = Number(scoring.minimumKillsForReward) || 0;
        const rewardAmount = kls >= minKills ? Math.round(kls * rewardPerKill) : 0;
        return {
            placementPoints: 0,
            killPoints: kls,
            totalPoints: kls + bns - pnl,
            rewardAmount
        };
    }

    const placementPts = scoring.placementPoints[String(pos)] ?? 0;
    const killPts = kls * (Number(scoring.killPoints) || 1);
    const totalPts = placementPts + killPts + bns - pnl;

    return {
        placementPoints: placementPts,
        killPoints: killPts,
        totalPoints: totalPts,
        rewardAmount: 0
    };
}

/**
 * Helper to fetch event doc from tournaments or scrims
 */
async function fetchEventDoc(eventId: string, eventTypeHint?: string) {
    if (eventTypeHint === 'scrim') {
        const scrimRef = adminDb.collection('scrims').doc(eventId);
        const scrimSnap = await scrimRef.get();
        if (scrimSnap.exists) return { ref: scrimRef, snap: scrimSnap, type: 'scrim' as const };
    }

    const tournRef = adminDb.collection('tournaments').doc(eventId);
    const tournSnap = await tournRef.get();
    if (tournSnap.exists) {
        const data = tournSnap.data()!;
        const isScrim = data.matchType === 'scrims' || data.isScrim === true;
        return { ref: tournRef, snap: tournSnap, type: (isScrim ? 'scrim' : 'tournament') as 'scrim' | 'tournament' };
    }

    const fallbackScrimRef = adminDb.collection('scrims').doc(eventId);
    const fallbackScrimSnap = await fallbackScrimRef.get();
    if (fallbackScrimSnap.exists) return { ref: fallbackScrimRef, snap: fallbackScrimSnap, type: 'scrim' as const };

    return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const clientIp = getHeaderString(req.headers['x-forwarded-for']).split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = getHeaderString(req.headers['user-agent']);

    // ═══════════════════════════════════════════════════════════════
    // GET: Fetch event result data, 48h deadline status & audit trail
    // ═══════════════════════════════════════════════════════════════
    if (req.method === 'GET') {
        const eventId = String(req.query.eventId || '').trim();
        const eventType = String(req.query.eventType || '').trim();

        if (!isValidId(eventId)) {
            return res.status(400).json({ success: false, error: 'Invalid eventId' });
        }

        try {
            const eventResult = await fetchEventDoc(eventId, eventType);
            if (!eventResult) {
                return res.status(404).json({ success: false, error: 'Event not found' });
            }

            const { ref: eventRef, snap: eventSnap, type: actualType } = eventResult;
            const eventData = eventSnap.data()!;

            // ─── 1. Determine 48-Hour Deadline & Penalty ───
            const isCompleted = eventData.status === 'completed';
            let completedAtMs: number | null = null;

            if (eventData.completedAt) {
                completedAtMs = eventData.completedAt.toMillis ? eventData.completedAt.toMillis() : new Date(eventData.completedAt).getTime();
            } else if (isCompleted && eventData.updatedAt) {
                completedAtMs = eventData.updatedAt.toMillis ? eventData.updatedAt.toMillis() : new Date(eventData.updatedAt).getTime();
            }

            const deadlineMs = completedAtMs ? completedAtMs + (48 * 60 * 60 * 1000) : null;
            const now = Date.now();
            const isOverdue = Boolean(deadlineMs && now > deadlineMs && eventData.resultStatus !== 'PUBLISHED' && eventData.resultStatus !== 'LOCKED');

            let currentStatus = eventData.resultStatus || 'RESULT_PENDING';
            if (isCompleted && currentStatus !== 'PUBLISHED' && currentStatus !== 'LOCKED' && currentStatus !== 'RESULT_REOPENED') {
                currentStatus = isOverdue ? 'OVERDUE' : 'DEADLINE_ACTIVE';
            }

            // ─── Server-side Automatic 10% Penalty Application ───
            let penaltyApplied = Boolean(eventData.penaltyApplied);
            let penaltyAmount = Number(eventData.penaltyAmount) || 0;
            const prizePool = Number(eventData.prizePool) || 0;
            const entryFee = Number(eventData.entryFee) || 0;
            const registeredCount = Number(eventData.currentPlayers || eventData.filledSlots || 1);
            const penaltyBase = prizePool > 0 ? prizePool : (entryFee * registeredCount || 100);

            if (isOverdue && !penaltyApplied && isCompleted) {
                const calculatedPenalty = Math.max(50, Math.round(penaltyBase * 0.10));
                const orgId = eventData.orgId || eventData.hostUid;

                if (orgId) {
                    try {
                        await adminDb.runTransaction(async (tx) => {
                            const orgUserRef = adminDb.collection('users').doc(orgId);
                            const orgUserDoc = await tx.get(orgUserRef);

                            if (orgUserDoc.exists) {
                                tx.update(orgUserRef, {
                                    balance: FieldValue.increment(-calculatedPenalty),
                                    orgWalletBalance: FieldValue.increment(-calculatedPenalty),
                                    updatedAt: FieldValue.serverTimestamp()
                                });

                                const txRef = adminDb.collection('transactions').doc();
                                tx.set(txRef, {
                                    id: txRef.id,
                                    userId: orgId,
                                    username: eventData.orgName || 'Organizer',
                                    type: 'penalty',
                                    amount: calculatedPenalty,
                                    method: 'Platform 48-Hour Result Penalty (10%)',
                                    status: 'success',
                                    desc: `10% late result submission penalty for "${eventData.title}" (Overdue 48 hours)`,
                                    tournamentId: eventId,
                                    timestamp: FieldValue.serverTimestamp()
                                });

                                tx.update(eventRef, {
                                    penaltyApplied: true,
                                    penaltyAmount: calculatedPenalty,
                                    penaltyAppliedAt: FieldValue.serverTimestamp(),
                                    resultStatus: 'OVERDUE'
                                });
                            }
                        });

                        penaltyApplied = true;
                        penaltyAmount = calculatedPenalty;
                        currentStatus = 'OVERDUE';

                        await logAuditEvent({
                            adminId: 'system',
                            adminEmail: 'system@nexplay.gg',
                            action: 'RESULT_PENALTY_APPLIED',
                            resource: 'tournaments',
                            targetId: eventId,
                            details: { penaltyAmount, penaltyBase, deadlineMs, orgId },
                            ip: clientIp,
                            userAgent
                        });
                    } catch (penaltyErr) {
                        console.error('Failed to apply automatic 10% penalty:', penaltyErr);
                    }
                }
            }

            // ─── 2. Resolve Scoring Configuration ───
            const isPerKill = eventData.tournamentMode === 'PER_KILL_REWARD' || eventData.scrimMode === 'PER_KILL';
            const scoringConfig: ServerScoringConfig = {
                mode: isPerKill ? 'PER_KILL' : 'NORMAL',
                killPoints: Number(eventData.scoringSnapshot?.killPoints ?? eventData.pointSystem?.pointsPerKill ?? 1),
                placementPoints: eventData.scoringSnapshot?.placementPoints ?? DEFAULT_PLACEMENT_POINTS,
                rewardPerKill: Number(eventData.rewardSnapshot?.rewardPerKill ?? 10),
                minimumKillsForReward: Number(eventData.rewardSnapshot?.minimumKillsForReward ?? 0),
                currency: eventData.rewardSnapshot?.currency || 'NPR'
            };

            // ─── 3. Resolve Matches List ───
            let matches: any[] = [];
            if (Array.isArray(eventData.groups) && eventData.groups.length > 0) {
                eventData.groups.forEach((g: any) => {
                    if (Array.isArray(g.matches)) {
                        g.matches.forEach((m: any, idx: number) => {
                            matches.push({
                                ...m,
                                groupId: g.id,
                                groupName: g.name,
                                matchNumber: m.matchNumber || idx + 1,
                                map: m.map || 'Bermuda',
                                results: m.results || []
                            });
                        });
                    }
                });
            } else if (Array.isArray(eventData.matches) && eventData.matches.length > 0) {
                matches = eventData.matches;
            } else {
                // Synthesize default Match 1 for single-match events (common in scrims)
                matches = [{
                    id: 'match-1',
                    matchNumber: 1,
                    groupId: 'default-group',
                    groupName: 'Lobby 1',
                    map: eventData.map || 'Bermuda',
                    status: isCompleted ? 'completed' : 'scheduled',
                    results: eventData.results || eventData.scrimResults || []
                }];
            }

            // ─── 4. Resolve Registered Participants ───
            const participantsMap = new Map<string, any>();

            // A. From participants collection
            const partQuery = actualType === 'scrim'
                ? adminDb.collection('participants').where('scrimId', '==', eventId)
                : adminDb.collection('participants').where('tournamentId', '==', eventId);
            const partSnap = await partQuery.get();

            partSnap.docs.forEach(docSnap => {
                const p = docSnap.data();
                const pId = p.teamId || p.userId || docSnap.id;
                participantsMap.set(pId, {
                    id: pId,
                    name: p.teamName || p.username || 'Solo Player',
                    inGameName: p.inGameName || p.username || '',
                    inGameId: p.inGameId || '',
                    userId: p.userId || '',
                    logoUrl: p.logoUrl || null,
                    status: p.status || 'approved'
                });
            });

            // B. From scrim slots if scrim
            if (Array.isArray(eventData.slots)) {
                eventData.slots.forEach((s: any) => {
                    if (s.teamName || s.teamId || s.captainUid) {
                        const slotKey = s.teamId || s.captainUid || `slot-${s.slotNumber}`;
                        if (!participantsMap.has(slotKey)) {
                            participantsMap.set(slotKey, {
                                id: slotKey,
                                name: s.teamName || `Slot ${s.slotNumber}`,
                                inGameName: s.captainDiscord || '',
                                inGameId: s.slotNumber ? String(s.slotNumber) : '',
                                userId: s.captainUid || '',
                                status: s.status === 'locked' ? 'approved' : 'pending'
                            });
                        }
                    }
                });
            }

            // C. From group teams if tournament groups exist
            if (Array.isArray(eventData.groups)) {
                eventData.groups.forEach((g: any) => {
                    if (Array.isArray(g.teams)) {
                        g.teams.forEach((t: any) => {
                            if (!participantsMap.has(t.id)) {
                                participantsMap.set(t.id, {
                                    id: t.id,
                                    name: t.name,
                                    inGameName: '',
                                    inGameId: '',
                                    userId: t.ownerId || '',
                                    status: 'approved'
                                });
                            }
                        });
                    }
                });
            }

            // ─── 5. Fetch Audit Trail ───
            const auditsSnap = await adminDb.collection('resultAudits')
                .where('eventId', '==', eventId)
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get();

            const auditHistory = auditsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            return res.status(200).json({
                success: true,
                event: {
                    id: eventId,
                    title: eventData.title || 'Untitled Event',
                    game: eventData.game || 'Free Fire',
                    eventType: actualType,
                    matchType: eventData.matchType || (actualType === 'scrim' ? 'scrims' : 'tournament'),
                    entryFee,
                    prizePool,
                    status: eventData.status || 'upcoming',
                    resultStatus: currentStatus,
                    completedAt: completedAtMs ? new Date(completedAtMs).toISOString() : null,
                    resultDeadlineAt: deadlineMs ? new Date(deadlineMs).toISOString() : null,
                    isOverdue,
                    penaltyApplied,
                    penaltyAmount,
                    penaltyBase,
                    hostUid: eventData.hostUid || '',
                    orgId: eventData.orgId || '',
                    orgName: eventData.orgName || '',
                    lastResultUpdatedBy: eventData.lastResultUpdatedBy || null,
                    lastResultUpdatedAt: eventData.lastResultUpdatedAt ? (eventData.lastResultUpdatedAt.toMillis ? new Date(eventData.lastResultUpdatedAt.toMillis()).toISOString() : eventData.lastResultUpdatedAt) : null,
                    resultPublishedAt: eventData.resultPublishedAt ? (eventData.resultPublishedAt.toMillis ? new Date(eventData.resultPublishedAt.toMillis()).toISOString() : eventData.resultPublishedAt) : null,
                    publishedBy: eventData.publishedBy || null,
                    reopenedAt: eventData.reopenedAt ? (eventData.reopenedAt.toMillis ? new Date(eventData.reopenedAt.toMillis()).toISOString() : eventData.reopenedAt) : null,
                    reopenReason: eventData.reopenReason || null,
                    lockedAt: eventData.lockedAt ? (eventData.lockedAt.toMillis ? new Date(eventData.lockedAt.toMillis()).toISOString() : eventData.lockedAt) : null,
                    lockedBy: eventData.lockedBy || null,
                    bannerUrl: eventData.bannerUrl || null,
                    format: eventData.teamType || eventData.format || 'Squad'
                },
                scoringConfig,
                matches,
                participants: Array.from(participantsMap.values()),
                auditHistory
            });
        } catch (err: any) {
            console.error('Error fetching result data:', err);
            return res.status(500).json({ success: false, error: 'Failed to fetch result data', message: err?.message });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // POST: Manage results (SAVE_DRAFT, VALIDATE, PUBLISH, REOPEN, CORRECT, LOCK)
    // ═══════════════════════════════════════════════════════════════
    if (req.method === 'POST') {
        const {
            action,
            eventId,
            eventType,
            matchId,
            results: rawResults,
            reason: inputReason,
            scoringConfig: incomingScoring
        } = req.body || {};

        if (!isValidId(eventId)) {
            return res.status(400).json({ success: false, error: 'Invalid or missing eventId' });
        }

        const validActions = ['SAVE_DRAFT', 'VALIDATE', 'PUBLISH', 'REOPEN', 'CORRECT', 'LOCK'];
        if (!validActions.includes(action)) {
            return res.status(400).json({ success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` });
        }

        try {
            const eventResult = await fetchEventDoc(eventId, eventType);
            if (!eventResult) {
                return res.status(404).json({ success: false, error: 'Event not found' });
            }

            const { ref: eventRef, snap: eventSnap, type: actualType } = eventResult;
            const eventData = eventSnap.data()!;
            const currentResultStatus = eventData.resultStatus || 'RESULT_PENDING';

            // Guard: Permanent Lock
            if (currentResultStatus === 'LOCKED' && action !== 'VALIDATE') {
                return res.status(403).json({ success: false, error: 'Results are permanently LOCKED. No further changes can be made.' });
            }

            // Resolve authoritative scoring config
            const isPerKill = eventData.tournamentMode === 'PER_KILL_REWARD' || eventData.scrimMode === 'PER_KILL';
            const scoring: ServerScoringConfig = {
                mode: isPerKill ? 'PER_KILL' : 'NORMAL',
                killPoints: Number(eventData.scoringSnapshot?.killPoints ?? incomingScoring?.killPoints ?? 1),
                placementPoints: eventData.scoringSnapshot?.placementPoints ?? incomingScoring?.placementPoints ?? DEFAULT_PLACEMENT_POINTS,
                rewardPerKill: Number(eventData.rewardSnapshot?.rewardPerKill ?? incomingScoring?.rewardPerKill ?? 10),
                minimumKillsForReward: Number(eventData.rewardSnapshot?.minimumKillsForReward ?? incomingScoring?.minimumKillsForReward ?? 0),
                currency: eventData.rewardSnapshot?.currency || 'NPR'
            };

            // ─── ACTION: VALIDATE (Dry-run validation & leaderboard preview) ───
            if (action === 'VALIDATE') {
                const validationErrors: string[] = [];
                const seenParticipants = new Set<string>();
                const seenPlacements = new Map<number, string[]>();

                const validatedList = (Array.isArray(rawResults) ? rawResults : []).map((r: any) => {
                    const participantId = sanitizeString(r.id || r.participantId);
                    const name = sanitizeString(r.name || r.participantName || 'Participant');
                    const placement = Math.max(1, Math.floor(Number(r.placement) || 1));
                    const kills = Math.floor(Number(r.kills) || 0);

                    if (!participantId) validationErrors.push('Missing participant ID in result row');
                    if (seenParticipants.has(participantId)) validationErrors.push(`Duplicate result row for participant: ${name}`);
                    seenParticipants.add(participantId);

                    if (kills < 0) validationErrors.push(`${name}: Kills cannot be negative`);
                    if (placement < 1) validationErrors.push(`${name}: Placement must be 1 or greater`);

                    if (scoring.mode === 'NORMAL') {
                        const existingList = seenPlacements.get(placement) || [];
                        existingList.push(name);
                        seenPlacements.set(placement, existingList);
                    }

                    const score = calculateParticipantScore(placement, kills, scoring, r.bonusPoints, r.penaltyPoints);
                    return {
                        id: participantId,
                        name,
                        placement,
                        kills,
                        placementPoints: score.placementPoints,
                        killPoints: score.killPoints,
                        totalPoints: score.totalPoints,
                        rewardAmount: score.rewardAmount,
                        qualificationStatus: r.qualificationStatus || 'pending'
                    };
                });

                if (scoring.mode === 'NORMAL') {
                    seenPlacements.forEach((teams, pos) => {
                        if (teams.length > 1) {
                            validationErrors.push(`Duplicate placement #${pos}: ${teams.join(', ')}`);
                        }
                    });
                }

                // Sort for leaderboard preview
                validatedList.sort((a: any, b: any) => {
                    if (scoring.mode === 'PER_KILL') {
                        return b.kills - a.kills || a.placement - b.placement;
                    }
                    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
                    if (b.killPoints !== a.killPoints) return b.killPoints - a.killPoints;
                    return a.placement - b.placement;
                });

                return res.status(200).json({
                    success: true,
                    valid: validationErrors.length === 0,
                    errors: validationErrors,
                    scoredResults: validatedList,
                    totalKills: validatedList.reduce((acc: number, r: any) => acc + r.kills, 0),
                    totalPoints: validatedList.reduce((acc: number, r: any) => acc + r.totalPoints, 0)
                });
            }

            // ─── ACTION: REOPEN (Explicit Admin correction request) ───
            if (action === 'REOPEN') {
                if (currentResultStatus !== 'PUBLISHED') {
                    return res.status(400).json({ success: false, error: 'Only PUBLISHED results can be reopened for correction.' });
                }

                const reason = sanitizeString(inputReason);
                if (!isNonEmptyString(reason, 1000) || reason.length < 5) {
                    return res.status(400).json({ success: false, error: 'A specific explanation (at least 5 characters) is required to reopen published results.' });
                }

                await eventRef.update({
                    resultStatus: 'RESULT_REOPENED',
                    reopenedAt: FieldValue.serverTimestamp(),
                    reopenedBy: admin.uid,
                    reopenReason: reason,
                    lastResultUpdatedAt: FieldValue.serverTimestamp(),
                    lastResultUpdatedBy: admin.uid
                });

                // Write audit entry
                const auditDoc = adminDb.collection('resultAudits').doc();
                await auditDoc.set({
                    id: auditDoc.id,
                    eventId,
                    eventType: actualType,
                    action: 'RESULT_REOPENED',
                    reason,
                    adminId: admin.uid,
                    adminEmail: admin.email,
                    previousValues: { resultStatus: 'PUBLISHED' },
                    newValues: { resultStatus: 'RESULT_REOPENED' },
                    timestamp: FieldValue.serverTimestamp()
                });

                await logAuditEvent({
                    adminId: admin.uid,
                    adminEmail: admin.email,
                    action: 'RESULT_REOPENED',
                    resource: 'tournaments',
                    targetId: eventId,
                    details: { reason },
                    ip: clientIp,
                    userAgent
                });

                return res.status(200).json({ success: true, message: 'Result reopened for verified administrative correction.', resultStatus: 'RESULT_REOPENED' });
            }

            // ─── ACTION: LOCK (Final irrevocable lock) ───
            if (action === 'LOCK') {
                if (currentResultStatus !== 'PUBLISHED' && currentResultStatus !== 'RESULT_REOPENED') {
                    return res.status(400).json({ success: false, error: 'Results must be PUBLISHED before locking.' });
                }

                await eventRef.update({
                    resultStatus: 'LOCKED',
                    lockedAt: FieldValue.serverTimestamp(),
                    lockedBy: admin.uid,
                    lastResultUpdatedAt: FieldValue.serverTimestamp(),
                    lastResultUpdatedBy: admin.uid
                });

                const auditDoc = adminDb.collection('resultAudits').doc();
                await auditDoc.set({
                    id: auditDoc.id,
                    eventId,
                    eventType: actualType,
                    action: 'RESULT_LOCKED',
                    adminId: admin.uid,
                    adminEmail: admin.email,
                    previousValues: { resultStatus: currentResultStatus },
                    newValues: { resultStatus: 'LOCKED' },
                    timestamp: FieldValue.serverTimestamp()
                });

                await logAuditEvent({
                    adminId: admin.uid,
                    adminEmail: admin.email,
                    action: 'RESULT_LOCKED',
                    resource: 'tournaments',
                    targetId: eventId,
                    details: { lockedAt: new Date().toISOString() },
                    ip: clientIp,
                    userAgent
                });

                return res.status(200).json({ success: true, message: 'Results have been permanently LOCKED.', resultStatus: 'LOCKED' });
            }

            // ─── ACTIONS: SAVE_DRAFT, PUBLISH, CORRECT ───
            if (!Array.isArray(rawResults) || rawResults.length === 0) {
                return res.status(400).json({ success: false, error: 'No participant results provided' });
            }

            // Strict server-side recalculation & validation of every row
            const validationErrors: string[] = [];
            const seenParticipants = new Set<string>();
            const seenPlacements = new Map<number, string[]>();

            const recalculatedResults = rawResults.map(r => {
                const participantId = sanitizeString(r.id || r.participantId);
                const name = sanitizeString(r.name || r.participantName || 'Participant');
                const placement = Math.max(1, Math.floor(Number(r.placement) || 1));
                const kills = Math.floor(Number(r.kills) || 0);

                if (!participantId) validationErrors.push('Missing participant ID in result row');
                if (seenParticipants.has(participantId)) validationErrors.push(`Duplicate result row for participant: ${name}`);
                seenParticipants.add(participantId);

                if (kills < 0) validationErrors.push(`${name}: Kills cannot be negative`);
                if (placement < 1) validationErrors.push(`${name}: Placement must be 1 or greater`);

                if (scoring.mode === 'NORMAL' && action === 'PUBLISH') {
                    const existingList = seenPlacements.get(placement) || [];
                    existingList.push(name);
                    seenPlacements.set(placement, existingList);
                }

                const score = calculateParticipantScore(placement, kills, scoring, r.bonusPoints, r.penaltyPoints);
                return {
                    teamId: participantId,
                    id: participantId,
                    teamName: name,
                    name,
                    placement,
                    kills,
                    placementPoints: score.placementPoints,
                    killPoints: score.killPoints,
                    totalPoints: score.totalPoints,
                    rewardAmount: score.rewardAmount,
                    qualificationStatus: r.qualificationStatus || 'pending'
                };
            });

            if (scoring.mode === 'NORMAL' && action === 'PUBLISH') {
                seenPlacements.forEach((teams, pos) => {
                    if (teams.length > 1) {
                        validationErrors.push(`Duplicate placement #${pos}: ${teams.join(', ')}`);
                    }
                });
            }

            if (validationErrors.length > 0 && action === 'PUBLISH') {
                return res.status(400).json({ success: false, error: 'Validation failed before publication', errors: validationErrors });
            }

            // Sort authoritative leaderboard
            const finalLeaderboard = [...recalculatedResults].sort((a, b) => {
                if (scoring.mode === 'PER_KILL') {
                    return b.kills - a.kills || a.placement - b.placement;
                }
                if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
                if (b.killPoints !== a.killPoints) return b.killPoints - a.killPoints;
                return a.placement - b.placement;
            }).map((entry, index) => ({
                ...entry,
                rank: index + 1
            }));

            // ─── Update match in event doc ───
            const targetMatchId = matchId || 'match-1';
            let matchFound = false;

            const updatedGroups = (eventData.groups || []).map((g: any) => {
                const matches = (g.matches || []).map((m: any) => {
                    if (m.id === targetMatchId) {
                        matchFound = true;
                        return {
                            ...m,
                            results: recalculatedResults,
                            status: 'completed',
                            updatedAt: FieldValue.serverTimestamp(),
                            updatedBy: admin.uid
                        };
                    }
                    return m;
                });
                return { ...g, matches };
            });

            let updatedMatches = (eventData.matches || []).map((m: any) => {
                if (m.id === targetMatchId) {
                    matchFound = true;
                    return {
                        ...m,
                        results: recalculatedResults,
                        status: 'completed',
                        updatedAt: FieldValue.serverTimestamp(),
                        updatedBy: admin.uid
                    };
                }
                return m;
            });

            // If not found in existing arrays, create/update on event level
            if (!matchFound) {
                if (updatedGroups.length === 0 && updatedMatches.length === 0) {
                    updatedMatches = [{
                        id: targetMatchId,
                        matchNumber: 1,
                        results: recalculatedResults,
                        status: 'completed',
                        updatedAt: FieldValue.serverTimestamp(),
                        updatedBy: admin.uid
                    }];
                }
            }

            const isCompleted = eventData.status === 'completed';
            const nowTimestamp = FieldValue.serverTimestamp();
            const completedAt = eventData.completedAt || (action === 'PUBLISH' ? nowTimestamp : null);

            let newResultStatus = currentResultStatus;
            if (action === 'SAVE_DRAFT') {
                newResultStatus = currentResultStatus === 'RESULT_REOPENED' ? 'RESULT_REOPENED' : 'RESULT_PENDING';
            } else if (action === 'PUBLISH') {
                newResultStatus = 'PUBLISHED';
            } else if (action === 'CORRECT') {
                newResultStatus = 'RESULT_REOPENED';
            }

            const eventUpdates: Record<string, any> = {
                lastResultUpdatedBy: admin.uid,
                lastResultUpdatedAt: nowTimestamp,
                resultStatus: newResultStatus
            };

            if (updatedGroups.length > 0) eventUpdates.groups = updatedGroups;
            if (updatedMatches.length > 0) eventUpdates.matches = updatedMatches;
            if (actualType === 'scrim') eventUpdates.scrimResults = finalLeaderboard;

            if (action === 'PUBLISH') {
                eventUpdates.status = 'completed';
                if (!eventData.completedAt) {
                    eventUpdates.completedAt = nowTimestamp;
                    eventUpdates.resultDeadlineAt = Timestamp.fromMillis(Date.now() + 48 * 3600 * 1000);
                }
                eventUpdates.resultPublishedAt = nowTimestamp;
                eventUpdates.publishedBy = admin.uid;
                eventUpdates.leaderboard = finalLeaderboard;
                if (finalLeaderboard.length > 0) {
                    eventUpdates.winners = [{
                        rank: 1,
                        username: finalLeaderboard[0].name,
                        uid: finalLeaderboard[0].id,
                        amount: Number(eventData.prizePool) || 0
                    }];
                }
            }

            await eventRef.update(eventUpdates);

            // ─── FINANCIAL SETTLEMENT INTEGRATION (Section 7) ───
            if (action === 'PUBLISH') {
                const entryFee = Number(eventData.entryFee) || 0;
                const prizePool = Number(eventData.prizePool) || 0;
                const orgId = eventData.orgId || eventData.hostUid;
                const isPaid = entryFee > 0;

                const commPercent = Number(eventData.platformCommissionPercent) || 15;
                const earningId = `earning_${eventId}`;
                const earningRef = adminDb.collection('tournamentEarnings').doc(earningId);
                const existingEarning = await earningRef.get();

                if (!existingEarning.exists && orgId) {
                    if (isPaid) {
                        // Total collected entry fees
                        const participantsCount = recalculatedResults.length;
                        const entryFeeTotal = participantsCount * entryFee;
                        const profit = Math.max(0, entryFeeTotal - prizePool);
                        const nexplayShare = Math.round(profit * (commPercent / 100));
                        const orgShare = profit - nexplayShare;

                        await earningRef.set({
                            id: earningId,
                            tournamentId: eventId,
                            tournamentName: eventData.title || 'Paid Tournament',
                            orgId,
                            orgName: eventData.orgName || 'Organizer',
                            entryFeeTotal,
                            prizePoolTotal: prizePool,
                            profit,
                            orgShare,
                            nexplayShare,
                            platformCommissionPercent: commPercent,
                            status: 'pending',
                            createdAt: nowTimestamp
                        });

                        // Increment pending earnings for organizer
                        const orgUserRef = adminDb.collection('users').doc(orgId);
                        await orgUserRef.update({
                            orgPendingEarnings: FieldValue.increment(orgShare),
                            updatedAt: nowTimestamp
                        }).catch(e => console.warn('Could not update orgPendingEarnings:', e));
                    } else {
                        // Free event: Rs. 0 organizer profit
                        await earningRef.set({
                            id: earningId,
                            tournamentId: eventId,
                            tournamentName: eventData.title || 'Free Tournament',
                            orgId,
                            orgName: eventData.orgName || 'Organizer',
                            entryFeeTotal: 0,
                            prizePoolTotal: prizePool,
                            profit: 0,
                            orgShare: 0,
                            nexplayShare: 0,
                            platformCommissionPercent: commPercent,
                            status: 'no_earnings',
                            createdAt: nowTimestamp
                        });

                        // Release lock amount for free event if organizer had locked prize guarantee
                        if (Number(eventData.lockedMoney) > 0) {
                            const orgUserRef = adminDb.collection('users').doc(orgId);
                            await orgUserRef.update({
                                lockedMoney: FieldValue.increment(-Number(eventData.lockedMoney)),
                                updatedAt: nowTimestamp
                            }).catch(e => console.warn('Could not release free event lockedMoney:', e));
                        }
                    }
                }
            }

            // ─── AUDIT LOGGING (Section 8) ───
            const auditAction = action === 'SAVE_DRAFT' ? 'RESULT_UPDATED' :
                action === 'PUBLISH' ? 'RESULT_PUBLISHED' :
                action === 'CORRECT' ? 'RESULT_CORRECTED' : 'RESULT_UPDATED';

            const auditDoc = adminDb.collection('resultAudits').doc();
            await auditDoc.set({
                id: auditDoc.id,
                eventId,
                eventType: actualType,
                matchId: targetMatchId,
                action: auditAction,
                reason: inputReason ? sanitizeString(inputReason) : (action === 'PUBLISH' ? 'Official result publication' : 'Draft update'),
                adminId: admin.uid,
                adminEmail: admin.email,
                previousValues: { resultStatus: currentResultStatus },
                newValues: {
                    resultStatus: newResultStatus,
                    participantsCount: recalculatedResults.length,
                    topRank: finalLeaderboard[0]?.name || 'N/A'
                },
                timestamp: nowTimestamp
            });

            await logAuditEvent({
                adminId: admin.uid,
                adminEmail: admin.email,
                action: auditAction,
                resource: 'tournaments',
                targetId: eventId,
                details: { matchId: targetMatchId, action, participantsCount: recalculatedResults.length },
                ip: clientIp,
                userAgent
            });

            return res.status(200).json({
                success: true,
                message: action === 'PUBLISH' ? 'Result published and leaderboard finalized.' :
                         action === 'CORRECT' ? 'Result corrected successfully.' : 'Draft saved successfully.',
                resultStatus: newResultStatus,
                scoredResults: finalLeaderboard
            });
        } catch (err: any) {
            console.error('Error updating results:', err);
            return res.status(500).json({ success: false, error: 'Failed to process result update', message: err?.message });
        }
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
