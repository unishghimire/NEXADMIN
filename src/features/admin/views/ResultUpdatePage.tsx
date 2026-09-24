import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft,
    Trophy,
    Shield,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Lock,
    Unlock,
    RotateCcw,
    Send,
    Plus,
    Trash2,
    RefreshCw,
    Info,
    Calendar,
    Users,
    DollarSign,
    Percent,
    History,
    FileText,
    ChevronDown,
    ChevronUp,
    ExternalLink
} from 'lucide-react';
import { adminApiClient } from '../../../shared/services/adminApiClient';
import { useNotification } from '../../../shared/context/NotificationContext';
import { ResultStatus, ResultActionType } from '../../../shared/types/result-update';
import Modal from '../../../shared/components/Modal';

interface ParticipantRow {
    id: string;
    name: string;
    inGameName?: string;
    inGameId?: string;
    placement: number;
    kills: number;
    placementPoints: number;
    killPoints: number;
    totalPoints: number;
    rewardAmount?: number;
    qualificationStatus: 'qualified' | 'eliminated' | 'pending';
    bonusPoints?: number;
    penaltyPoints?: number;
}

const ResultUpdatePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useNotification();

    const isScrimHint = location.pathname.includes('/scrims/') || location.search.includes('type=scrim');

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [eventData, setEventData] = useState<any>(null);
    const [scoringConfig, setScoringConfig] = useState<any>(null);
    const [matches, setMatches] = useState<any[]>([]);
    const [participants, setParticipants] = useState<any[]>([]);
    const [auditHistory, setAuditHistory] = useState<any[]>([]);
    const [selectedMatchId, setSelectedMatchId] = useState<string>('match-1');

    // Local result rows for current selected match
    const [resultRows, setResultRows] = useState<ParticipantRow[]>([]);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
    const [showAuditDrawer, setShowAuditDrawer] = useState(false);

    // Modal dialog states
    const [reopenModalOpen, setReopenModalOpen] = useState(false);
    const [reopenReason, setReopenReason] = useState('');
    const [lockModalOpen, setLockModalOpen] = useState(false);
    const [addParticipantModalOpen, setAddParticipantModalOpen] = useState(false);
    const [selectedParticipantToAdd, setSelectedParticipantToAdd] = useState('');

    // Fetch initial event & result data from server
    const loadResultData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await adminApiClient.getResultData(id, isScrimHint ? 'scrim' : undefined);
            if (res.success) {
                setEventData(res.event);
                setScoringConfig(res.scoringConfig);
                setMatches(res.matches || []);
                setParticipants(res.participants || []);
                setAuditHistory(res.auditHistory || []);

                const firstMatch = res.matches?.[0];
                const matchIdToSelect = firstMatch ? firstMatch.id : 'match-1';
                setSelectedMatchId(matchIdToSelect);

                // Initialize result rows from selected match
                populateRowsFromMatch(firstMatch, res.participants, res.scoringConfig);
            } else {
                showToast(res.error || 'Failed to load result data', 'error');
            }
        } catch (err: any) {
            console.error('Error loading result data:', err);
            showToast(err?.message || 'Error connecting to server', 'error');
        } finally {
            setLoading(false);
        }
    }, [id, isScrimHint, showToast]);

    useEffect(() => {
        loadResultData();
    }, [loadResultData]);

    // Populate rows when switching matches
    const populateRowsFromMatch = (match: any, allParts: any[], scoring: any) => {
        if (!match || !match.results || match.results.length === 0) {
            // Seed with all registered participants if no results recorded yet
            const seeded = allParts.map((p, idx) => ({
                id: p.id,
                name: p.name || `Team ${idx + 1}`,
                inGameName: p.inGameName || '',
                inGameId: p.inGameId || '',
                placement: idx + 1,
                kills: 0,
                placementPoints: scoring?.placementPoints?.[String(idx + 1)] || 0,
                killPoints: 0,
                totalPoints: scoring?.placementPoints?.[String(idx + 1)] || 0,
                rewardAmount: 0,
                qualificationStatus: 'pending' as const,
                bonusPoints: 0,
                penaltyPoints: 0
            }));
            setResultRows(seeded);
            return;
        }

        const existingRows: ParticipantRow[] = match.results.map((r: any, idx: number) => ({
            id: r.id || r.teamId || `part-${idx}`,
            name: r.name || r.teamName || `Participant ${idx + 1}`,
            inGameName: r.inGameName || '',
            inGameId: r.inGameId || '',
            placement: Number(r.placement) || idx + 1,
            kills: Number(r.kills) || 0,
            placementPoints: Number(r.placementPoints) || 0,
            killPoints: Number(r.killPoints) || 0,
            totalPoints: Number(r.totalPoints) || 0,
            rewardAmount: Number(r.rewardAmount) || 0,
            qualificationStatus: r.qualificationStatus || 'pending',
            bonusPoints: Number(r.bonusPoints) || 0,
            penaltyPoints: Number(r.penaltyPoints) || 0
        }));
        setResultRows(existingRows);
    };

    const handleSelectMatch = (matchId: string) => {
        setSelectedMatchId(matchId);
        const target = matches.find(m => m.id === matchId);
        if (target) {
            populateRowsFromMatch(target, participants, scoringConfig);
        }
    };

    // Client-side live recalculation for responsive feedback
    const recomputeRows = useCallback((rows: ParticipantRow[]) => {
        if (!scoringConfig) return rows;
        const isPerKill = scoringConfig.mode === 'PER_KILL';
        const killRate = Number(scoringConfig.killPoints) || 1;
        const rewardPerKill = Number(scoringConfig.rewardPerKill) || 10;
        const minKills = Number(scoringConfig.minimumKillsForReward) || 0;

        return rows.map(r => {
            const pos = Math.max(1, Math.floor(Number(r.placement) || 1));
            const kls = Math.max(0, Math.floor(Number(r.kills) || 0));
            const bns = Math.max(0, Math.floor(Number(r.bonusPoints) || 0));
            const pnl = Math.max(0, Math.floor(Number(r.penaltyPoints) || 0));

            if (isPerKill) {
                const rewardAmount = kls >= minKills ? Math.round(kls * rewardPerKill) : 0;
                return {
                    ...r,
                    placement: pos,
                    kills: kls,
                    placementPoints: 0,
                    killPoints: kls,
                    totalPoints: kls + bns - pnl,
                    rewardAmount
                };
            }

            const placementPts = scoringConfig.placementPoints?.[String(pos)] ?? 0;
            const killPts = kls * killRate;
            const totalPts = placementPts + killPts + bns - pnl;

            return {
                ...r,
                placement: pos,
                kills: kls,
                placementPoints: placementPts,
                killPoints: killPts,
                totalPoints: totalPts,
                rewardAmount: 0
            };
        });
    }, [scoringConfig]);

    const handleRowChange = (index: number, field: keyof ParticipantRow, value: any) => {
        setResultRows(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return recomputeRows(next);
        });
    };

    const handleRemoveRow = (index: number) => {
        setResultRows(prev => {
            const next = prev.filter((_, i) => i !== index);
            return recomputeRows(next);
        });
    };

    const handleAddParticipant = () => {
        if (!selectedParticipantToAdd) return;
        const participant = participants.find(p => p.id === selectedParticipantToAdd);
        if (!participant) return;

        if (resultRows.some(r => r.id === participant.id)) {
            showToast('Participant is already added to this match', 'warning');
            return;
        }

        const newPlacement = resultRows.length + 1;
        const newRow: ParticipantRow = {
            id: participant.id,
            name: participant.name,
            inGameName: participant.inGameName,
            inGameId: participant.inGameId,
            placement: newPlacement,
            kills: 0,
            placementPoints: scoringConfig?.placementPoints?.[String(newPlacement)] || 0,
            killPoints: 0,
            totalPoints: scoringConfig?.placementPoints?.[String(newPlacement)] || 0,
            rewardAmount: 0,
            qualificationStatus: 'pending',
            bonusPoints: 0,
            penaltyPoints: 0
        };

        setResultRows(prev => recomputeRows([...prev, newRow]));
        setSelectedParticipantToAdd('');
        setAddParticipantModalOpen(false);
        showToast(`Added ${participant.name}`, 'success');
    };

    // 48-Hour Deadline Countdown
    const deadlineCountdown = useMemo(() => {
        if (!eventData?.resultDeadlineAt) return null;
        const deadline = new Date(eventData.resultDeadlineAt).getTime();
        const now = Date.now();
        const diff = deadline - now;

        if (diff <= 0) {
            const hoursOverdue = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
            const minutesOverdue = Math.floor((Math.abs(diff) % (1000 * 60 * 60)) / (1000 * 60));
            return {
                isOverdue: true,
                text: `OVERDUE by ${hoursOverdue}h ${minutesOverdue}m`,
                penaltyTriggered: eventData.penaltyApplied
            };
        }

        const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
        const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return {
            isOverdue: false,
            text: `${hoursLeft}h ${minutesLeft}m remaining`,
            penaltyTriggered: false
        };
    }, [eventData]);

    // Check duplicate placements in real-time
    const duplicatePlacements = useMemo(() => {
        if (scoringConfig?.mode === 'PER_KILL') return [];
        const seen = new Map<number, string[]>();
        resultRows.forEach(r => {
            const list = seen.get(r.placement) || [];
            list.push(r.name);
            seen.set(r.placement, list);
        });
        const dupes: string[] = [];
        seen.forEach((names, pos) => {
            if (names.length > 1) {
                dupes.push(`Position #${pos} assigned to multiple teams: ${names.join(', ')}`);
            }
        });
        return dupes;
    }, [resultRows, scoringConfig]);

    // Live sorted leaderboard across current rows
    const liveLeaderboard = useMemo(() => {
        return [...resultRows].sort((a, b) => {
            if (scoringConfig?.mode === 'PER_KILL') {
                return b.kills - a.kills || a.placement - b.placement;
            }
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            if (b.killPoints !== a.killPoints) return b.killPoints - a.killPoints;
            return a.placement - b.placement;
        });
    }, [resultRows, scoringConfig]);

    // ─── Actions ───

    // 1. SAVE DRAFT
    const handleSaveDraft = async () => {
        if (!id) return;
        setActionLoading(true);
        try {
            const res = await adminApiClient.updateResult({
                action: 'SAVE_DRAFT',
                eventId: id,
                eventType: eventData.eventType,
                matchId: selectedMatchId,
                results: resultRows,
                scoringConfig
            });

            if (res.success) {
                showToast(res.message || 'Draft saved successfully', 'success');
                await loadResultData();
            } else {
                showToast(res.error || 'Failed to save draft', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Network error saving draft', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // 2. VALIDATE RESULT
    const handleValidateResult = async () => {
        if (!id) return;
        setActionLoading(true);
        try {
            const res = await adminApiClient.updateResult({
                action: 'VALIDATE',
                eventId: id,
                eventType: eventData.eventType,
                matchId: selectedMatchId,
                results: resultRows,
                scoringConfig
            });

            if (res.success) {
                if (res.valid) {
                    setValidationErrors([]);
                    showToast('✅ All validation rules passed! Ready to publish.', 'success');
                } else {
                    setValidationErrors(res.errors || []);
                    showToast('⚠️ Validation found issues. See errors below.', 'warning');
                }
            } else {
                showToast(res.error || 'Server validation failed', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Error validating results', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // 3. PUBLISH RESULT
    const handlePublishResult = async () => {
        if (duplicatePlacements.length > 0) {
            showToast('Please fix duplicate placements before publishing', 'error');
            return;
        }

        if (!window.confirm('Are you sure you want to PUBLISH final results? This will finalize the leaderboard and prepare organizer settlement.')) {
            return;
        }

        if (!id) return;
        setActionLoading(true);
        try {
            const res = await adminApiClient.updateResult({
                action: 'PUBLISH',
                eventId: id,
                eventType: eventData.eventType,
                matchId: selectedMatchId,
                results: resultRows,
                scoringConfig
            });

            if (res.success) {
                showToast(res.message || 'Results published successfully!', 'success');
                await loadResultData();
            } else {
                showToast(res.error || 'Failed to publish results', 'error');
                if (res.errors) setValidationErrors(res.errors);
            }
        } catch (err: any) {
            showToast(err?.message || 'Error publishing results', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // 4. REOPEN RESULT
    const handleReopenResult = async () => {
        if (!reopenReason.trim() || reopenReason.trim().length < 5) {
            showToast('Please provide a specific reason for reopening published results (at least 5 chars)', 'warning');
            return;
        }

        if (!id) return;
        setActionLoading(true);
        try {
            const res = await adminApiClient.updateResult({
                action: 'REOPEN',
                eventId: id,
                eventType: eventData.eventType,
                reason: reopenReason.trim()
            });

            if (res.success) {
                showToast('Result reopened for correction.', 'info');
                setReopenModalOpen(false);
                setReopenReason('');
                await loadResultData();
            } else {
                showToast(res.error || 'Failed to reopen result', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Error reopening result', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // 5. CORRECT & REPUBLISH
    const handleCorrectResult = async () => {
        if (!id) return;
        setActionLoading(true);
        try {
            const res = await adminApiClient.updateResult({
                action: 'CORRECT',
                eventId: id,
                eventType: eventData.eventType,
                matchId: selectedMatchId,
                results: resultRows,
                reason: 'Administrative correction'
            });

            if (res.success) {
                showToast('Corrected results saved. You can now re-validate and publish.', 'success');
                await loadResultData();
            } else {
                showToast(res.error || 'Failed to save corrected results', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Error saving corrections', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // 6. PERMANENT LOCK
    const handleLockResult = async () => {
        if (!id) return;
        setActionLoading(true);
        try {
            const res = await adminApiClient.updateResult({
                action: 'LOCK',
                eventId: id,
                eventType: eventData.eventType
            });

            if (res.success) {
                showToast('Results have been permanently LOCKED.', 'success');
                setLockModalOpen(false);
                await loadResultData();
            } else {
                showToast(res.error || 'Failed to lock result', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Error locking result', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-gray-400 font-black uppercase tracking-widest">Loading Result Update Center...</p>
            </div>
        );
    }

    if (!eventData) {
        return (
            <div className="p-8 text-center bg-card rounded-2xl border border-gray-800 space-y-4 max-w-xl mx-auto my-12">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
                <h3 className="text-xl font-bold text-white">Event Not Found</h3>
                <p className="text-xs text-gray-400">The requested tournament or scrim result could not be located.</p>
                <button
                    type="button"
                    onClick={() => navigate('/admin')}
                    className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition"
                >
                    Back to Admin Panel
                </button>
            </div>
        );
    }

    const currentResultStatus: ResultStatus = eventData.resultStatus || 'RESULT_PENDING';
    const isLocked = currentResultStatus === 'LOCKED';
    const isPublished = currentResultStatus === 'PUBLISHED';
    const isReopened = currentResultStatus === 'RESULT_REOPENED';
    const canEdit = !isLocked && (!isPublished || isReopened);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16">
            {/* Top Navigation & Back Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-5">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="p-3 bg-card border border-gray-800 hover:border-brand-500 rounded-2xl text-gray-400 hover:text-white transition"
                        title="Go Back"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                                Result Update Center
                            </h1>
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-brand-500/10 text-brand-400 border border-brand-500/30">
                                {eventData.eventType === 'scrim' ? 'Scrim Lobby' : 'Tournament'}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                currentResultStatus === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                currentResultStatus === 'LOCKED' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                                currentResultStatus === 'OVERDUE' ? 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse' :
                                currentResultStatus === 'RESULT_REOPENED' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}>
                                {currentResultStatus.replace(/_/g, ' ')}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1 truncate max-w-md sm:max-w-xl">
                            {eventData.title} · {eventData.game} · {eventData.format}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
                    <button
                        type="button"
                        onClick={() => setShowAuditDrawer(!showAuditDrawer)}
                        className="px-4 py-2.5 bg-card border border-gray-800 hover:border-gray-700 text-gray-300 rounded-xl text-xs font-bold transition flex items-center gap-2"
                    >
                        <History className="w-4 h-4 text-brand-400" />
                        <span>Audit Log ({auditHistory.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={loadResultData}
                        className="p-2.5 bg-card border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white rounded-xl transition"
                        title="Refresh data from server"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* 48-Hour Deadline Alert Banner */}
            {deadlineCountdown && (
                <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    deadlineCountdown.isOverdue
                        ? 'bg-red-950/20 border-red-500/30 text-red-300'
                        : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                }`}>
                    <div className="flex items-center gap-3.5">
                        <div className={`p-2.5 rounded-xl shrink-0 ${deadlineCountdown.isOverdue ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                                <span>48-Hour Result Window:</span>
                                <span className="font-mono text-sm underline">{deadlineCountdown.text}</span>
                            </div>
                            <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">
                                {deadlineCountdown.isOverdue
                                    ? `Results were not published within 48 hours of match completion. ${eventData.penaltyApplied ? `A 10% penalty (Rs. ${eventData.penaltyAmount?.toLocaleString()}) was deducted from organizer wallet.` : 'Overdue penalty verification active.'}`
                                    : 'Organizers and administrators must submit and publish verified results within 48 hours of match finish.'}
                            </p>
                        </div>
                    </div>
                    {eventData.resultDeadlineAt && (
                        <div className="text-right text-[11px] opacity-75 font-mono shrink-0">
                            Deadline: {new Date(eventData.resultDeadlineAt).toLocaleString()}
                        </div>
                    )}
                </div>
            )}

            {/* Financial Settlement & Event Metadata Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card p-4 rounded-2xl border border-gray-800">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Prize Pool</span>
                    <div className="text-xl font-black text-white">
                        Rs. {eventData.prizePool?.toLocaleString() || 0}
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase mt-1 block">
                        Entry Fee: {eventData.entryFee === 0 ? 'FREE' : `Rs. ${eventData.entryFee}`}
                    </span>
                </div>

                <div className="bg-card p-4 rounded-2xl border border-gray-800">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Scoring System</span>
                    <div className="text-sm font-black text-brand-400 uppercase truncate">
                        {scoringConfig?.mode === 'PER_KILL' ? 'Per-Kill Reward' : 'Standard BR Points'}
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold mt-1 block truncate">
                        {scoringConfig?.mode === 'PER_KILL'
                            ? `Rs. ${scoringConfig.rewardPerKill} per verified kill`
                            : `${scoringConfig?.killPoints} pt/kill · ${Object.keys(scoringConfig?.placementPoints || {}).length} placement tiers`}
                    </span>
                </div>

                <div className="bg-card p-4 rounded-2xl border border-gray-800">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Registered Participants</span>
                    <div className="text-xl font-black text-white">
                        {participants.length} Squads / Players
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold mt-1 block">
                        {resultRows.length} active in match result
                    </span>
                </div>

                <div className="bg-card p-4 rounded-2xl border border-gray-800">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Financial Settlement</span>
                    <div className={`text-sm font-black uppercase ${eventData.entryFee === 0 ? 'text-gray-400' : 'text-emerald-400'}`}>
                        {eventData.entryFee === 0 ? 'Free Event (Rs. 0 Org Profit)' : 'Paid Event (Escrow Split)'}
                    </div>
                    <span className="text-[10px] text-gray-500 font-bold mt-1 block">
                        {currentResultStatus === 'PUBLISHED' || currentResultStatus === 'LOCKED'
                            ? 'Earnings ledger ready for release'
                            : 'Pending official publication'}
                    </span>
                </div>
            </div>

            {/* Validation Errors Box */}
            {validationErrors.length > 0 && (
                <div className="p-4 bg-red-950/30 border border-red-500/40 rounded-2xl space-y-2 animate-fade-in">
                    <div className="text-xs font-black text-red-400 uppercase tracking-widest flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Validation Errors Detected ({validationErrors.length})</span>
                    </div>
                    <ul className="text-xs text-red-300/90 list-disc list-inside space-y-1 font-medium">
                        {validationErrors.map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Duplicate Placement Warning */}
            {duplicatePlacements.length > 0 && (
                <div className="p-4 bg-amber-950/30 border border-amber-500/40 rounded-2xl space-y-1.5 animate-fade-in">
                    <div className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Duplicate Placement Alert</span>
                    </div>
                    <ul className="text-xs text-amber-300 list-disc list-inside space-y-0.5">
                        {duplicatePlacements.map((dup, idx) => (
                            <li key={idx}>{dup}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Match Selector Tab Bar */}
            <div className="flex items-center justify-between gap-3 overflow-x-auto pb-2 custom-scrollbar border-b border-gray-800">
                <div className="flex items-center gap-2">
                    {matches.map((m, idx) => (
                        <button
                            key={m.id || idx}
                            type="button"
                            onClick={() => handleSelectMatch(m.id)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition whitespace-nowrap flex items-center gap-2 ${
                                selectedMatchId === m.id
                                    ? 'bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/20'
                                    : 'bg-card border border-gray-800 text-gray-400 hover:text-white'
                            }`}
                        >
                            <span>Match {m.matchNumber || idx + 1} ({m.map || 'Bermuda'})</span>
                            {m.results?.length > 0 && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            )}
                        </button>
                    ))}
                </div>

                {canEdit && (
                    <button
                        type="button"
                        onClick={() => setAddParticipantModalOpen(true)}
                        className="px-4 py-2.5 bg-brand-600/10 hover:bg-brand-600 text-brand-400 hover:text-white border border-brand-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Participant</span>
                    </button>
                )}
            </div>

            {/* Main Interactive Result Table */}
            <div className="bg-card rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
                <div className="p-4 sm:p-5 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h2 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-brand-400" />
                            <span>Match Results Scoring Matrix</span>
                        </h2>
                        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                            Enter verified placement & kills · Points and rewards auto-recalculate server-side
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                        <span>Total Kills: <strong className="text-white">{resultRows.reduce((acc, r) => acc + r.kills, 0)}</strong></span>
                        <span>·</span>
                        <span>Total Points: <strong className="text-brand-400">{resultRows.reduce((acc, r) => acc + r.totalPoints, 0)}</strong></span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-800 bg-surface/30 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <th className="p-3.5 text-center w-20">Placement</th>
                                <th className="p-3.5">Participant / Team</th>
                                <th className="p-3.5 text-center w-24">Kills</th>
                                {scoringConfig?.mode === 'NORMAL' && (
                                    <>
                                        <th className="p-3.5 text-right w-24">Place Pts</th>
                                        <th className="p-3.5 text-right w-24">Kill Pts</th>
                                        <th className="p-3.5 text-right w-24">Total Pts</th>
                                    </>
                                )}
                                {scoringConfig?.mode === 'PER_KILL' && (
                                    <th className="p-3.5 text-right w-28">Reward (NPR)</th>
                                )}
                                <th className="p-3.5 text-center w-32">Qualification</th>
                                {canEdit && <th className="p-3.5 text-center w-16">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/40 text-xs">
                            {resultRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-gray-500 font-medium">
                                        No participant rows added for this match. Click "Add Participant" to seed the roster.
                                    </td>
                                </tr>
                            ) : (
                                resultRows.map((row, idx) => (
                                    <tr key={row.id || idx} className="hover:bg-surface/20 transition-colors">
                                        {/* Placement */}
                                        <td className="p-3 text-center">
                                            {canEdit ? (
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={row.placement}
                                                    onChange={e => handleRowChange(idx, 'placement', parseInt(e.target.value) || 1)}
                                                    className="w-14 text-center bg-black border border-gray-700 focus:border-brand-500 rounded-lg py-1.5 px-2 text-white font-black text-sm transition"
                                                />
                                            ) : (
                                                <span className="font-mono font-black text-white text-sm">#{row.placement}</span>
                                            )}
                                        </td>

                                        {/* Participant Name & In-Game Info */}
                                        <td className="p-3">
                                            <div className="font-bold text-white text-sm">{row.name}</div>
                                            {(row.inGameName || row.inGameId) && (
                                                <div className="text-[10px] text-gray-500 font-mono">
                                                    IGN: {row.inGameName || 'N/A'} {row.inGameId ? `(ID: ${row.inGameId})` : ''}
                                                </div>
                                            )}
                                        </td>

                                        {/* Kills */}
                                        <td className="p-3 text-center">
                                            {canEdit ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={row.kills}
                                                    onChange={e => handleRowChange(idx, 'kills', parseInt(e.target.value) || 0)}
                                                    className="w-16 text-center bg-black border border-gray-700 focus:border-brand-500 rounded-lg py-1.5 px-2 text-white font-black text-sm transition"
                                                />
                                            ) : (
                                                <span className="font-mono font-bold text-gray-200">{row.kills}</span>
                                            )}
                                        </td>

                                        {/* Normal Mode Points */}
                                        {scoringConfig?.mode === 'NORMAL' && (
                                            <>
                                                <td className="p-3 text-right font-mono text-gray-300">
                                                    {row.placementPoints}
                                                </td>
                                                <td className="p-3 text-right font-mono text-gray-300">
                                                    {row.killPoints}
                                                </td>
                                                <td className="p-3 text-right font-mono font-black text-brand-400 text-sm">
                                                    {row.totalPoints}
                                                </td>
                                            </>
                                        )}

                                        {/* Per-Kill Mode Reward */}
                                        {scoringConfig?.mode === 'PER_KILL' && (
                                            <td className="p-3 text-right font-mono font-black text-emerald-400 text-sm">
                                                Rs. {(row.rewardAmount || 0).toLocaleString()}
                                            </td>
                                        )}

                                        {/* Qualification Status */}
                                        <td className="p-3 text-center">
                                            {canEdit ? (
                                                <select
                                                    value={row.qualificationStatus}
                                                    onChange={e => handleRowChange(idx, 'qualificationStatus', e.target.value)}
                                                    className="bg-black border border-gray-700 text-xs font-bold rounded-lg py-1 px-2 text-gray-300 focus:border-brand-500 transition"
                                                >
                                                    <option value="pending">Pending</option>
                                                    <option value="qualified">Qualified</option>
                                                    <option value="eliminated">Eliminated</option>
                                                </select>
                                            ) : (
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                    row.qualificationStatus === 'qualified' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                                                    row.qualificationStatus === 'eliminated' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                                                    'bg-gray-800 text-gray-400'
                                                }`}>
                                                    {row.qualificationStatus}
                                                </span>
                                            )}
                                        </td>

                                        {/* Remove Action */}
                                        {canEdit && (
                                            <td className="p-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRow(idx)}
                                                    className="p-1.5 text-gray-500 hover:text-red-400 transition"
                                                    title="Remove participant from this match"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Action Bar (Save Draft, Validate, Publish, Reopen, Lock) */}
            <div className="bg-card p-4 sm:p-5 rounded-2xl border border-gray-800 flex flex-wrap items-center justify-between gap-3 shadow-xl">
                <div className="flex items-center gap-2 flex-wrap">
                    {canEdit && (
                        <>
                            <button
                                type="button"
                                onClick={handleSaveDraft}
                                disabled={actionLoading}
                                className="px-5 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-50"
                            >
                                {actionLoading ? 'Saving...' : 'Save Draft'}
                            </button>

                            <button
                                type="button"
                                onClick={handleValidateResult}
                                disabled={actionLoading}
                                className="px-5 py-3 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-50"
                            >
                                Validate Result
                            </button>

                            {isReopened ? (
                                <button
                                    type="button"
                                    onClick={handleCorrectResult}
                                    disabled={actionLoading}
                                    className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-amber-600/20 disabled:opacity-50"
                                >
                                    Save Corrections
                                </button>
                            ) : null}

                            <button
                                type="button"
                                onClick={handlePublishResult}
                                disabled={actionLoading || duplicatePlacements.length > 0}
                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Send className="w-4 h-4" />
                                <span>Publish Result</span>
                            </button>
                        </>
                    )}

                    {isPublished && !isLocked && (
                        <>
                            <button
                                type="button"
                                onClick={() => setReopenModalOpen(true)}
                                disabled={actionLoading}
                                className="px-5 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                <span>Reopen Result for Correction</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setLockModalOpen(true)}
                                disabled={actionLoading}
                                className="px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2"
                            >
                                <Lock className="w-4 h-4" />
                                <span>Lock Final Result</span>
                            </button>
                        </>
                    )}

                    {isLocked && (
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/30 px-4 py-2.5 rounded-xl">
                            <Lock className="w-4 h-4" />
                            <span>Results are Permanently Locked</span>
                        </div>
                    )}
                </div>

                <div className="text-[11px] text-gray-500 font-mono">
                    Last updated: {eventData.lastResultUpdatedAt ? new Date(eventData.lastResultUpdatedAt).toLocaleString() : 'Not yet saved'}
                </div>
            </div>

            {/* Standings Leaderboard Preview */}
            <div className="bg-card rounded-2xl border border-gray-800 p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                    <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <span>Live Match Standings (Authoritative Sort Preview)</span>
                    </h3>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                        Tie-Breakers: Total Pts &rarr; Kill Pts &rarr; Placement
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {liveLeaderboard.slice(0, 6).map((standing, idx) => (
                        <div
                            key={standing.id || idx}
                            className={`p-3.5 rounded-xl border flex items-center justify-between ${
                                idx === 0 ? 'bg-amber-500/10 border-amber-500/30' :
                                idx === 1 ? 'bg-slate-400/10 border-slate-400/30' :
                                idx === 2 ? 'bg-amber-700/10 border-amber-700/30' :
                                'bg-black/30 border-gray-800'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                                    idx === 0 ? 'bg-amber-500 text-black' :
                                    idx === 1 ? 'bg-slate-300 text-black' :
                                    idx === 2 ? 'bg-amber-700 text-white' :
                                    'bg-gray-800 text-gray-400'
                                }`}>
                                    {idx + 1}
                                </span>
                                <div>
                                    <div className="font-bold text-white text-xs truncate max-w-[140px]">{standing.name}</div>
                                    <div className="text-[10px] text-gray-500 font-mono">
                                        {standing.kills} kills · #{standing.placement}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                {scoringConfig?.mode === 'PER_KILL' ? (
                                    <div className="font-mono font-black text-emerald-400 text-xs">
                                        Rs. {(standing.rewardAmount || 0).toLocaleString()}
                                    </div>
                                ) : (
                                    <div className="font-mono font-black text-brand-400 text-sm">
                                        {standing.totalPoints} pts
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Audit History Drawer */}
            {showAuditDrawer && (
                <div className="bg-card rounded-2xl border border-gray-800 p-6 space-y-4 animate-fade-in">
                    <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                        <div className="flex items-center gap-2">
                            <History className="w-5 h-5 text-brand-400" />
                            <h3 className="text-base font-black text-white uppercase tracking-tight">
                                Result Audit History & Correction Log
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAuditDrawer(false)}
                            className="text-gray-400 hover:text-white text-xs uppercase tracking-wider font-bold"
                        >
                            Close
                        </button>
                    </div>

                    {auditHistory.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-6">No audit records found for this event yet.</p>
                    ) : (
                        <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                            {auditHistory.map(audit => (
                                <div key={audit.id} className="p-3.5 bg-black/40 rounded-xl border border-gray-800/80 space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-mono">
                                        <span className={`px-2 py-0.5 rounded font-black uppercase ${
                                            audit.action === 'RESULT_PUBLISHED' ? 'bg-emerald-500/20 text-emerald-400' :
                                            audit.action === 'RESULT_REOPENED' ? 'bg-amber-500/20 text-amber-400' :
                                            audit.action === 'RESULT_LOCKED' ? 'bg-purple-500/20 text-purple-400' :
                                            audit.action === 'RESULT_PENALTY_APPLIED' ? 'bg-red-500/20 text-red-400' :
                                            'bg-gray-800 text-gray-400'
                                        }`}>
                                            {audit.action}
                                        </span>
                                        <span className="text-gray-500">
                                            {audit.timestamp ? new Date(audit.timestamp.toMillis ? audit.timestamp.toMillis() : audit.timestamp).toLocaleString() : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-300 font-medium">
                                        {audit.reason || 'Standard administrative operation'}
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-mono">
                                        By: {audit.adminEmail || audit.adminId || 'System'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Reopen Result */}
            <Modal
                isOpen={reopenModalOpen}
                onClose={() => setReopenModalOpen(false)}
                title="Reopen Published Result for Correction"
            >
                <div className="space-y-4">
                    <p className="text-xs text-gray-300 leading-relaxed">
                        Reopening a published result allows score or kill corrections. NexPlay requires an explicit reason which will be recorded permanently in the immutable audit log.
                    </p>

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                            Reason for Correction (Required)
                        </label>
                        <textarea
                            value={reopenReason}
                            onChange={e => setReopenReason(e.target.value)}
                            placeholder="e.g., Player disputed Kill Count in Match 2 with screenshot proof verified on Discord ticket #104"
                            rows={3}
                            className="w-full bg-black border border-gray-700 rounded-xl p-3 text-white text-xs focus:border-amber-500 focus-visible:outline-none transition"
                        />
                    </div>

                    <div className="flex gap-2.5 pt-2">
                        <button
                            type="button"
                            onClick={() => setReopenModalOpen(false)}
                            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleReopenResult}
                            disabled={actionLoading || reopenReason.trim().length < 5}
                            className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-50"
                        >
                            {actionLoading ? 'Processing...' : 'Confirm Reopen'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal: Lock Final Result */}
            <Modal
                isOpen={lockModalOpen}
                onClose={() => setLockModalOpen(false)}
                title="Permanent Result Lock Confirmation"
            >
                <div className="space-y-4">
                    <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-xl text-purple-300 text-xs leading-relaxed space-y-2">
                        <div className="font-black uppercase tracking-wider flex items-center gap-2 text-purple-400">
                            <Lock className="w-4 h-4" />
                            <span>Permanent Lock Warning</span>
                        </div>
                        <p>
                            Once locked, results cannot be edited, reopened, or recalculated by any host or tournament admin. All wallet settlements and winner distributions will be frozen as final.
                        </p>
                    </div>

                    <div className="flex gap-2.5 pt-2">
                        <button
                            type="button"
                            onClick={() => setLockModalOpen(false)}
                            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleLockResult}
                            disabled={actionLoading}
                            className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-50"
                        >
                            {actionLoading ? 'Locking...' : 'Yes, Lock Permanently'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal: Add Participant to Match */}
            <Modal
                isOpen={addParticipantModalOpen}
                onClose={() => setAddParticipantModalOpen(false)}
                title="Add Registered Participant to Match"
            >
                <div className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                        Select Registered Team or Player
                    </label>
                    <select
                        value={selectedParticipantToAdd}
                        onChange={e => setSelectedParticipantToAdd(e.target.value)}
                        className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-white text-xs font-bold focus:border-brand-500 transition"
                    >
                        <option value="">— Choose a registered participant —</option>
                        {participants
                            .filter(p => !resultRows.some(r => r.id === p.id))
                            .map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} {p.inGameName ? `(${p.inGameName})` : ''}
                                </option>
                            ))}
                    </select>

                    <div className="flex gap-2.5 pt-2">
                        <button
                            type="button"
                            onClick={() => setAddParticipantModalOpen(false)}
                            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleAddParticipant}
                            disabled={!selectedParticipantToAdd}
                            className="flex-1 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-50"
                        >
                            Add to Match
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ResultUpdatePage;
