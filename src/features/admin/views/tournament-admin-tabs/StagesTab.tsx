import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
    Layers,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    RefreshCw,
    Award,
    Zap,
    Lock,
    ExternalLink,
    Check,
    X,
    FileText,
    History
} from 'lucide-react';
import { TournamentAdminTabProps } from './types';
import { adminApi } from '../../../../shared/services/adminApiClient';
import Modal from '../../../../shared/components/Modal';
import type {
    StageValidationReport,
    StageQualificationPreview,
    StageAuditLogEntry
} from '../../../../shared/types/stage-validation';

export const StagesTab: React.FC<TournamentAdminTabProps> = ({ tournament, showToast }) => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [selectedStage, setSelectedStage] = useState<number>(tournament.currentStage || 1);
    const [stageReport, setStageReport] = useState<StageValidationReport | null>(null);
    const [qualificationPreview, setQualificationPreview] = useState<StageQualificationPreview | null>(null);
    const [auditLogs, setAuditLogs] = useState<StageAuditLogEntry[]>([]);

    const [validating, setValidating] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Override Modal
    const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
    const [targetTeam, setTargetTeam] = useState<{ id: string; name: string; currentStatus: 'qualified' | 'eliminated' } | null>(null);
    const [overrideReason, setOverrideReason] = useState('');
    const [overriding, setOverriding] = useState(false);

    const loadStageData = async (stageNum: number) => {
        setLoading(true);
        try {
            const data = await adminApi.getTournamentStages(tournament.id, stageNum);
            if (data) {
                setStageReport(data.selectedStageReport || null);
                setQualificationPreview(data.qualificationPreview || null);
                setAuditLogs(data.auditLogs || []);
            }
        } catch (err: any) {
            console.error('Failed to load tournament stage data:', err);
            showToast(err.message || 'Failed to load stage data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStageData(selectedStage);
    }, [tournament.id, selectedStage]);

    const handleValidate = async () => {
        setValidating(true);
        try {
            const res = await adminApi.validateStage(tournament.id, selectedStage);
            if (res && res.report) {
                setStageReport(res.report);
                setQualificationPreview(res.qualificationPreview || null);
                if (res.report.isReadyToProcess) {
                    showToast(`Stage ${selectedStage} validated! Ready to process.`, 'success');
                } else {
                    showToast(`Stage ${selectedStage} has ${res.report.results.missing} missing results.`, 'info');
                }
            }
        } catch (err: any) {
            console.error('Validation error:', err);
            showToast(err.message || 'Validation failed', 'error');
        } finally {
            setValidating(false);
        }
    };

    const handleProcess = async () => {
        setProcessing(true);
        try {
            const res = await adminApi.processStage(tournament.id, selectedStage);
            if (res && res.success) {
                showToast(res.message || `Stage ${selectedStage} processed!`, 'success');
                await loadStageData(selectedStage);
            }
        } catch (err: any) {
            console.error('Processing error:', err);
            showToast(err.message || 'Failed to process stage', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleOverrideSubmit = async () => {
        if (!targetTeam || overrideReason.trim().length < 5) {
            showToast('A detailed reason (min 5 characters) is required', 'error');
            return;
        }
        setOverriding(true);
        try {
            const nextStatus = targetTeam.currentStatus === 'qualified' ? 'eliminated' : 'qualified';
            const res = await adminApi.overrideQualification({
                tournamentId: tournament.id,
                stageNumber: selectedStage,
                teamId: targetTeam.id,
                newStatus: nextStatus,
                reason: overrideReason.trim()
            });
            if (res && res.success) {
                showToast(`Qualification overridden for ${targetTeam.name}`, 'success');
                setIsOverrideModalOpen(false);
                setTargetTeam(null);
                setOverrideReason('');
                await loadStageData(selectedStage);
            }
        } catch (err: any) {
            console.error('Override error:', err);
            showToast(err.message || 'Failed to override qualification', 'error');
        } finally {
            setOverriding(false);
        }
    };

    const totalStages = Math.max(1, Array.isArray(tournament.stages) ? tournament.stages.length : 1);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
        >
            {/* Header & Stage Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
                <div>
                    <h2 className="text-base sm:text-lg font-black uppercase tracking-widest text-white flex items-center gap-2">
                        <Layers className="w-5 h-5 text-brand-500" />
                        <span>Stage Result Validation & Processing</span>
                    </h2>
                    <p className="text-xs text-gray-500 font-bold mt-0.5">
                        Authoritative server-side result checks, strict completion gating, and qualification progression.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {Array.from({ length: totalStages }, (_, i) => i + 1).map((sNum) => (
                        <button
                            key={sNum}
                            onClick={() => setSelectedStage(sNum)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                                selectedStage === sNum
                                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                                    : 'bg-dark border border-gray-800 text-gray-400 hover:text-white'
                            }`}
                        >
                            Stage {sNum}
                        </button>
                    ))}
                    <button
                        onClick={handleValidate}
                        disabled={validating}
                        className="px-3.5 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 ml-2"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${validating ? 'animate-spin' : ''}`} />
                        <span>Validate Stage</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center text-gray-500">
                    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="font-bold text-xs uppercase">Validating Stage {selectedStage}...</p>
                </div>
            ) : !stageReport ? (
                <div className="py-12 text-center text-gray-500 font-bold">No stage data available.</div>
            ) : (
                <div className="space-y-6">
                    {/* Stage Status Alert Banner */}
                    {stageReport.isReadyToProcess ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                                <div>
                                    <h4 className="text-sm font-black text-emerald-400 uppercase tracking-wider">STAGE READY TO PROCESS</h4>
                                    <p className="text-xs text-gray-300">
                                        All results across all groups and matches have been verified server-side.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleProcess}
                                disabled={processing}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 self-start sm:self-auto"
                            >
                                <Zap className="w-3.5 h-3.5" />
                                <span>{processing ? 'Processing...' : 'Process Stage'}</span>
                            </button>
                        </div>
                    ) : stageReport.processingStatus === 'PROCESSED' ? (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-center gap-3">
                            <Lock className="w-6 h-6 text-blue-400 shrink-0" />
                            <div>
                                <h4 className="text-sm font-black text-blue-400 uppercase tracking-wider">STAGE PROCESSED & FINALIZED</h4>
                                <p className="text-xs text-gray-300">
                                    Stage results and qualifications have been processed. Duplicate processing is locked.
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
                                        {stageReport.results.missing} required result(s) are missing. All match results must be complete before advancing.
                                    </p>
                                </div>
                            </div>
                            <button
                                disabled
                                className="px-4 py-2 bg-gray-800 text-gray-500 rounded-xl text-xs font-black uppercase tracking-wider cursor-not-allowed self-start sm:self-auto"
                            >
                                Process Stage (Locked)
                            </button>
                        </div>
                    )}

                    {/* Stage Dashboard KPI Card */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-dark p-4 rounded-xl border border-gray-800">
                            <span className="text-[10px] font-black uppercase text-gray-500 block">Groups</span>
                            <div className="text-xl font-black text-white mt-1 flex items-center justify-between">
                                <span>{stageReport.groups.completed} / {stageReport.groups.total}</span>
                                {stageReport.groups.isValid ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                            </div>
                        </div>

                        <div className="bg-dark p-4 rounded-xl border border-gray-800">
                            <span className="text-[10px] font-black uppercase text-gray-500 block">Teams</span>
                            <div className="text-xl font-black text-white mt-1 flex items-center justify-between">
                                <span>{stageReport.teams.participating} / {stageReport.teams.total}</span>
                                {stageReport.teams.isValid ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                            </div>
                        </div>

                        <div className="bg-dark p-4 rounded-xl border border-gray-800">
                            <span className="text-[10px] font-black uppercase text-gray-500 block">Matches</span>
                            <div className="text-xl font-black text-white mt-1 flex items-center justify-between">
                                <span>{stageReport.matches.completed} / {stageReport.matches.total}</span>
                                {stageReport.matches.isValid ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                            </div>
                        </div>

                        <div className="bg-dark p-4 rounded-xl border border-gray-800">
                            <span className="text-[10px] font-black uppercase text-gray-500 block">Results Recorded</span>
                            <div className="text-xl font-black text-white mt-1 flex items-center justify-between">
                                <span>{stageReport.results.recorded} / {stageReport.results.expected}</span>
                                {stageReport.results.isValid ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                            </div>
                        </div>
                    </div>

                    {/* Missing Results Section */}
                    {stageReport.missingResults.length > 0 && (
                        <div className="bg-dark rounded-2xl border border-amber-500/30 overflow-hidden">
                            <div className="bg-amber-500/10 px-4 py-3 border-b border-amber-500/30 flex items-center justify-between">
                                <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span>Missing Results ({stageReport.missingResults.length})</span>
                                </h3>
                            </div>
                            <div className="divide-y divide-gray-800 max-h-60 overflow-y-auto custom-scrollbar">
                                {stageReport.missingResults.map((m, idx) => (
                                    <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                        <div>
                                            <span className="font-black text-white">
                                                {m.groupName} &rarr; <span className="text-amber-400">{m.teamName}</span> &rarr; Match #{m.matchNumber} ({m.map || 'Bermuda'})
                                            </span>
                                            <p className="text-[10px] text-gray-500 mt-0.5">{m.reason}</p>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/admin/results/${tournament.id}?matchId=${m.matchId}`)}
                                            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1 self-start sm:self-auto"
                                        >
                                            <span>Enter Result</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Qualification Preview */}
                    {qualificationPreview && (
                        <div className="bg-dark rounded-2xl border border-gray-800 overflow-hidden p-4 space-y-4">
                            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                                <div className="flex items-center gap-2">
                                    <Award className="w-4 h-4 text-brand-400" />
                                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                                        Qualification Preview (Top {qualificationPreview.advancingPerGroup} Advance)
                                    </h3>
                                </div>
                                <span className="text-xs font-black text-emerald-400">
                                    {qualificationPreview.totalQualified} Qualified • {qualificationPreview.totalEliminated} Eliminated
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Qualified */}
                                <div className="border border-emerald-500/20 rounded-xl overflow-hidden bg-surface/30">
                                    <div className="bg-emerald-500/10 px-3 py-2 border-b border-emerald-500/20 font-black text-emerald-400 text-xs">
                                        Qualified ({qualificationPreview.qualified.length})
                                    </div>
                                    <div className="divide-y divide-gray-800 max-h-56 overflow-y-auto custom-scrollbar">
                                        {qualificationPreview.qualified.map(q => (
                                            <div key={q.teamId} className="p-2.5 flex items-center justify-between text-xs hover:bg-dark">
                                                <div>
                                                    <span className="font-bold text-white">#{q.rank} {q.teamName}</span>
                                                    <span className="text-[10px] text-gray-500 block">{q.groupName} • {q.totalPoints} pts</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setTargetTeam({ id: q.teamId, name: q.teamName, currentStatus: 'qualified' });
                                                        setIsOverrideModalOpen(true);
                                                    }}
                                                    className="px-2 py-0.5 bg-dark border border-gray-800 rounded text-[9px] font-bold text-gray-400 hover:text-white"
                                                >
                                                    Override
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Eliminated */}
                                <div className="border border-red-500/20 rounded-xl overflow-hidden bg-surface/30">
                                    <div className="bg-red-500/10 px-3 py-2 border-b border-red-500/20 font-black text-red-400 text-xs">
                                        Eliminated ({qualificationPreview.eliminated.length})
                                    </div>
                                    <div className="divide-y divide-gray-800 max-h-56 overflow-y-auto custom-scrollbar">
                                        {qualificationPreview.eliminated.map(e => (
                                            <div key={e.teamId} className="p-2.5 flex items-center justify-between text-xs hover:bg-dark">
                                                <div>
                                                    <span className="font-bold text-gray-400">#{e.rank} {e.teamName}</span>
                                                    <span className="text-[10px] text-gray-500 block">{e.groupName} • {e.totalPoints} pts</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setTargetTeam({ id: e.teamId, name: e.teamName, currentStatus: 'eliminated' });
                                                        setIsOverrideModalOpen(true);
                                                    }}
                                                    className="px-2 py-0.5 bg-dark border border-gray-800 rounded text-[9px] font-bold text-gray-400 hover:text-white"
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
                </div>
            )}

            {/* Audited Override Modal */}
            <Modal
                isOpen={isOverrideModalOpen}
                onClose={() => !overriding && setIsOverrideModalOpen(false)}
                title={`Override Qualification - ${targetTeam?.name || ''}`}
            >
                {targetTeam && (
                    <div className="space-y-4">
                        <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3 text-xs space-y-1">
                            <span className="text-brand-400 font-black uppercase">Audited Override:</span>
                            <p className="text-gray-300">
                                Change <span className="font-bold text-white">{targetTeam.name}</span> from{' '}
                                <span className={`font-black uppercase ${targetTeam.currentStatus === 'qualified' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {targetTeam.currentStatus}
                                </span>{' '}
                                to{' '}
                                <span className={`font-black uppercase ${targetTeam.currentStatus === 'qualified' ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {targetTeam.currentStatus === 'qualified' ? 'eliminated' : 'qualified'}
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
                                placeholder="Mandatory reason for audit log (min 5 characters)..."
                                rows={3}
                                className="w-full bg-dark border border-gray-800 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                            />
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
                                onClick={handleOverrideSubmit}
                                className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition"
                            >
                                {overriding ? 'Saving...' : 'Confirm Override'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </motion.div>
    );
};
