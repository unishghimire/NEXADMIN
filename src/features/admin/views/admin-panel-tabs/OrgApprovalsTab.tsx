import { sanitizeUrl } from '../../../../shared/utils/utils';
import React, { useState, useMemo } from 'react';
import { 
    Check, 
    ExternalLink, 
    CheckCircle, 
    Zap, 
    ShieldCheck, 
    Clock, 
    XCircle, 
    Copy, 
    CheckCheck, 
    Users, 
    Trophy, 
    AlertTriangle, 
    Search,
    Filter,
    Gamepad2,
    Lock
} from 'lucide-react';

import { AdminPanelTabProps } from './types';
import { PowerOrgApplication } from '../../../../shared/types/types';

export const OrgApprovalsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { 
        handleApproveOrg, 
        handleRejectOrg, 
        orgApplications = [],
        powerOrgApplications = [],
        handleApprovePowerOrg,
        handleRejectPowerOrg,
        formatDate,
        getRelativeTime,
        allTournaments = []
    } = props;

    // Sub-view: Standard Host Applications vs Power Organizer Qualifications
    const [subTab, setSubTab] = useState<'standard' | 'power'>('power');

    // Power Org search & filter
    const [powerFilter, setPowerFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    // Standard org search
    const [stdSearchQuery, setStdSearchQuery] = useState('');

    const copyToClipboard = (text: string, id: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(id);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Calculate pending badges
    const pendingStdCount = (orgApplications || []).length;
    const pendingPowerCount = (powerOrgApplications || []).filter((a: PowerOrgApplication) => a.status === 'pending').length;

    // Filter Power Org Applications
    const filteredPowerApps = useMemo(() => {
        return (powerOrgApplications || []).filter((app: PowerOrgApplication) => {
            const matchesFilter = powerFilter === 'all' ? true : app.status === powerFilter;
            const query = searchQuery.toLowerCase().trim();
            const matchesSearch = !query || 
                (app.orgName || '').toLowerCase().includes(query) ||
                (app.username || '').toLowerCase().includes(query) ||
                (app.email || '').toLowerCase().includes(query) ||
                (app.phone || '').toLowerCase().includes(query) ||
                (app.whatsapp || '').toLowerCase().includes(query);
            return matchesFilter && matchesSearch;
        });
    }, [powerOrgApplications, powerFilter, searchQuery]);

    // Filter Standard Org Applications
    const filteredStdApps = useMemo(() => {
        return (orgApplications || []).filter((app: any) => {
            const query = stdSearchQuery.toLowerCase().trim();
            return !query || 
                (app.orgName || '').toLowerCase().includes(query) ||
                (app.username || '').toLowerCase().includes(query) ||
                (app.email || '').toLowerCase().includes(query) ||
                (app.whatsapp || '').toLowerCase().includes(query);
        });
    }, [orgApplications, stdSearchQuery]);

    const handleOneClickApprovePower = async (app: PowerOrgApplication) => {
        if (!handleApprovePowerOrg) return;
        setActionLoadingId(app.id);
        try {
            await handleApprovePowerOrg(app);
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleOneClickRejectPower = async (app: PowerOrgApplication) => {
        if (!handleRejectPowerOrg) return;
        setActionLoadingId(app.id);
        try {
            await handleRejectPowerOrg(app);
        } finally {
            setActionLoadingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Navigation & Workflow Mode Switcher */}
            <div className="bg-card p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2.5">
                            <ShieldCheck className="w-6 h-6 text-brand-500" />
                            Organizer Host Review &amp; Tier Qualifications
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Review and authorize community tournament hosts and verify Power Organizer qualifications with authentic scrim milestones.
                        </p>
                    </div>

                    {/* Segmented Tab Switcher */}
                    <div className="flex items-center gap-2 bg-dark/80 p-1 rounded-xl border border-slate-800">
                        <button
                            type="button"
                            onClick={() => setSubTab('power')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                subTab === 'power'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Zap className={`w-4 h-4 ${subTab === 'power' ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
                            Power Org Qualifications
                            {pendingPowerCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-black animate-pulse">
                                    {pendingPowerCount}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setSubTab('standard')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                subTab === 'standard'
                                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40 shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Users className="w-4 h-4" />
                            Standard Host Onboarding
                            {pendingStdCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-brand-500 text-white">
                                    {pendingStdCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Sub-tab 1: Power Organizer Qualification Workflow */}
                {subTab === 'power' && (
                    <div className="space-y-4">
                        {/* Requirement Notice Box */}
                        <div className="bg-gradient-to-r from-amber-500/10 via-brand-500/5 to-dark p-4 rounded-xl border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-1">
                                <div className="font-black text-amber-300 uppercase tracking-wide flex items-center gap-2">
                                    <Trophy className="w-4 h-4 text-amber-400" />
                                    Power Organizer Requirement Standard
                                </div>
                                <p className="text-slate-300 leading-relaxed max-w-3xl">
                                    Power Organizers are verified hosts authorized to run official multi-round tournaments. Standard Organizers run Free, Paid, and Per-Kill Scrims. Qualification requires <strong className="text-white font-bold">20 authentic scrims</strong> with verified match completion / results (<span className="text-emerald-400 font-mono text-[11px]">payoutCompleted</span>, podium winners resolved, or filled slots played).
                                </p>
                            </div>
                            <div className="shrink-0">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs">
                                    <Zap className="w-3.5 h-3.5 fill-amber-400" /> 1-Click Verification
                                </span>
                            </div>
                        </div>

                        {/* Filter Bar & Search */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                            {/* Status Filter Pills */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {(['all', 'pending', 'approved', 'rejected'] as const).map((filterKey) => {
                                    const count = (powerOrgApplications || []).filter((a: PowerOrgApplication) =>
                                        filterKey === 'all' ? true : a.status === filterKey
                                    ).length;
                                    return (
                                        <button
                                            key={filterKey}
                                            type="button"
                                            onClick={() => setPowerFilter(filterKey)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer ${
                                                powerFilter === filterKey
                                                    ? 'bg-slate-700 text-white border border-slate-600'
                                                    : 'bg-dark/60 text-slate-400 hover:text-white border border-slate-800'
                                            }`}
                                        >
                                            {filterKey === 'pending' && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                                            {filterKey === 'approved' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                                            {filterKey === 'rejected' && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                                            <span>{filterKey}</span>
                                            <span className="text-[10px] opacity-70 font-mono font-bold">({count})</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Search Input */}
                            <div className="relative min-w-[240px]">
                                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search by Org, Host or Email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-dark/80 border border-slate-800 focus:border-amber-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus-visible:outline-none"
                                />
                            </div>
                        </div>

                        {/* Power Org Applications Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
                            {filteredPowerApps.length > 0 ? (
                                filteredPowerApps.map((app: PowerOrgApplication) => {
                                    const isPending = app.status === 'pending';
                                    const isApproved = app.status === 'approved';
                                    const isRejected = app.status === 'rejected';
                                    const isEligible = (app.completedScrimsCount || 0) >= 20;
                                    const progressPercent = Math.min(100, Math.round(((app.completedScrimsCount || 0) / 20) * 100));

                                    return (
                                        <div
                                            key={app.id}
                                            className={`bg-dark/80 p-5 rounded-2xl border transition-all space-y-4 relative ${
                                                isPending
                                                    ? 'border-amber-500/30 hover:border-amber-500/60 shadow-lg shadow-amber-950/10'
                                                    : isApproved
                                                    ? 'border-emerald-500/30'
                                                    : 'border-slate-800 opacity-80'
                                            }`}
                                        >
                                            {/* Header */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-brand-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-sm">
                                                        <Zap className="w-5 h-5 fill-amber-400" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-base font-black text-white flex items-center gap-2">
                                                            {app.orgName || app.username}
                                                        </h3>
                                                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                                                            <span>Host: <strong className="text-slate-200">@{app.username}</strong></span>
                                                            <span className="text-slate-600">•</span>
                                                            <span className="text-[11px] text-slate-500">
                                                                Applied {getRelativeTime ? getRelativeTime(app.appliedAt) : 'recently'}
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Status Badge */}
                                                <div>
                                                    {isPending && (
                                                        <span className="bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                                                            <Clock className="w-3 h-3 text-amber-400 animate-spin" /> Pending Review
                                                        </span>
                                                    )}
                                                    {isApproved && (
                                                        <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                                                            <CheckCircle className="w-3 h-3" /> Power Host Active
                                                        </span>
                                                    )}
                                                    {isRejected && (
                                                        <span className="bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                                                            <XCircle className="w-3 h-3" /> Application Rejected
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Authentic Scrims Milestone Box */}
                                            <div className="bg-black/50 p-4 rounded-xl border border-white/5 space-y-2.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                                                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                                        Verified Authentic Scrims Milestone
                                                    </span>
                                                    <span className={`font-mono font-black ${isEligible ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                        {app.completedScrimsCount || 0} / 20 Scrims ({progressPercent}%)
                                                    </span>
                                                </div>

                                                {/* Progress Bar */}
                                                <div className="w-full h-2 bg-dark rounded-full overflow-hidden border border-white/5">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                            isEligible
                                                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                                                : 'bg-gradient-to-r from-brand-500 to-amber-500'
                                                        }`}
                                                        style={{ width: `${progressPercent}%` }}
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between text-[11px] pt-1">
                                                    <span className="text-slate-400 flex items-center gap-1">
                                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                                        Completion &amp; Results Verified
                                                    </span>
                                                    <span className={`font-bold ${isEligible ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                        {isEligible ? '✓ Requirement Met' : 'Under 20 Scrims'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Details Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                <div className="bg-dark/40 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                                                    <div className="truncate mr-2">
                                                        <div className="text-[10px] text-slate-500 uppercase font-black">WhatsApp / Phone</div>
                                                        <div className="text-slate-200 font-mono truncate">{app.whatsapp || app.phone || 'N/A'}</div>
                                                    </div>
                                                    {(app.whatsapp || app.phone) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => copyToClipboard(app.whatsapp || app.phone || '', `phone-${app.id}`)}
                                                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                                                            title="Copy contact"
                                                        >
                                                            {copiedField === `phone-${app.id}` ? (
                                                                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                                                            ) : (
                                                                <Copy className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="bg-dark/40 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                                                    <div className="truncate mr-2">
                                                        <div className="text-[10px] text-slate-500 uppercase font-black">Host Email</div>
                                                        <div className="text-slate-200 truncate">{app.email}</div>
                                                    </div>
                                                    {app.email && (
                                                        <button
                                                            type="button"
                                                            onClick={() => copyToClipboard(app.email, `email-${app.id}`)}
                                                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                                                            title="Copy email"
                                                        >
                                                            {copiedField === `email-${app.id}` ? (
                                                                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                                                            ) : (
                                                                <Copy className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Community link if present */}
                                            {app.communityLink && (
                                                <div className="bg-dark/40 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                                                    <div className="truncate mr-2">
                                                        <div className="text-[10px] text-slate-500 uppercase font-black">Community / Esports Hub</div>
                                                        <a
                                                            href={sanitizeUrl(app.communityLink)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-brand-400 hover:text-brand-300 font-medium truncate flex items-center gap-1.5"
                                                        >
                                                            <ExternalLink className="w-3 h-3" /> {app.communityLink}
                                                        </a>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Host Notes if present */}
                                            {app.notes && (
                                                <div className="bg-dark/40 p-2.5 rounded-xl border border-slate-800 text-xs space-y-1">
                                                    <div className="text-[10px] text-slate-500 uppercase font-black">Organizer Pitch &amp; Tournament Plans</div>
                                                    <p className="text-slate-300 text-[11px] leading-relaxed italic bg-black/30 p-2 rounded-lg">
                                                        "{app.notes}"
                                                    </p>
                                                </div>
                                            )}

                                            {/* 1-Click Action Buttons */}
                                            <div className="pt-2 border-t border-slate-800 flex items-center gap-3">
                                                {isPending ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={actionLoadingId === app.id}
                                                            onClick={() => handleOneClickRejectPower(app)}
                                                            className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-500/30 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                                        >
                                                            <XCircle className="w-4 h-4" /> Reject
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={actionLoadingId === app.id}
                                                            onClick={() => handleOneClickApprovePower(app)}
                                                            className="flex-[2] bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                        >
                                                            {actionLoadingId === app.id ? (
                                                                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <Zap className="w-4 h-4 fill-black" /> Approve Power Status (1-Click)
                                                                </>
                                                            )}
                                                        </button>
                                                    </>
                                                ) : isApproved ? (
                                                    <div className="w-full flex items-center justify-between text-xs">
                                                        <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                                                            <CheckCircle className="w-3.5 h-3.5" /> Approved Power Organizer
                                                        </span>
                                                        <button
                                                            type="button"
                                                            disabled={actionLoadingId === app.id}
                                                            onClick={() => handleOneClickRejectPower(app)}
                                                            className="text-xs text-red-400 hover:text-red-300 font-bold hover:underline cursor-pointer"
                                                        >
                                                            Revoke Power Status
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="w-full flex items-center justify-between text-xs">
                                                        <span className="text-red-400 font-bold flex items-center gap-1 text-[11px]">
                                                            <XCircle className="w-3.5 h-3.5" /> Application Rejected
                                                        </span>
                                                        <button
                                                            type="button"
                                                            disabled={actionLoadingId === app.id}
                                                            onClick={() => handleOneClickApprovePower(app)}
                                                            className="text-xs text-emerald-400 hover:text-emerald-300 font-bold hover:underline cursor-pointer flex items-center gap-1"
                                                        >
                                                            <Zap className="w-3 h-3 fill-emerald-400" /> Re-Approve Power Status
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-500 space-y-3 bg-dark/40 rounded-2xl border border-slate-800/80">
                                    <Trophy className="w-12 h-12 opacity-20 text-amber-400" />
                                    <div className="text-center">
                                        <p className="text-sm font-bold uppercase tracking-widest text-slate-400">
                                            No {powerFilter !== 'all' ? powerFilter : ''} Power Organizer Applications
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Organizers with 20 authentic completed scrims will appear here for 1-click authorization.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Sub-tab 2: Standard Organizer Onboarding Applications */}
                {subTab === 'standard' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="text-xs text-slate-400">
                                Prospective community organizers applying for initial host verification. Approved hosts can run Free Scrims, Paid Scrims, and Per-Kill Scrims.
                            </div>
                            <div className="relative min-w-[240px]">
                                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search host applications..."
                                    value={stdSearchQuery}
                                    onChange={(e) => setStdSearchQuery(e.target.value)}
                                    className="w-full bg-dark/80 border border-slate-800 focus:border-brand-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus-visible:outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            {filteredStdApps.length > 0 ? (
                                filteredStdApps.map((app: any) => (
                                    <div key={app.id} className="bg-dark p-6 rounded-2xl border border-slate-800 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="text-lg font-bold text-white">{app.orgName}</h3>
                                                <p className="text-xs text-slate-400">Applied by: {app.username}</p>
                                            </div>
                                            <span className="bg-yellow-600/20 text-yellow-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-yellow-500/30">
                                                Pending Onboarding
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                            <div className="bg-dark/40 p-3 rounded-xl border border-slate-800">
                                                <div className="text-slate-400 uppercase font-bold text-[10px] mb-1">WhatsApp</div>
                                                <div className="text-white">{app.whatsapp}</div>
                                            </div>
                                            <div className="bg-dark/40 p-3 rounded-xl border border-slate-800">
                                                <div className="text-slate-400 uppercase font-bold text-[10px] mb-1">Email</div>
                                                <div className="text-white truncate">{app.email}</div>
                                            </div>
                                        </div>
                                        {app.proofLink && (
                                            <div className="bg-dark/40 p-3 rounded-xl border border-slate-800">
                                                <div className="text-slate-400 uppercase font-bold text-[10px] mb-1">Proof Link</div>
                                                <a href={sanitizeUrl(app.proofLink)} target="_blank" rel="noreferrer" className="text-brand-400 hover:text-brand-300 flex items-center gap-2 truncate">
                                                    <ExternalLink className="w-3 h-3" /> {app.proofLink}
                                                </a>
                                            </div>
                                        )}
                                        <div className="flex gap-3 pt-2">
                                            <button 
                                                type="button" 
                                                onClick={() => handleRejectOrg(app)} 
                                                className="flex-1 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors cursor-pointer"
                                            >
                                                Reject
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => handleApproveOrg(app)} 
                                                className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-xl text-xs font-bold uppercase transition-colors cursor-pointer"
                                            >
                                                Approve Host
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                                    <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
                                    <p className="text-sm font-bold uppercase tracking-widest">No pending host applications</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
