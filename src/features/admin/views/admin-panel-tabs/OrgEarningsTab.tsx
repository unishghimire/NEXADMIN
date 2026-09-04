import React, { useState } from 'react';
import { DollarSign, Percent, ShieldCheck, Clock, Trophy } from 'lucide-react';
import { AdminPanelTabProps } from './types';
import { TournamentEarning } from '../../../../shared/types/types';

export const OrgEarningsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { formatCurrency, formatDate, handleReleaseEarnings, tournamentEarnings } = props;
    const [releasingId, setReleasingId] = useState<string | null>(null);

    const earningsList: TournamentEarning[] = tournamentEarnings || [];

    const totalPlatformCommission = earningsList.reduce((acc, e) => acc + (Number(e.nexplayShare) || 0), 0);
    const totalOrgShare = earningsList.reduce((acc, e) => acc + (Number(e.orgShare) || 0), 0);
    const pendingOrgShare = earningsList.filter(e => e.status === 'pending').reduce((acc, e) => acc + (Number(e.orgShare) || 0), 0);
    const pendingCount = earningsList.filter(e => e.status === 'pending').length;

    return (
        <div className="space-y-6">
            {/* Top Financial KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card p-5 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 to-transparent">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Platform Commission (15%)</span>
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                            <Percent className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-emerald-400 tracking-tight">
                        {formatCurrency ? formatCurrency(totalPlatformCommission) : `Rs. ${totalPlatformCommission.toLocaleString()}`}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 font-medium">Net platform cut from completed matches</p>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-950/20 to-transparent">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Org Share (85%)</span>
                        <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-brand-400 tracking-tight">
                        {formatCurrency ? formatCurrency(totalOrgShare) : `Rs. ${totalOrgShare.toLocaleString()}`}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 font-medium">Earned by organizers across all events</p>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/20 to-transparent">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Releases</span>
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-amber-400 tracking-tight">
                        {formatCurrency ? formatCurrency(pendingOrgShare) : `Rs. ${pendingOrgShare.toLocaleString()}`}
                    </div>
                    <p className="text-[11px] text-amber-400/80 mt-1 font-medium">{pendingCount} event(s) awaiting admin release</p>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/20 to-transparent">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Settled Events</span>
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-white tracking-tight">
                        {earningsList.length}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 font-medium">Tournaments & paid scrims calculated</p>
                </div>
            </div>

            {/* Main Earnings Table */}
            <div className="bg-card p-6 rounded-2xl border border-slate-800 space-y-6">
                <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <DollarSign className="text-brand-500" /> Organization Earnings & Commission Ledger
                        </h2>
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                        Revenue Split: <span className="text-brand-400 font-bold">85% Org</span> / <span className="text-emerald-400 font-bold">15% Platform</span>
                    </div>
                </div>

                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 text-gray-400 text-xs uppercase tracking-wider">
                                <th className="p-4 font-medium">Date</th>
                                <th className="p-4 font-medium">Event</th>
                                <th className="p-4 font-medium">Organizer</th>
                                <th className="p-4 font-medium">Prize Pool</th>
                                <th className="p-4 font-medium">Platform Cut (15%)</th>
                                <th className="p-4 font-medium">Org Share (85%)</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {earningsList.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                                        No earnings records found. Paid scrims and tournaments will automatically appear here once prizes are distributed.
                                    </td>
                                </tr>
                            ) : (
                                earningsList.map(earning => {
                                    const isScrim = Boolean((earning as any).isScrim || (earning as any).type === 'scrim' || earning.tournamentName?.toLowerCase().includes('scrim'));
                                    return (
                                        <tr key={earning.id} className="hover:bg-surface/20 transition-colors">
                                            <td className="p-4 text-gray-300 text-xs font-mono">
                                                {formatDate ? formatDate(earning.createdAt) : (earning.createdAt?.toDate ? earning.createdAt.toDate().toLocaleDateString() : 'N/A')}
                                            </td>
                                            <td className="p-4">
                                                <div className="text-white font-bold text-sm leading-tight">{earning.tournamentName}</div>
                                                <div className="mt-1 flex items-center gap-1.5">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                        isScrim ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                    }`}>
                                                        {isScrim ? 'Scrim' : 'Tournament'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-300 text-sm font-medium">
                                                {earning.orgName}
                                            </td>
                                            <td className="p-4 text-gray-300 text-sm font-medium">
                                                {formatCurrency ? formatCurrency(earning.prizePoolTotal || 0) : `Rs. ${(earning.prizePoolTotal || 0).toLocaleString()}`}
                                            </td>
                                            <td className="p-4 text-emerald-400 font-bold text-sm font-mono">
                                                {formatCurrency ? formatCurrency(earning.nexplayShare || 0) : `Rs. ${(earning.nexplayShare || 0).toLocaleString()}`}
                                            </td>
                                            <td className="p-4 text-brand-400 font-black text-sm font-mono">
                                                {formatCurrency ? formatCurrency(earning.orgShare || 0) : `Rs. ${(earning.orgShare || 0).toLocaleString()}`}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                    earning.status === 'released' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                                    'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                                }`}>
                                                    {earning.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                {earning.status === 'pending' ? (
                                                    <button type="button"
                                                        onClick={async () => {
                                                            setReleasingId(earning.id);
                                                            try {
                                                                await handleReleaseEarnings(earning);
                                                            } finally {
                                                                setReleasingId(null);
                                                            }
                                                        }}
                                                        disabled={releasingId === earning.id}
                                                        className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-600/20 cursor-pointer"
                                                    >
                                                        {releasingId === earning.id ? "Releasing..." : "Release to Org"}
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-gray-500 font-bold uppercase">Credited</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
