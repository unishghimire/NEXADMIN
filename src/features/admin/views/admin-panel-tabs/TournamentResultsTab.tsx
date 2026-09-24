import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    Trophy,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Clock,
    Search,
    Filter,
    ArrowRight,
    RefreshCw,
    Shield,
    ExternalLink,
    ChevronRight,
    Layers,
    Users,
    Calendar,
    Award,
    Eye,
    Check,
    X,
    Lock,
    Edit3,
    FileText,
    DollarSign,
    Zap,
    History
} from 'lucide-react';
import { adminApi } from '../../../../shared/services/adminApiClient';
import { useNotification } from '../../../../shared/context/NotificationContext';
import Modal from '../../../../shared/components/Modal';
import type {
    TournamentStageSummaryItem,
    StageValidationReport,
    StageQualificationPreview,
    StageAuditLogEntry
} from '../../../../shared/types/stage-validation';

export const TournamentResultsTab: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useNotification();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tournaments, setTournaments] = useState<TournamentStageSummaryItem[]>([]);

    // Search and Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [validationFilter, setValidationFilter] = useState<'ALL' | 'PASSED' | 'FAILED'>('ALL');
    const [processingFilter, setProcessingFilter] = useState<'ALL' | 'READY' | 'NOT_READY' | 'PROCESSED'>('ALL');
    const [filterMissingOnly, setFilterMissingOnly] = useState(false);
    const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);

    // Selected Tournament & Stage for Detail Modal
    const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
    const [selectedStageNumber, setSelectedStageNumber] = useState<number>(1);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [stageReport, setStageReport] = useState<StageValidationReport | null>(null);
    const [qualificationPreview, setQualificationPreview] = useState<StageQualificationPreview | null>(null);
    const [stageAuditLogs, setStageAuditLogs] = useState<StageAuditLogEntry[]>([]);

    // Detail Modal Sub-Tabs
    const [detailTab, setDetailTab] = useState<'validation' | 'qualification' | 'missing' | 'audit'>('validation');

    // Action State
    const [validating, setValidating] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Qualification Override Modal State
    const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
    const [overrideTargetTeam, setOverrideTargetTeam] = useState<{ id: string; name: string; currentStatus: 'qualified' | 'eliminated' } | null>(null);
    const [overrideReason, setOverrideReason] = useState('');
    const [overriding, setOverriding] = useState(false);

    // Fetch Summary of all tournaments
    const loadSummaries = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const res = await adminApi.getStagesSummary();
            if (res && res.tournaments) {
                setTournaments(res.tournaments);
            }
        } catch (err: any) {
            console.error('Failed to load stage summaries:', err);
            showToast(err.message || 'Failed to fetch tournament stage summaries', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadSummaries();
    }, []);

    // Load Stage details when selected
    const openStageInspector = async (tournamentId: string, stageNum: number = 1) => {
        setSelectedTournamentId(tournamentId);
        setSelectedStageNumber(stageNum);
        setIsDetailModalOpen(true);
        setDetailLoading(true);
        setDetailTab('validation');

        try {
            const data = await adminApi.getTournamentStages(tournamentId, stageNum);
            if (data) {
                setStageReport(data.selectedStageReport || null);
                setQualificationPreview(data.qualificationPreview || null);
                setStageAuditLogs(data.auditLogs || []);
            }
        } catch (err: any) {
            console.error('Failed to load stage detail:', err);
            showToast(err.message || 'Failed to load stage details', 'error');
        } finally {
            setDetailLoading(false);
        }
    };

    // Run Server-side Validate Stage
    const handleValidateStage = async () => {
        if (!selectedTournamentId) return;
        setValidating(true);
        try {
            const res = await adminApi.validateStage(selectedTournamentId, selectedStageNumber);
            if (res && res.report) {
                setStageReport(res.report);
                setQualificationPreview(res.qualificationPreview || null);
                if (res.report.isReadyToProcess) {
                    showToast(`Stage ${selectedStageNumber} validated! All results complete & ready to process.`, 'success');
                } else {
                    showToast(`Stage ${selectedStageNumber} validation completed: ${res.report.results.missing} missing results.`, 'info');
                }
                // Refresh list summaries in background
                loadSummaries(true);
            }
        } catch (err: any) {
            console.error('Stage validation failed:', err);
            showToast(err.message || 'Validation failed', 'error');
        } finally {
            setValidating(false);
        }
    };

    // Run Server-side Process Stage
    const handleProcessStage = async () => {
        if (!selectedTournamentId || !stageReport) return;
        setProcessing(true);
        try {
            const res = await adminApi.processStage(selectedTournamentId, selectedStageNumber);
            if (res && res.success) {
                showToast(res.message || `Stage ${selectedStageNumber} processed successfully!`, 'success');
                // Reload stage details
                await openStageInspector(selectedTournamentId, selectedStageNumber);
                loadSummaries(true);
            }
        } catch (err: any) {
            console.error('Stage processing failed:', err);
            showToast(err.message || 'Failed to process stage', 'error');
        } finally {
            setProcessing(false);
        }
    };

    // Execute Audited Qualification Override
    const handleExecuteOverride = async () => {
        if (!selectedTournamentId || !overrideTargetTeam) return;
        if (!overrideReason || overrideReason.trim().length < 5) {
            showToast('A detailed reason (min 5 characters) is mandatory to override qualification', 'error');
            return;
        }

        setOverriding(true);
        try {
            const targetStatus = overrideTargetTeam.currentStatus === 'qualified' ? 'eliminated' : 'qualified';
            const res = await adminApi.overrideQualification({
                tournamentId: selectedTournamentId,
                stageNumber: selectedStageNumber,
                teamId: overrideTargetTeam.id,
                newStatus: targetStatus,
                reason: overrideReason.trim()
            });

            if (res && res.success) {
                showToast(`Qualification overridden for ${overrideTargetTeam.name}`, 'success');
                setIsOverrideModalOpen(false);
                setOverrideTargetTeam(null);
                setOverrideReason('');
                // Refresh stage details
                await openStageInspector(selectedTournamentId, selectedStageNumber);
            }
        } catch (err: any) {
            console.error('Override failed:', err);
            showToast(err.message || 'Failed to override qualification', 'error');
        } finally {
            setOverriding(false);
        }
    };

    // Filtering logic
    const filteredTournaments = useMemo(() => {
        return tournaments.filter(t => {
            // Search query matches tournament title, id, orgName, game
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesTitle = t.title.toLowerCase().includes(q);
                const matchesId = t.id.toLowerCase().includes(q);
                const matchesOrg = t.orgName.toLowerCase().includes(q) || (t.orgId && t.orgId.toLowerCase().includes(q));
                const matchesGame = t.game.toLowerCase().includes(q);
                if (!matchesTitle && !matchesId && !matchesOrg && !matchesGame) return false;
            }

            // Status filter
            if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;

            // Validation status filter
            if (validationFilter !== 'ALL' && t.validationStatus !== validationFilter) return false;

            // Processing status filter
            if (processingFilter !== 'ALL' && t.processingStatus !== processingFilter) return false;

            // Missing results filter
            if (filterMissingOnly && t.missingResultsCount === 0) return false;

            // Overdue filter
            if (filterOverdueOnly && !t.isOverdue) return false;

            return true;
        });
    }, [tournaments, searchQuery, statusFilter, validationFilter, processingFilter, filterMissingOnly, filterOverdueOnly]);

    // Summary KPIs
    const kpis = useMemo(() => {
        const total = tournaments.length;
        const incomplete = tournaments.filter(t => t.missingResultsCount > 0 || t.validationStatus === 'FAILED').length;
        const ready = tournaments.filter(t => t.processingStatus === 'READY').length;
        const processed = tournaments.filter(t => t.processingStatus === 'PROCESSED').length;
        const overdue = tournaments.filter(t => t.isOverdue).length;
        return { total, incomplete, ready, processed, overdue };
    }, [tournaments]);

    const currentTournamentSummary = useMemo(() => {
        if (!selectedTournamentId) return null;
        return tournaments.find(t => t.id === selectedTournamentId) || null;
    }, [selectedTournamentId, tournaments]);

    return (
        <div className="space-y-6">
            {/* Header & KPI Summary Cards */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2.5">
                        <Trophy className="w-6 h-6 text-brand-500" />
                        <span>Tournament Results & Stage Management</span>
                    </h2>
                    <p className="text-xs text-gray-400 font-medium mt-1">
                        Authoritative server-side stage validation, missing result tracking, strict processing rules, and qualification engine.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadSummaries(true)}
                        disabled={refreshing}
                        className="px-3 py-2 bg-dark hover:bg-surface border border-gray-800 rounded-xl text-xs font-bold text-gray-300 hover:text-white transition flex items-center gap-1.5"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-brand-500' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-surface border border-gray-800 rounded-2xl p-4 flex flex-col justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-gray-500">Total Tournaments</span>
                    <div className="text-2xl font-black text-white mt-2">{kpis.total}</div>
                    <span className="text-[10px] text-gray-500 font-medium mt-1">Monitored events</span>
                </div>

                <div className={`border rounded-2xl p-4 flex flex-col justify-between ${kpis.incomplete > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-surface border-gray-800'}`}>
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">Results Incomplete</span>
                    <div className="text-2xl font-black text-amber-400 mt-2">{kpis.incomplete}</div>
                    <span className="text-[10px] text-amber-500/80 font-medium mt-1">Action required</span>
                </div>

                <div className={`border rounded-2xl p-4 flex flex-col justify-between ${kpis.ready > 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-surface border-gray-800'}`}>
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">Ready to Process</span>
                    <div className="text-2xl font-black text-emerald-400 mt-2">{kpis.ready}</div>
                    <span className="text-[10px] text-emerald-500/80 font-medium mt-1">100% validated</span>
                </div>

                <div className="bg-surface border border-gray-800 rounded-2xl p-4 flex flex-col justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">Processed Stages</span>
                    <div className="text-2xl font-black text-blue-400 mt-2">{kpis.processed}</div>
                    <span className="text-[10px] text-gray-500 font-medium mt-1">Advanced / finalized</span>
                </div>

                <div className={`border rounded-2xl p-4 flex flex-col justify-between ${kpis.overdue > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-surface border-gray-800'}`}>
                    <span className="text-[11px] font-black uppercase tracking-wider text-red-400">Overdue (48h)</span>
                    <div className="text-2xl font-black text-red-400 mt-2">{kpis.overdue}</div>
                    <span className="text-[10px] text-red-400/80 font-medium mt-1">10% penalty pending</span>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-surface border border-gray-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                        <input
                            type="text"
                            placeholder="Search by Tournament Name, ID, Organizer, or Game..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-dark border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition"
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-dark border border-gray-800 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-300 focus:border-brand-500 focus:outline-none"
                        >
                            <option value="ALL">Status: All</option>
                            <option value="upcoming">Upcoming</option>
                            <option value="live">Live</option>
                            <option value="completed">Completed</option>
                        </select>

                        <select
                            value={validationFilter}
                            onChange={(e) => setValidationFilter(e.target.value as any)}
                            className="bg-dark border border-gray-800 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-300 focus:border-brand-500 focus:outline-none"
                        >
                            <option value="ALL">Validation: All</option>
                            <option value="PASSED">Passed (Ready)</option>
                            <option value="FAILED">Failed (Missing)</option>
                        </select>

                        <select
                            value={processingFilter}
                            onChange={(e) => setProcessingFilter(e.target.value as any)}
                            className="bg-dark border border-gray-800 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-300 focus:border-brand-500 focus:outline-none"
                        >
                            <option value="ALL">Processing: All</option>
                            <option value="READY">Ready</option>
                            <option value="NOT_READY">Not Ready</option>
                            <option value="PROCESSED">Processed</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-gray-800/60 text-xs">
                    <button
                        onClick={() => setFilterMissingOnly(!filterMissingOnly)}
                        className={`px-3 py-1 rounded-lg font-bold border transition ${filterMissingOnly ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-dark text-gray-400 border-gray-800 hover:text-white'}`}
                    >
                        Show Missing Results Only
                    </button>
                    <button
                        onClick={() => setFilterOverdueOnly(!filterOverdueOnly)}
                        className={`px-3 py-1 rounded-lg font-bold border transition ${filterOverdueOnly ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-dark text-gray-400 border-gray-800 hover:text-white'}`}
                    >
                        Show Overdue (48h) Only
                    </button>
                    {(searchQuery || statusFilter !== 'ALL' || validationFilter !== 'ALL' || processingFilter !== 'ALL' || filterMissingOnly || filterOverdueOnly) && (
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setStatusFilter('ALL');
                                setValidationFilter('ALL');
                                setProcessingFilter('ALL');
                                setFilterMissingOnly(false);
                                setFilterOverdueOnly(false);
                            }}
                            className="text-gray-500 hover:text-gray-300 font-bold ml-auto"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Tournaments Master Stage Table */}
            <div className="bg-surface border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-dark/80 text-[10px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-800">
                            <tr>
                                <th className="px-4 py-3.5">Tournament & Org</th>
                                <th className="px-3 py-3.5">Stage</th>
                                <th className="px-3 py-3.5 text-center">Groups</th>
                                <th className="px-3 py-3.5 text-center">Teams</th>
                                <th className="px-3 py-3.5 text-center">Matches</th>
                                <th className="px-3 py-3.5 text-center">Results Progress</th>
                                <th className="px-3 py-3.5 text-center">Stage Validation</th>
                                <th className="px-3 py-3.5 text-center">Processing</th>
                                <th className="px-3 py-3.5 text-center">48h Deadline</th>
                                <th className="px-4 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="py-16 text-center text-gray-500">
                                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        <p className="font-bold">Analyzing tournament stages and results...</p>
                                    </td>
                                </tr>
                            ) : filteredTournaments.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-gray-500 font-medium">
                                        No tournaments match the selected filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredTournaments.map((t) => {
                                    const stage = t.stages[0];
                                    const isProcessed = t.processingStatus === 'PROCESSED';
                                    const isReady = t.processingStatus === 'READY';
                                    const hasMissing = t.missingResultsCount > 0;

                                    return (
                                        <tr key={t.id} className="hover:bg-dark/40 transition-colors">
                                            <td className="px-4 py-3.5">
                                                <div className="font-black text-white text-sm truncate max-w-[220px]">{t.title}</div>
                                                <div className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                                                    <span className="font-mono text-gray-400">ID: {t.id.slice(0, 8)}...</span>
                                                    <span>•</span>
                                                    <span className="text-brand-400 font-bold">{t.orgName}</span>
                                                </div>
                                            </td>

                                            <td className="px-3 py-3.5">
                                                <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20 font-black text-[10px] uppercase">
                                                    Stage {t.currentStage}
                                                </span>
                                            </td>

                                            <td className="px-3 py-3.5 text-center font-bold text-gray-300">
                                                {t.totalGroups}
                                            </td>

                                            <td className="px-3 py-3.5 text-center font-bold text-gray-300">
                                                {t.totalTeams}
                                            </td>

                                            <td className="px-3 py-3.5 text-center font-bold text-gray-300">
                                                {t.totalMatches}
                                            </td>

                                            <td className="px-3 py-3.5 text-center">
                                                <div className="font-black text-xs text-white">
                                                    {t.completedResults} / {stage?.results.expected || (t.totalTeams * t.totalMatches)}
                                                </div>
                                                {hasMissing ? (
                                                    <span className="text-[10px] font-bold text-amber-400 flex items-center justify-center gap-1 mt-0.5">
                                                        <AlertTriangle className="w-3 h-3 shrink-0" />
                                                        <span>{t.missingResultsCount} missing</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-emerald-400 flex items-center justify-center gap-0.5 mt-0.5">
                                                        <Check className="w-3 h-3 shrink-0" />
                                                        <span>100% complete</span>
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-3 py-3.5 text-center">
                                                {t.validationStatus === 'PASSED' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black text-[10px] uppercase">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        <span>Passed</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-black text-[10px] uppercase">
                                                        <XCircle className="w-3 h-3" />
                                                        <span>Incomplete</span>
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-3 py-3.5 text-center">
                                                {isProcessed ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-black text-[10px] uppercase">
                                                        <Lock className="w-3 h-3" />
                                                        <span>Processed</span>
                                                    </span>
                                                ) : isReady ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-black text-[10px] uppercase animate-pulse">
                                                        <Zap className="w-3 h-3" />
                                                        <span>Ready</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-800 text-gray-400 font-black text-[10px] uppercase">
                                                        <span>Not Ready</span>
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-3 py-3.5 text-center">
                                                {t.isOverdue ? (
                                                    <div className="text-[10px] text-red-400 font-black">
                                                        <div>OVERDUE</div>
                                                        <div className="text-[9px] text-gray-500">10% penalty</div>
                                                    </div>
                                                ) : t.resultDeadlineAt ? (
                                                    <div className="text-[10px] text-gray-400 font-bold">
                                                        <div className="text-white font-mono">{t.hoursRemaining}h left</div>
                                                        <div className="text-[9px] text-gray-500">48h window</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-gray-500 font-medium">Pending match</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => openStageInspector(t.id, t.currentStage)}
                                                        className="px-2.5 py-1.5 bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white border border-brand-500/30 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1"
                                                        title="Stage Validation & Processing"
                                                    >
                                                        <Layers className="w-3 h-3" />
                                                        <span>Stage</span>
                                                    </button>
                                                    <button
                                                        onClick={() => navigate(`/admin/results/${t.id}`)}
                                                        className="px-2.5 py-1.5 bg-dark hover:bg-surface text-gray-400 hover:text-white border border-gray-800 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1"
                                                        title="Open Result Center"
                                                    >
                                                        <Edit3 className="w-3 h-3" />
                                                        <span>Results</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Stage Inspector Modal (Full Feature Review, Validation & Processing) */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                title={`Stage Validation & Processing - ${currentTournamentSummary?.title || 'Tournament'}`}
            >
                {detailLoading ? (
                    <div className="py-20 text-center text-gray-500">
                        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="font-bold text-xs uppercase tracking-widest">Inspecting Stage & Results...</p>
                    </div>
                ) : !stageReport ? (
                    <div className="py-12 text-center text-gray-500">
                        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                        <p className="font-bold">No stage data available</p>
                    </div>
                ) : (
                    <div className="space-y-5 max-h-[75vh] overflow-y-auto px-1 custom-scrollbar">
                        {/* Stage Selector Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark p-3.5 rounded-2xl border border-gray-800">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase text-gray-400">Inspecting:</span>
                                <span className="px-3 py-1 bg-brand-500 text-white rounded-lg text-xs font-black uppercase">
                                    Stage {selectedStageNumber}: {stageReport.stageName}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleValidateStage}
                                    disabled={validating}
                                    className="px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${validating ? 'animate-spin' : ''}`} />
                                    <span>Validate Stage</span>
                                </button>
                                {stageReport.isReadyToProcess ? (
                                    <button
                                        onClick={handleProcessStage}
                                        disabled={processing}
                                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                                    >
                                        <Zap className="w-3.5 h-3.5" />
                                        <span>{processing ? 'Processing...' : 'Process Stage'}</span>
                                    </button>
                                ) : (
                                    <button
                                        disabled
                                        className="px-4 py-1.5 bg-gray-800 text-gray-500 rounded-xl text-xs font-black uppercase tracking-wider cursor-not-allowed"
                                        title="Cannot process: results are incomplete"
                                    >
                                        Process Stage (Locked)
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Status Alert Banner */}
                        {stageReport.isReadyToProcess ? (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                                    <div>
                                        <h4 className="text-sm font-black text-emerald-400 uppercase tracking-wider">STAGE READY TO PROCESS</h4>
                                        <p className="text-xs text-gray-300">
                                            All {stageReport.groups.total} groups, {stageReport.teams.total} teams, and {stageReport.matches.total} matches have complete and valid results.
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs font-black text-emerald-400 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 whitespace-nowrap">
                                    100% VALID
                                </span>
                            </div>
                        ) : stageReport.processingStatus === 'PROCESSED' ? (
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-center gap-3">
                                <Lock className="w-6 h-6 text-blue-400 shrink-0" />
                                <div>
                                    <h4 className="text-sm font-black text-blue-400 uppercase tracking-wider">STAGE ALREADY PROCESSED</h4>
                                    <p className="text-xs text-gray-300">
                                        This stage has been finalized and processed. Qualifications have been determined and duplicate processing is strictly blocked.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-black text-amber-400 uppercase tracking-wider">STAGE CANNOT BE PROCESSED</h4>
                                        <p className="text-xs text-gray-300">
                                            {stageReport.results.missing} required result(s) are missing or incomplete. Stage processing is strictly blocked by backend rules.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setDetailTab('missing')}
                                    className="self-start sm:self-auto px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-black uppercase tracking-wider transition whitespace-nowrap"
                                >
                                    View Missing Results ({stageReport.missingResults.length})
                                </button>
                            </div>
                        )}

                        {/* Stage Dashboard KPI Matrix */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-dark p-3.5 rounded-xl border border-gray-800">
                                <span className="text-[10px] font-black uppercase text-gray-500 block">Groups</span>
                                <div className="text-lg font-black text-white mt-1 flex items-center justify-between">
                                    <span>{stageReport.groups.completed} / {stageReport.groups.total}</span>
                                    {stageReport.groups.isValid ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                                </div>
                            </div>

                            <div className="bg-dark p-3.5 rounded-xl border border-gray-800">
                                <span className="text-[10px] font-black uppercase text-gray-500 block">Teams / Players</span>
                                <div className="text-lg font-black text-white mt-1 flex items-center justify-between">
                                    <span>{stageReport.teams.participating} / {stageReport.teams.total}</span>
                                    {stageReport.teams.isValid ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                                </div>
                            </div>

                            <div className="bg-dark p-3.5 rounded-xl border border-gray-800">
                                <span className="text-[10px] font-black uppercase text-gray-500 block">Matches</span>
                                <div className="text-lg font-black text-white mt-1 flex items-center justify-between">
                                    <span>{stageReport.matches.completed} / {stageReport.matches.total}</span>
                                    {stageReport.matches.isValid ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                                </div>
                            </div>

                            <div className="bg-dark p-3.5 rounded-xl border border-gray-800">
                                <span className="text-[10px] font-black uppercase text-gray-500 block">Results Recorded</span>
                                <div className="text-lg font-black text-white mt-1 flex items-center justify-between">
                                    <span>{stageReport.results.recorded} / {stageReport.results.expected}</span>
                                    {stageReport.results.isValid ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                                </div>
                            </div>
                        </div>

                        {/* Inspector Navigation Sub-tabs */}
                        <div className="flex border-b border-gray-800 gap-4 text-xs font-black uppercase tracking-wider">
                            <button
                                onClick={() => setDetailTab('validation')}
                                className={`pb-2.5 transition-colors border-b-2 ${detailTab === 'validation' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                Stage Validation Report
                            </button>
                            <button
                                onClick={() => setDetailTab('qualification')}
                                className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${detailTab === 'qualification' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <Award className="w-3.5 h-3.5" />
                                <span>Qualification Preview ({qualificationPreview?.totalQualified || 0})</span>
                            </button>
                            <button
                                onClick={() => setDetailTab('missing')}
                                className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${detailTab === 'missing' ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Missing & Invalid ({stageReport.missingResults.length + stageReport.invalidResults.length})</span>
                            </button>
                            <button
                                onClick={() => setDetailTab('audit')}
                                className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${detailTab === 'audit' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <History className="w-3.5 h-3.5" />
                                <span>Audit Log ({stageAuditLogs.length})</span>
                            </button>
                        </div>

                        {/* Sub-Tab 1: Stage Validation Report */}
                        {detailTab === 'validation' && (
                            <div className="space-y-4">
                                <div className="bg-dark p-4 rounded-2xl border border-gray-800 space-y-3">
                                    <h5 className="text-xs font-black uppercase tracking-wider text-gray-400">Server-Side Validation Breakdown</h5>
                                    <div className="divide-y divide-gray-800/80 text-xs">
                                        <div className="py-2.5 flex items-center justify-between">
                                            <span className="text-gray-400">Groups Setup:</span>
                                            <span className="font-bold text-white flex items-center gap-1">
                                                {stageReport.groups.completed}/{stageReport.groups.total} groups ready
                                                {stageReport.groups.isValid ? ' ✅' : ' ❌'}
                                            </span>
                                        </div>
                                        <div className="py-2.5 flex items-center justify-between">
                                            <span className="text-gray-400">Teams & Roster Verification:</span>
                                            <span className="font-bold text-white flex items-center gap-1">
                                                {stageReport.teams.participating}/{stageReport.teams.total} registered
                                                {stageReport.teams.isValid ? ' ✅' : ' ❌'}
                                            </span>
                                        </div>
                                        <div className="py-2.5 flex items-center justify-between">
                                            <span className="text-gray-400">Matches Scheduled & Completed:</span>
                                            <span className="font-bold text-white flex items-center gap-1">
                                                {stageReport.matches.completed}/{stageReport.matches.total} completed
                                                {stageReport.matches.isValid ? ' ✅' : ' ❌'}
                                            </span>
                                        </div>
                                        <div className="py-2.5 flex items-center justify-between">
                                            <span className="text-gray-400">Results Coverage:</span>
                                            <span className="font-bold text-white flex items-center gap-1">
                                                {stageReport.results.recorded}/{stageReport.results.expected} recorded
                                                {stageReport.results.isValid ? ' ✅' : ' ❌'}
                                            </span>
                                        </div>
                                        <div className="py-2.5 flex items-center justify-between">
                                            <span className="text-gray-400">Scoring Engine Validation:</span>
                                            <span className="font-bold text-white flex items-center gap-1">
                                                Placement Points + Kill Points active
                                                {stageReport.scoringValid ? ' ✅' : ' ❌'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Sub-Tab 2: Qualification Preview */}
                        {detailTab === 'qualification' && qualificationPreview && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between bg-dark p-3.5 rounded-xl border border-gray-800 text-xs">
                                    <div className="flex items-center gap-2">
                                        <Award className="w-4 h-4 text-brand-400" />
                                        <span className="font-black text-white uppercase">Qualification Rule:</span>
                                        <span className="text-gray-400">Top {qualificationPreview.advancingPerGroup} teams per group qualify for next round</span>
                                    </div>
                                    <span className="text-emerald-400 font-black">{qualificationPreview.totalQualified} Qualified / {qualificationPreview.totalEliminated} Eliminated</span>
                                </div>

                                {qualificationPreview.tiesRequiringReview.length > 0 && (
                                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-300">
                                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-black uppercase">Ties Detected at Cutoff:</p>
                                            <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-300">
                                                {qualificationPreview.tiesRequiringReview.map((t, idx) => (
                                                    <li key={idx}>
                                                        {t.groupName} - {t.teamName} ({t.points} pts) tied at qualification cutoff.
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Qualified Teams Column */}
                                    <div className="bg-dark rounded-2xl border border-emerald-500/20 overflow-hidden">
                                        <div className="bg-emerald-500/10 px-4 py-3 border-b border-emerald-500/20 flex items-center justify-between">
                                            <h6 className="font-black text-emerald-400 uppercase tracking-wider text-xs flex items-center gap-1.5">
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span>Qualified ({qualificationPreview.qualified.length})</span>
                                            </h6>
                                            <span className="text-[10px] text-gray-500 font-bold uppercase">Advances</span>
                                        </div>
                                        <div className="divide-y divide-gray-800 max-h-72 overflow-y-auto custom-scrollbar">
                                            {qualificationPreview.qualified.map(q => (
                                                <div key={q.teamId} className="p-3 flex items-center justify-between text-xs hover:bg-surface/50">
                                                    <div>
                                                        <div className="font-black text-white flex items-center gap-1.5">
                                                            <span className="text-emerald-400 font-mono">#{q.rank}</span>
                                                            <span>{q.teamName}</span>
                                                            {q.isOverridden && (
                                                                <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-bold">
                                                                    OVERRIDDEN
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 mt-0.5">
                                                            {q.groupName} • {q.totalPoints} pts ({q.placementPoints} place + {q.killPoints} kills)
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setOverrideTargetTeam({ id: q.teamId, name: q.teamName, currentStatus: 'qualified' });
                                                            setIsOverrideModalOpen(true);
                                                        }}
                                                        className="px-2 py-1 bg-dark hover:bg-surface border border-gray-800 rounded text-[10px] font-bold text-gray-400 hover:text-white"
                                                    >
                                                        Override
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Eliminated Teams Column */}
                                    <div className="bg-dark rounded-2xl border border-red-500/20 overflow-hidden">
                                        <div className="bg-red-500/10 px-4 py-3 border-b border-red-500/20 flex items-center justify-between">
                                            <h6 className="font-black text-red-400 uppercase tracking-wider text-xs flex items-center gap-1.5">
                                                <XCircle className="w-4 h-4" />
                                                <span>Eliminated ({qualificationPreview.eliminated.length})</span>
                                            </h6>
                                            <span className="text-[10px] text-gray-500 font-bold uppercase">Knocked Out</span>
                                        </div>
                                        <div className="divide-y divide-gray-800 max-h-72 overflow-y-auto custom-scrollbar">
                                            {qualificationPreview.eliminated.map(e => (
                                                <div key={e.teamId} className="p-3 flex items-center justify-between text-xs hover:bg-surface/50">
                                                    <div>
                                                        <div className="font-black text-gray-300 flex items-center gap-1.5">
                                                            <span className="text-gray-500 font-mono">#{e.rank}</span>
                                                            <span>{e.teamName}</span>
                                                            {e.isOverridden && (
                                                                <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-bold">
                                                                    OVERRIDDEN
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 mt-0.5">
                                                            {e.groupName} • {e.totalPoints} pts ({e.placementPoints} place + {e.killPoints} kills)
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setOverrideTargetTeam({ id: e.teamId, name: e.teamName, currentStatus: 'eliminated' });
                                                            setIsOverrideModalOpen(true);
                                                        }}
                                                        className="px-2 py-1 bg-dark hover:bg-surface border border-gray-800 rounded text-[10px] font-bold text-gray-400 hover:text-white"
                                                    >
                                                        Override
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Sub-Tab 3: Missing & Invalid Results */}
                        {detailTab === 'missing' && (
                            <div className="space-y-4">
                                {stageReport.missingResults.length === 0 && stageReport.invalidResults.length === 0 ? (
                                    <div className="py-12 text-center text-gray-500">
                                        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                                        <p className="font-black text-white text-sm">NO MISSING OR INVALID RESULTS</p>
                                        <p className="text-xs text-gray-400 mt-1">All team scores are recorded and validated.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Missing Results List */}
                                        {stageReport.missingResults.length > 0 && (
                                            <div className="bg-dark rounded-2xl border border-amber-500/30 overflow-hidden">
                                                <div className="bg-amber-500/10 px-4 py-3 border-b border-amber-500/30 flex items-center justify-between">
                                                    <h6 className="font-black text-amber-400 uppercase tracking-wider text-xs flex items-center gap-2">
                                                        <AlertTriangle className="w-4 h-4" />
                                                        <span>Missing Results ({stageReport.missingResults.length})</span>
                                                    </h6>
                                                </div>
                                                <div className="divide-y divide-gray-800 max-h-60 overflow-y-auto custom-scrollbar">
                                                    {stageReport.missingResults.map((m, idx) => (
                                                        <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                                            <div>
                                                                <div className="font-black text-white flex items-center gap-1.5">
                                                                    <span className="text-amber-400">{m.groupName}</span>
                                                                    <span>&rarr;</span>
                                                                    <span>{m.teamName}</span>
                                                                    <span>&rarr;</span>
                                                                    <span className="text-gray-400">Match #{m.matchNumber} ({m.map || 'Bermuda'})</span>
                                                                </div>
                                                                <p className="text-[10px] text-gray-500 mt-0.5">{m.reason}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setIsDetailModalOpen(false);
                                                                    navigate(`/admin/results/${selectedTournamentId}?matchId=${m.matchId}`);
                                                                }}
                                                                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1 self-start sm:self-auto"
                                                            >
                                                                <span>View & Enter Result</span>
                                                                <ExternalLink className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Invalid Results List */}
                                        {stageReport.invalidResults.length > 0 && (
                                            <div className="bg-dark rounded-2xl border border-red-500/30 overflow-hidden">
                                                <div className="bg-red-500/10 px-4 py-3 border-b border-red-500/30 flex items-center justify-between">
                                                    <h6 className="font-black text-red-400 uppercase tracking-wider text-xs flex items-center gap-2">
                                                        <XCircle className="w-4 h-4" />
                                                        <span>Invalid Results ({stageReport.invalidResults.length})</span>
                                                    </h6>
                                                </div>
                                                <div className="divide-y divide-gray-800 max-h-60 overflow-y-auto custom-scrollbar">
                                                    {stageReport.invalidResults.map((inv, idx) => (
                                                        <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                                            <div>
                                                                <div className="font-black text-red-400">
                                                                    {inv.groupName} &rarr; {inv.teamName} (Match #{inv.matchNumber})
                                                                </div>
                                                                <p className="text-xs text-gray-300 mt-0.5">{inv.reason}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setIsDetailModalOpen(false);
                                                                    navigate(`/admin/results/${selectedTournamentId}?matchId=${inv.matchId}`);
                                                                }}
                                                                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider transition self-start sm:self-auto"
                                                            >
                                                                Correct Match Result
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/* Sub-Tab 4: Audit Logs */}
                        {detailTab === 'audit' && (
                            <div className="bg-dark rounded-2xl border border-gray-800 overflow-hidden">
                                <div className="divide-y divide-gray-800 max-h-72 overflow-y-auto custom-scrollbar">
                                    {stageAuditLogs.length === 0 ? (
                                        <div className="py-12 text-center text-gray-500 text-xs">No stage audit entries yet.</div>
                                    ) : (
                                        stageAuditLogs.map(log => (
                                            <div key={log.id} className="p-3.5 text-xs space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-black text-brand-400 uppercase tracking-wider text-[11px]">{log.action}</span>
                                                    <span className="text-[10px] text-gray-500">{new Date((log.timestamp as any)?.seconds ? (log.timestamp as any).seconds * 1000 : log.timestamp).toLocaleString()}</span>
                                                </div>
                                                <p className="text-gray-300">{log.details || log.reason || `Action executed by ${log.actor?.email || (log as any).adminEmail || 'admin'}`}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Audited Qualification Override Modal */}
            <Modal
                isOpen={isOverrideModalOpen}
                onClose={() => !overriding && setIsOverrideModalOpen(false)}
                title={`Override Qualification - ${overrideTargetTeam?.name || ''}`}
            >
                {overrideTargetTeam && (
                    <div className="space-y-4">
                        <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3.5 text-xs space-y-1.5">
                            <span className="text-brand-400 font-black uppercase">Audited Action:</span>
                            <p className="text-gray-300">
                                You are about to change the status of <span className="font-bold text-white">{overrideTargetTeam.name}</span> from{' '}
                                <span className={`font-black uppercase ${overrideTargetTeam.currentStatus === 'qualified' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {overrideTargetTeam.currentStatus}
                                </span>{' '}
                                to{' '}
                                <span className={`font-black uppercase ${overrideTargetTeam.currentStatus === 'qualified' ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {overrideTargetTeam.currentStatus === 'qualified' ? 'eliminated' : 'qualified'}
                                </span>.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">
                                Reason for Override <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={overrideReason}
                                onChange={(e) => setOverrideReason(e.target.value)}
                                placeholder="Explain why this team is being manually qualified or eliminated (e.g., penalty adjustment, verified tie-breaker rule, admin discretion)..."
                                rows={3}
                                className="w-full bg-dark border border-gray-800 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                            />
                            <span className="text-[10px] text-gray-500 mt-1 block">Minimum 5 characters. This reason is permanently recorded in the audit log.</span>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                disabled={overriding}
                                onClick={() => setIsOverrideModalOpen(false)}
                                className="flex-1 bg-dark hover:bg-surface text-gray-300 py-2.5 rounded-xl text-xs font-bold border border-gray-800 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={overriding || overrideReason.trim().length < 5}
                                onClick={handleExecuteOverride}
                                className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-brand-500/20"
                            >
                                {overriding ? 'Saving...' : 'Confirm Override'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
