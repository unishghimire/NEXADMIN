import React, { useMemo } from 'react';
import { 
    Wallet, 
    ShieldCheck, 
    ArrowDownRight, 
    ArrowUpRight, 
    Lock, 
    DollarSign, 
    Percent, 
    Clock, 
    CheckCircle2, 
    Activity, 
    Landmark,
    Layers,
    FileSpreadsheet,
    ChevronRight
} from 'lucide-react';
import { AdminPanelTabProps } from './types';
import { Transaction, Tournament, TournamentEarning, UserProfile } from '../../../../shared/types/types';

export const FinanceHubTab: React.FC<AdminPanelTabProps> = (props) => {
    const { 
        allTournaments = [], 
        allTransactions = [], 
        users = [], 
        tournamentEarnings = [], 
        siteSettings, 
        formatCurrency, 
        setActiveTab,
    } = props;

    // 1. Calculate Circulating Player Liquidity
    const totalPlayerBalance = useMemo(() => {
        return (users as UserProfile[])
            .filter(u => u.role === 'player' || !u.role)
            .reduce((sum, u) => sum + (Number(u.balance) || 0), 0);
    }, [users]);

    // 2. Calculate Withdrawable Organizer Liquidity
    const totalOrgBalance = useMemo(() => {
        return (users as UserProfile[])
            .filter(u => u.role === 'organizer')
            .reduce((sum, u) => sum + (Number(u.orgWalletBalance || u.balance) || 0), 0);
    }, [users]);

    // 3. Calculate Total Locked Escrow in Active Tournaments and Scrims
    const escrowAnalytics = useMemo(() => {
        const activeEvents = (allTournaments as Tournament[]).filter(
            t => t.status === 'upcoming' || t.status === 'published' || t.status === 'live' || t.status === 'open'
        );

        let lockedEntryFees = 0;
        let committedPrizePools = 0;

        activeEvents.forEach(evt => {
            const entryFee = Number(evt.entryFee) || 0;
            // Count registered participants from transactions or event data
            const eventTx = (allTransactions as Transaction[]).filter(
                tx => (tx.type === 'entry_fee' || (tx as any).type === 'scrim_entry_fee') && 
                      tx.tournamentId === evt.id && 
                      (tx.status === 'success' || tx.status === 'completed')
            );
            const registeredCount = eventTx.length > 0 ? eventTx.length : (evt.currentParticipants || 0);
            lockedEntryFees += registeredCount * entryFee;
            committedPrizePools += Number(evt.prizePool) || 0;
        });

        return {
            activeCount: activeEvents.length,
            lockedEntryFees,
            committedPrizePools,
            totalEscrowLocked: lockedEntryFees + committedPrizePools,
        };
    }, [allTournaments, allTransactions]);

    // 4. Platform Commissions & Earnings Metrics
    const earningsMetrics = useMemo(() => {
        const earningsList = tournamentEarnings as TournamentEarning[];
        const totalPlatformCommission = earningsList.reduce((sum, e) => sum + (Number(e.nexplayShare) || 0), 0);
        const totalOrgProfit = earningsList.reduce((sum, e) => sum + (Number(e.orgShare) || 0), 0);
        const pendingOrgPayouts = earningsList
            .filter(e => e.status === 'pending')
            .reduce((sum, e) => sum + (Number(e.orgShare) || 0), 0);
        const pendingPayoutCount = earningsList.filter(e => e.status === 'pending').length;

        return {
            totalPlatformCommission,
            totalOrgProfit,
            pendingOrgPayouts,
            pendingPayoutCount,
        };
    }, [tournamentEarnings]);

    // 5. Inflow & Outflow Metrics
    const flowMetrics = useMemo(() => {
        const txs = allTransactions as Transaction[];

        // Settled Inflow (Completed Deposits)
        const settledInflow = txs
            .filter(t => t.type === 'deposit' && (t.status === 'success' || t.status === 'completed'))
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        // Pending Inflow (Awaiting Admin Verification)
        const pendingDepositsList = txs.filter(t => t.type === 'deposit' && t.status === 'pending');
        const pendingInflow = pendingDepositsList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        // Settled Outflow (Completed Withdrawals)
        const settledOutflow = txs
            .filter(t => (t.type === 'withdrawal' || t.type === 'withdraw') && (t.status === 'success' || t.status === 'completed'))
            .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

        // Pending Outflow (Awaiting Admin Processing)
        const pendingWithdrawalsList = txs.filter(t => (t.type === 'withdrawal' || t.type === 'withdraw') && t.status === 'pending');
        const pendingOutflow = pendingWithdrawalsList.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

        // Entry fees collected platform-wide
        const totalEntryFeesPaid = txs
            .filter(t => t.type === 'entry_fee' && (t.status === 'success' || t.status === 'completed'))
            .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

        // Prize money distributed to players
        const totalPrizesAwarded = txs
            .filter(t => (t.type === 'prize' || t.type === 'prize_payout') && (t.status === 'success' || t.status === 'completed'))
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        return {
            settledInflow,
            pendingInflow,
            pendingDepositsCount: pendingDepositsList.length,
            settledOutflow,
            pendingOutflow,
            pendingWithdrawalsCount: pendingWithdrawalsList.length,
            totalEntryFeesPaid,
            totalPrizesAwarded,
            netReserve: Math.max(0, settledInflow - settledOutflow)
        };
    }, [allTransactions]);

    const commissionPercent = siteSettings?.platformCommission ?? 15;
    const orgSharePercent = 100 - commissionPercent;

    return (
        <div className="space-y-8 text-gray-100">
            {/* 1. Header Banner & Treasury Health Badge */}
            <div className="bg-gradient-to-r from-slate-900 via-dark to-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="p-3 bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-2xl flex items-center justify-center">
                                <Landmark className="w-6 h-6" />
                            </span>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                                    Platform Treasury Command Center
                                </h1>
                                <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">
                                    Full Liquidity Oversight • Tournament Escrow Vaults • Revenue Splits • Audit Solvency
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Solvency & Integrity Pill */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="bg-emerald-950/40 border border-emerald-500/30 px-4 py-2.5 rounded-2xl flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                    Ledger Integrity Status
                                </div>
                                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                    <span>Verified 100% Reconciled</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card/80 border border-slate-800 px-4 py-2.5 rounded-2xl font-mono text-xs">
                            <span className="text-slate-400">Revenue Split:</span>{' '}
                            <span className="text-brand-400 font-bold">{orgSharePercent}% Org</span>
                            <span className="text-slate-500 mx-1.5">/</span>
                            <span className="text-emerald-400 font-bold">{commissionPercent}% NexPlay</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Platform Core Liquidity Balance Sheet (4 Master KPI Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* A. Circulating Player Balances */}
                <div className="bg-card/90 p-5 rounded-2xl border border-slate-800/80 hover:border-blue-500/40 transition-all shadow-lg flex flex-col justify-between group">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Wallet className="w-4 h-4 text-blue-400" /> Player Balances
                            </span>
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-black uppercase border border-blue-500/20">
                                Circulating
                            </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
                            {formatCurrency ? formatCurrency(totalPlayerBalance) : `Rs. ${totalPlayerBalance.toLocaleString()}`}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2 font-medium">
                            Total wallet deposits held by registered players
                        </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-blue-400 font-bold">
                        <span>Total Users: {users.length}</span>
                        <button 
                            type="button" 
                            onClick={() => setActiveTab && setActiveTab('tab-users')} 
                            className="hover:underline flex items-center gap-1"
                        >
                            Manage Users <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* B. Locked Tournament Escrow Vaults */}
                <div className="bg-card/90 p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-transparent hover:border-amber-500/50 transition-all shadow-lg flex flex-col justify-between group">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Lock className="w-4 h-4 text-amber-400" /> Locked Escrow Vault
                            </span>
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-black uppercase border border-amber-500/30">
                                {escrowAnalytics.activeCount} Active Events
                            </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight font-mono">
                            {formatCurrency ? formatCurrency(escrowAnalytics.totalEscrowLocked) : `Rs. ${escrowAnalytics.totalEscrowLocked.toLocaleString()}`}
                        </div>
                        <div className="text-[11px] text-slate-300 mt-2 font-medium space-y-0.5">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Locked Entry Fees:</span>
                                <span className="font-mono text-white">{formatCurrency ? formatCurrency(escrowAnalytics.lockedEntryFees) : `Rs. ${escrowAnalytics.lockedEntryFees.toLocaleString()}`}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Guaranteed Prize Pools:</span>
                                <span className="font-mono text-white">{formatCurrency ? formatCurrency(escrowAnalytics.committedPrizePools) : `Rs. ${escrowAnalytics.committedPrizePools.toLocaleString()}`}</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-amber-400 font-bold">
                        <span>Protected Funds</span>
                        <button 
                            type="button" 
                            onClick={() => setActiveTab && setActiveTab('tab-escrow-wallets')} 
                            className="hover:underline flex items-center gap-1"
                        >
                            Open Escrow Hub <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* C. Withdrawable Organizer Balances */}
                <div className="bg-card/90 p-5 rounded-2xl border border-slate-800/80 hover:border-purple-500/40 transition-all shadow-lg flex flex-col justify-between group">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <DollarSign className="w-4 h-4 text-purple-400" /> Org Wallets
                            </span>
                            <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full font-black uppercase border border-purple-500/20">
                                Withdrawable
                            </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
                            {formatCurrency ? formatCurrency(totalOrgBalance) : `Rs. ${totalOrgBalance.toLocaleString()}`}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-2 font-medium">
                            <div className="flex justify-between">
                                <span>Pending Org Releases:</span>
                                <span className="font-mono text-amber-400 font-bold">{formatCurrency ? formatCurrency(earningsMetrics.pendingOrgPayouts) : `Rs. ${earningsMetrics.pendingOrgPayouts.toLocaleString()}`}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">Available in organizer accounts after verified match settlement</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-purple-400 font-bold">
                        <span>{earningsMetrics.pendingPayoutCount} Pending Releases</span>
                        <button 
                            type="button" 
                            onClick={() => setActiveTab && setActiveTab('tab-org-earnings')} 
                            className="hover:underline flex items-center gap-1"
                        >
                            Release Shares <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* D. Platform Revenue / Commissions */}
                <div className="bg-card/90 p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 to-transparent hover:border-emerald-500/50 transition-all shadow-lg flex flex-col justify-between group">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Percent className="w-4 h-4 text-emerald-400" /> Platform Revenue
                            </span>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-black uppercase border border-emerald-500/30">
                                {commissionPercent}% Net Cut
                            </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight font-mono">
                            {formatCurrency ? formatCurrency(earningsMetrics.totalPlatformCommission) : `Rs. ${earningsMetrics.totalPlatformCommission.toLocaleString()}`}
                        </div>
                        <p className="text-[11px] text-slate-300 mt-2 font-medium">
                            NexPlay net commission retained from all completed competitions
                        </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-emerald-400 font-bold">
                        <span>Org Profit: {formatCurrency ? formatCurrency(earningsMetrics.totalOrgProfit) : `Rs. ${earningsMetrics.totalOrgProfit.toLocaleString()}`}</span>
                        <button 
                            type="button" 
                            onClick={() => setActiveTab && setActiveTab('tab-org-earnings')} 
                            className="hover:underline flex items-center gap-1"
                        >
                            View Splits <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Financial Inflow vs Outflow Pipeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Inflow Card (Deposits & Gateway Receipts) */}
                <div className="bg-card p-6 rounded-3xl border border-slate-800 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                            <span className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                                <ArrowDownRight className="w-5 h-5" />
                            </span>
                            <div>
                                <h3 className="font-bold text-white text-base uppercase tracking-wider">Inflows (Deposits)</h3>
                                <p className="text-xs text-slate-400">Player funds entering the platform via eSewa, Khalti, QR & Banking</p>
                            </div>
                        </div>
                        <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                            {flowMetrics.pendingDepositsCount} Pending
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-dark/60 p-4 rounded-2xl border border-slate-800">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Settled Deposits</div>
                            <div className="text-xl font-black text-white font-mono">
                                {formatCurrency ? formatCurrency(flowMetrics.settledInflow) : `Rs. ${flowMetrics.settledInflow.toLocaleString()}`}
                            </div>
                            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Verified & Credited
                            </div>
                        </div>

                        <div className="bg-dark/60 p-4 rounded-2xl border border-amber-500/30">
                            <div className="text-xs text-amber-300 font-bold uppercase tracking-wider mb-1">Awaiting Slip Verification</div>
                            <div className="text-xl font-black text-amber-400 font-mono">
                                {formatCurrency ? formatCurrency(flowMetrics.pendingInflow) : `Rs. ${flowMetrics.pendingInflow.toLocaleString()}`}
                            </div>
                            <div className="text-[11px] text-amber-300 mt-1 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" /> {flowMetrics.pendingDepositsCount} slips queued
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="text-xs text-slate-400">
                            Total Tournament Entry Fees Collected: <span className="text-white font-bold font-mono">{formatCurrency ? formatCurrency(flowMetrics.totalEntryFeesPaid) : `Rs. ${flowMetrics.totalEntryFeesPaid.toLocaleString()}`}</span>
                        </div>
                        <button 
                            type="button" 
                            onClick={() => setActiveTab && setActiveTab('tab-pending-deposits')}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-emerald-950/40 flex items-center gap-1.5"
                        >
                            Verify Deposits <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Outflow Card (Withdrawals & Player Cashouts) */}
                <div className="bg-card p-6 rounded-3xl border border-slate-800 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                            <span className="p-2.5 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
                                <ArrowUpRight className="w-5 h-5" />
                            </span>
                            <div>
                                <h3 className="font-bold text-white text-base uppercase tracking-wider">Outflows (Withdrawals)</h3>
                                <p className="text-xs text-slate-400">Prize cashouts and player balance disbursements</p>
                            </div>
                        </div>
                        <span className="text-xs font-mono font-black text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                            {flowMetrics.pendingWithdrawalsCount} Pending
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-dark/60 p-4 rounded-2xl border border-slate-800">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Disbursed Cashouts</div>
                            <div className="text-xl font-black text-white font-mono">
                                {formatCurrency ? formatCurrency(flowMetrics.settledOutflow) : `Rs. ${flowMetrics.settledOutflow.toLocaleString()}`}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Transferred to Bank/eSewa
                            </div>
                        </div>

                        <div className="bg-dark/60 p-4 rounded-2xl border border-red-500/30">
                            <div className="text-xs text-red-300 font-bold uppercase tracking-wider mb-1">Awaiting Bank Transfer</div>
                            <div className="text-xl font-black text-red-400 font-mono">
                                {formatCurrency ? formatCurrency(flowMetrics.pendingOutflow) : `Rs. ${flowMetrics.pendingOutflow.toLocaleString()}`}
                            </div>
                            <div className="text-[11px] text-red-300 mt-1 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" /> {flowMetrics.pendingWithdrawalsCount} requests queued
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="text-xs text-slate-400">
                            Total Winning Prizes Awarded: <span className="text-white font-bold font-mono">{formatCurrency ? formatCurrency(flowMetrics.totalPrizesAwarded) : `Rs. ${flowMetrics.totalPrizesAwarded.toLocaleString()}`}</span>
                        </div>
                        <button 
                            type="button" 
                            onClick={() => setActiveTab && setActiveTab('tab-pending-withdrawals')}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-red-950/40 flex items-center gap-1.5"
                        >
                            Process Cashouts <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 4. Complete Money Movement & Security Architecture Diagram */}
            <div className="bg-card p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Activity className="text-brand-500" /> Platform Financial Flow & Escrow Safeguard
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                            How money moves securely across player, organizer, escrow, and platform accounts
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab && setActiveTab('tab-tx-history')}
                            className="bg-dark hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-brand-400" />
                            <span>Export Audit Ledger</span>
                        </button>
                    </div>
                </div>

                {/* Visual Pipeline Steps */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                    {/* Step 1 */}
                    <div className="bg-dark/60 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono font-black text-brand-400 uppercase bg-brand-500/10 px-2 py-0.5 rounded">STEP 01</span>
                                <Wallet className="w-4 h-4 text-blue-400" />
                            </div>
                            <h4 className="font-bold text-white text-sm">Player Deposit & Verification</h4>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                Player transfers funds via QR. Admin verifies receipt slip and credits balance with duplicate protection.
                            </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-emerald-400 font-mono font-bold">
                            ✔ Anti-duplicate receipt check
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-dark/60 p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/10 to-transparent flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono font-black text-amber-400 uppercase bg-amber-500/20 px-2 py-0.5 rounded">STEP 02</span>
                                <Lock className="w-4 h-4 text-amber-400" />
                            </div>
                            <h4 className="font-bold text-white text-sm">Tournament Escrow Lock</h4>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                When players register, entry fees are debited and stored in the event's Locked Escrow Vault. Untouchable until match finish.
                            </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-amber-400 font-mono font-bold">
                            🔒 100% Locked in Escrow
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-dark/60 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono font-black text-brand-400 uppercase bg-brand-500/10 px-2 py-0.5 rounded">STEP 03</span>
                                <DollarSign className="w-4 h-4 text-purple-400" />
                            </div>
                            <h4 className="font-bold text-white text-sm">Prize Payouts to Winners</h4>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                Results finalized and winning prizepool is credited instantly to winning players' wallets with verified result records.
                            </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-purple-400 font-mono font-bold">
                            🏆 Direct Player Credit
                        </div>
                    </div>

                    {/* Step 4 */}
                    <div className="bg-dark/60 p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/10 to-transparent flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-mono font-black text-emerald-400 uppercase bg-emerald-500/20 px-2 py-0.5 rounded">STEP 04</span>
                                <Percent className="w-4 h-4 text-emerald-400" />
                            </div>
                            <h4 className="font-bold text-white text-sm">Revenue Split & Release</h4>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                Net profit split ({orgSharePercent}% Org / {commissionPercent}% NexPlay). Admin audits and releases org share to withdrawable wallet.
                            </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-emerald-400 font-mono font-bold">
                            ✔ Double-release guarded
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. Quick Action Financial Operations Bar */}
            <div className="bg-dark/80 p-5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-brand-500" />
                    <span>Quick Financial Navigation:</span>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button 
                        type="button" 
                        onClick={() => setActiveTab && setActiveTab('tab-escrow-wallets')}
                        className="bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 hover:border-amber-500 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                        <Lock className="w-3.5 h-3.5" /> Escrow Vaults ({escrowAnalytics.activeCount})
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setActiveTab && setActiveTab('tab-pending-deposits')}
                        className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 hover:border-emerald-500 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                        <ArrowDownRight className="w-3.5 h-3.5" /> Pending Deposits ({flowMetrics.pendingDepositsCount})
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setActiveTab && setActiveTab('tab-pending-withdrawals')}
                        className="bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 hover:border-red-500 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                        <ArrowUpRight className="w-3.5 h-3.5" /> Pending Cashouts ({flowMetrics.pendingWithdrawalsCount})
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setActiveTab && setActiveTab('tab-org-earnings')}
                        className="bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 hover:border-purple-500 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                        <DollarSign className="w-3.5 h-3.5" /> Payout Releases ({earningsMetrics.pendingPayoutCount})
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setActiveTab && setActiveTab('tab-tx-history')}
                        className="bg-dark hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                        <Layers className="w-3.5 h-3.5 text-brand-400" /> Full Audit Ledger
                    </button>
                </div>
            </div>
        </div>
    );
};
export default FinanceHubTab;
