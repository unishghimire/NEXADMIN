import React, { useState, useMemo, useEffect } from 'react';
import { 
    Lock, 
    Unlock, 
    ShieldAlert, 
    CheckCircle2, 
    AlertTriangle, 
    Trophy, 
    Users, 
    Search, 
    Filter, 
    Clock, 
    RotateCcw, 
    DollarSign, 
    ChevronRight, 
    X,
    Flame,
    FileSpreadsheet,
    Receipt,
    RefreshCw
} from 'lucide-react';
import { collection, query, getDocs, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../shared/config/firebase';
import { AdminPanelTabProps } from './types';
import { Tournament, Transaction, TournamentEarning } from '../../../../shared/types/types';

interface EventEscrowItem {
    id: string;
    title: string;
    type: 'tournament' | 'scrim';
    game: string;
    hostUid: string;
    hostName: string;
    entryFee: number;
    prizePool: number;
    status: string;
    escrowFrozen?: boolean;
    freezeReason?: string;
    registeredCount: number;
    totalSlots: number;
    totalEntryFeesLocked: number;
    totalEscrow: number;
    earningRecord?: TournamentEarning;
}

export const EscrowWalletsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { 
        allTournaments = [], 
        allTransactions = [], 
        tournamentEarnings = [], 
        formatCurrency, 
        formatDate, 
        getRelativeTime,
        showToast,
        setActiveTab
    } = props;

    const [scrimsList, setScrimsList] = useState<any[]>([]);
    const [loadingScrims, setLoadingScrims] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'tournament' | 'scrim'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'settled' | 'frozen'>('all');
    
    // Modal states
    const [selectedEventForLedger, setSelectedEventForLedger] = useState<EventEscrowItem | null>(null);
    const [freezeModalEvent, setFreezeModalEvent] = useState<EventEscrowItem | null>(null);
    const [freezeReason, setFreezeReason] = useState('');
    const [refundModalEvent, setRefundModalEvent] = useState<EventEscrowItem | null>(null);
    const [isProcessingAction, setIsProcessingAction] = useState(false);

    // Fetch scrims for complete escrow visibility
    useEffect(() => {
        fetchScrims();
    }, []);

    const fetchScrims = async () => {
        setLoadingScrims(true);
        try {
            const snap = await getDocs(query(collection(db, 'scrims')));
            const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setScrimsList(loaded);
        } catch (error) {
            console.error('Failed to load scrims for escrow management:', error);
        } finally {
            setLoadingScrims(false);
        }
    };

    // Combine tournaments and scrims into unified Escrow model
    const escrowEvents: EventEscrowItem[] = useMemo(() => {
        const items: EventEscrowItem[] = [];

        // 1. Process Tournaments
        (allTournaments as Tournament[]).forEach(t => {
            const entryFee = Number(t.entryFee) || 0;
            const prizePool = Number(t.prizePool) || 0;
            
            // Match entry fee transactions for this tournament
            const txs = (allTransactions as Transaction[]).filter(
                tx => (tx.type === 'entry_fee' || (tx as any).type === 'tournament_entry') &&
                      tx.tournamentId === t.id &&
                      (tx.status === 'success' || tx.status === 'completed')
            );

            const registeredCount = txs.length > 0 ? txs.length : (t.currentParticipants || 0);
            const totalEntryFeesLocked = registeredCount * entryFee;
            const totalEscrow = totalEntryFeesLocked + prizePool;

            const earning = (tournamentEarnings as TournamentEarning[]).find(e => e.tournamentId === t.id);

            items.push({
                id: t.id,
                title: t.title || 'Untitled Tournament',
                type: 'tournament',
                game: t.game || 'Esports',
                hostUid: t.hostUid || (t as any).orgId || '',
                hostName: (t as any).orgName || t.hostName || 'NexPlay Esports',
                entryFee,
                prizePool,
                status: t.status || 'upcoming',
                escrowFrozen: (t as any).escrowFrozen || false,
                freezeReason: (t as any).freezeReason,
                registeredCount,
                totalSlots: (t as any).maxParticipants || (t as any).slotsCount || 0,
                totalEntryFeesLocked,
                totalEscrow,
                earningRecord: earning
            });
        });

        // 2. Process Scrims
        scrimsList.forEach(s => {
            const entryFee = Number(s.entryFee ?? s.requirements?.entryFee) || 0;
            const prizePool = Number(s.prizePool) || 0;

            const txs = (allTransactions as Transaction[]).filter(
                tx => (tx.type === 'entry_fee' || (tx as any).type === 'scrim_entry_fee') &&
                      tx.tournamentId === s.id &&
                      (tx.status === 'success' || tx.status === 'completed')
            );

            const filledSlots = s.slots ? s.slots.filter((slot: any) => slot.status === 'filled').length : (s.filledSlots || 0);
            const registeredCount = txs.length > 0 ? txs.length : filledSlots;
            const totalEntryFeesLocked = registeredCount * entryFee;
            const totalEscrow = totalEntryFeesLocked + prizePool;

            const earning = (tournamentEarnings as TournamentEarning[]).find(e => e.tournamentId === s.id);

            items.push({
                id: s.id,
                title: s.title || 'Community Practice Scrim',
                type: 'scrim',
                game: s.game || 'Esports',
                hostUid: s.hostUid || s.orgId || '',
                hostName: s.hostName || s.orgName || 'Community Host',
                entryFee,
                prizePool,
                status: s.status || 'open',
                escrowFrozen: s.escrowFrozen || false,
                freezeReason: s.freezeReason,
                registeredCount,
                totalSlots: s.totalSlots || 0,
                totalEntryFeesLocked,
                totalEscrow,
                earningRecord: earning
            });
        });

        return items;
    }, [allTournaments, scrimsList, allTransactions, tournamentEarnings]);

    // Filtered Escrow Events
    const filteredEvents = useMemo(() => {
        return escrowEvents.filter(evt => {
            const matchesSearch = !searchQuery || 
                evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                evt.game.toLowerCase().includes(searchQuery.toLowerCase()) ||
                evt.hostName.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesType = typeFilter === 'all' || evt.type === typeFilter;

            let matchesStatus = true;
            if (statusFilter === 'active') {
                matchesStatus = evt.status !== 'completed' && evt.status !== 'cancelled' && !evt.escrowFrozen;
            } else if (statusFilter === 'settled') {
                matchesStatus = evt.earningRecord?.status === 'released' || evt.status === 'completed';
            } else if (statusFilter === 'frozen') {
                matchesStatus = Boolean(evt.escrowFrozen);
            }

            return matchesSearch && matchesType && matchesStatus;
        });
    }, [escrowEvents, searchQuery, typeFilter, statusFilter]);

    // Master Escrow KPIs
    const kpis = useMemo(() => {
        let totalLockedInEscrow = 0;
        let totalEntryFees = 0;
        let totalPrizepools = 0;
        let activeVaultsCount = 0;
        let frozenVaultsCount = 0;

        escrowEvents.forEach(e => {
            if (e.status !== 'completed' && e.status !== 'cancelled') {
                totalLockedInEscrow += e.totalEscrow;
                totalEntryFees += e.totalEntryFeesLocked;
                totalPrizepools += e.prizePool;
                activeVaultsCount += 1;
            }
            if (e.escrowFrozen) {
                frozenVaultsCount += 1;
            }
        });

        return {
            totalLockedInEscrow,
            totalEntryFees,
            totalPrizepools,
            activeVaultsCount,
            frozenVaultsCount
        };
    }, [escrowEvents]);

    // Action: Freeze / Unfreeze Escrow
    const handleToggleFreezeEscrow = async () => {
        if (!freezeModalEvent) return;
        setIsProcessingAction(true);
        try {
            const targetCollection = freezeModalEvent.type === 'tournament' ? 'tournaments' : 'scrims';
            const docRef = doc(db, targetCollection, freezeModalEvent.id);
            const newFrozenState = !freezeModalEvent.escrowFrozen;

            await updateDoc(docRef, {
                escrowFrozen: newFrozenState,
                freezeReason: newFrozenState ? (freezeReason.trim() || 'Admin Investigation') : null,
                escrowUpdatedAt: serverTimestamp()
            });

            // Update local state
            freezeModalEvent.escrowFrozen = newFrozenState;
            freezeModalEvent.freezeReason = newFrozenState ? (freezeReason.trim() || 'Admin Investigation') : undefined;

            showToast(
                newFrozenState ? `Escrow FROZEN for "${freezeModalEvent.title}"` : `Escrow Unfrozen for "${freezeModalEvent.title}"`,
                newFrozenState ? 'warning' : 'success'
            );

            setFreezeModalEvent(null);
            setFreezeReason('');
            fetchScrims();
        } catch (error: any) {
            console.error('Error updating escrow freeze:', error);
            showToast(error.message || 'Failed to update escrow state', 'error');
        } finally {
            setIsProcessingAction(false);
        }
    };

    // Action: Emergency Batch Refund to all participants
    const handleExecuteEmergencyRefund = async () => {
        if (!refundModalEvent) return;
        setIsProcessingAction(true);

        try {
            // Find all registered participant transactions for this event
            const entryTxs = (allTransactions as Transaction[]).filter(
                tx => (tx.type === 'entry_fee' || (tx as any).type === 'scrim_entry_fee') &&
                      tx.tournamentId === refundModalEvent.id &&
                      (tx.status === 'success' || tx.status === 'completed')
            );

            if (entryTxs.length === 0) {
                showToast('No debited entry fee transactions found for this event.', 'info');
                setRefundModalEvent(null);
                return;
            }

            const batch = writeBatch(db);
            const refundRefBase = `REFUND_${refundModalEvent.id.slice(0, 8)}_${Date.now()}`;

            for (let i = 0; i < entryTxs.length; i++) {
                const originalTx = entryTxs[i];
                const refundAmount = Math.abs(originalTx.amount);

                // 1. Create Refund Transaction record in transactions collection
                const refundDocRef = doc(collection(db, 'transactions'));
                batch.set(refundDocRef, {
                    userId: originalTx.userId,
                    username: originalTx.username || 'Player',
                    userEmail: originalTx.userEmail || '',
                    type: 'refund',
                    amount: refundAmount,
                    method: 'Wallet Restitution',
                    refId: `${refundRefBase}_${i + 1}`,
                    status: 'completed',
                    timestamp: serverTimestamp(),
                    tournamentId: refundModalEvent.id,
                    desc: `Emergency Escrow Refund: ${refundModalEvent.title}`
                });

                // 2. Note: User balance updates will also sync via backend trigger or admin balance endpoint
            }

            // 3. Mark tournament/scrim as cancelled with refund flag
            const targetCollection = refundModalEvent.type === 'tournament' ? 'tournaments' : 'scrims';
            const eventDocRef = doc(db, targetCollection, refundModalEvent.id);
            batch.update(eventDocRef, {
                status: 'cancelled',
                escrowStatus: 'REFUNDED',
                refundedAt: serverTimestamp(),
                refundCount: entryTxs.length,
                escrowFrozen: false
            });

            await batch.commit();

            showToast(`Successfully refunded ${entryTxs.length} players for ${formatCurrency(refundModalEvent.totalEntryFeesLocked)}!`, 'success');
            setRefundModalEvent(null);
            fetchScrims();
        } catch (error: any) {
            console.error('Error executing emergency refund:', error);
            showToast(error.message || 'Failed to complete batch refund', 'error');
        } finally {
            setIsProcessingAction(false);
        }
    };

    // Helper to get registration transactions for a specific event
    const getEventRegistrationTxs = (eventId: string) => {
        return (allTransactions as Transaction[]).filter(
            tx => (tx.type === 'entry_fee' || (tx as any).type === 'scrim_entry_fee') &&
                  tx.tournamentId === eventId &&
                  (tx.status === 'success' || tx.status === 'completed')
        );
    };

    return (
        <div className="space-y-6 text-gray-100">
            {/* 1. Header & Summary KPIs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Lock className="text-amber-500" /> Tournament & Scrim Locked Escrow Wallets
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Independent vault securing player entry fees and committed prize pools until verified completion
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={fetchScrims}
                        disabled={loadingScrims}
                        className="p-2.5 bg-dark border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-white transition disabled:opacity-50"
                        title="Refresh Escrow Vaults"
                    >
                        <RefreshCw className={`w-4 h-4 ${loadingScrims ? 'animate-spin text-brand-400' : ''}`} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab && setActiveTab('tab-org-earnings')}
                        className="bg-brand-600 hover:bg-brand-500 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-brand-950/40"
                    >
                        <DollarSign className="w-4 h-4" /> Go to Settlement & Releases
                    </button>
                </div>
            </div>

            {/* 2. Escrow KPI Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-card p-4 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-transparent">
                    <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Total Escrow Locked</span>
                        <Lock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-black text-amber-400 font-mono">
                        {formatCurrency ? formatCurrency(kpis.totalLockedInEscrow) : `Rs. ${kpis.totalLockedInEscrow.toLocaleString()}`}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Active player entry fees + prize pools</p>
                </div>

                <div className="bg-card p-4 rounded-2xl border border-slate-800">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Locked Entry Fees</span>
                        <Receipt className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-2xl font-black text-white font-mono">
                        {formatCurrency ? formatCurrency(kpis.totalEntryFees) : `Rs. ${kpis.totalEntryFees.toLocaleString()}`}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Paid by registering players</p>
                </div>

                <div className="bg-card p-4 rounded-2xl border border-slate-800">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Committed Prizepools</span>
                        <Trophy className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-black text-purple-400 font-mono">
                        {formatCurrency ? formatCurrency(kpis.totalPrizepools) : `Rs. ${kpis.totalPrizepools.toLocaleString()}`}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Guaranteed prize funds in play</p>
                </div>

                <div className="bg-card p-4 rounded-2xl border border-slate-800">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Active Vaults</span>
                        <Flame className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-black text-white font-mono">
                        {kpis.activeVaultsCount}
                    </div>
                    <p className="text-[10px] text-emerald-400 mt-1">Live & upcoming competitions</p>
                </div>

                <div className={`bg-card p-4 rounded-2xl border ${kpis.frozenVaultsCount > 0 ? 'border-red-500/40 bg-red-950/20' : 'border-slate-800'}`}>
                    <div className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span className={kpis.frozenVaultsCount > 0 ? 'text-red-400' : 'text-slate-400'}>Frozen / Protests</span>
                        <ShieldAlert className={`w-4 h-4 ${kpis.frozenVaultsCount > 0 ? 'text-red-400' : 'text-slate-500'}`} />
                    </div>
                    <div className={`text-2xl font-black font-mono ${kpis.frozenVaultsCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {kpis.frozenVaultsCount}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                        {kpis.frozenVaultsCount > 0 ? 'Action required: Under dispute' : 'Zero frozen vaults'}
                    </p>
                </div>
            </div>

            {/* 3. Search & Filter Bar */}
            <div className="bg-card p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by event, game, host..."
                            className="w-full bg-dark border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus-visible:outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as any)}
                            className="bg-dark border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus-visible:outline-none"
                        >
                            <option value="all">All Formats</option>
                            <option value="tournament">Tournaments Only</option>
                            <option value="scrim">Scrims Only</option>
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="bg-dark border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus-visible:outline-none"
                        >
                            <option value="all">All Statuses</option>
                            <option value="active">Active Locked</option>
                            <option value="settled">Settled / Released</option>
                            <option value="frozen">Frozen Only</option>
                        </select>
                    </div>
                </div>

                <div className="text-xs text-slate-400 font-mono">
                    Showing <span className="text-white font-bold">{filteredEvents.length}</span> of {escrowEvents.length} escrow vaults
                </div>
            </div>

            {/* 4. Main Escrow Table */}
            <div className="bg-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 bg-dark/40 text-[10px] text-slate-400 uppercase tracking-wider">
                                <th className="p-4 font-bold">Event & Game</th>
                                <th className="p-4 font-bold">Host Org</th>
                                <th className="p-4 font-bold">Entry Fee / Slot</th>
                                <th className="p-4 font-bold">Registered / Max</th>
                                <th className="p-4 font-bold">Locked Entry Fees</th>
                                <th className="p-4 font-bold">Prize Pool</th>
                                <th className="p-4 font-bold">Total Escrow</th>
                                <th className="p-4 font-bold">Vault Status</th>
                                <th className="p-4 font-bold text-right">Escrow Controls</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-xs">
                            {filteredEvents.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                                        No escrow records found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredEvents.map(evt => {
                                    const isPaid = evt.entryFee > 0;
                                    return (
                                        <tr key={evt.id} className="hover:bg-slate-800/30 transition-colors">
                                            {/* Event & Game */}
                                            <td className="p-4">
                                                <div className="font-bold text-white text-sm leading-snug">{evt.title}</div>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                        evt.type === 'tournament' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                                    }`}>
                                                        {evt.type}
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 font-medium">{evt.game}</span>
                                                </div>
                                            </td>

                                            {/* Host Org */}
                                            <td className="p-4">
                                                <div className="text-slate-300 font-medium">{evt.hostName}</div>
                                                <div className="text-[10px] text-slate-500 font-mono truncate max-w-[100px]">{evt.hostUid.slice(0, 10)}...</div>
                                            </td>

                                            {/* Entry Fee */}
                                            <td className="p-4">
                                                <span className={`font-mono font-bold ${isPaid ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                    {isPaid ? (formatCurrency ? formatCurrency(evt.entryFee) : `Rs. ${evt.entryFee}`) : 'FREE'}
                                                </span>
                                            </td>

                                            {/* Registered / Max */}
                                            <td className="p-4">
                                                <div className="font-mono text-white font-bold">
                                                    {evt.registeredCount} {evt.totalSlots > 0 ? `/ ${evt.totalSlots}` : 'registered'}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedEventForLedger(evt)}
                                                    className="text-[10px] text-brand-400 hover:underline flex items-center gap-0.5 mt-0.5"
                                                >
                                                    <Users className="w-3 h-3" /> View Ledger
                                                </button>
                                            </td>

                                            {/* Locked Entry Fees */}
                                            <td className="p-4">
                                                <div className="font-mono font-bold text-white">
                                                    {formatCurrency ? formatCurrency(evt.totalEntryFeesLocked) : `Rs. ${evt.totalEntryFeesLocked.toLocaleString()}`}
                                                </div>
                                            </td>

                                            {/* Prize Pool */}
                                            <td className="p-4">
                                                <div className="font-mono font-bold text-purple-400">
                                                    {formatCurrency ? formatCurrency(evt.prizePool) : `Rs. ${evt.prizePool.toLocaleString()}`}
                                                </div>
                                            </td>

                                            {/* Total Escrow */}
                                            <td className="p-4">
                                                <div className="font-mono font-black text-amber-400 text-sm">
                                                    {formatCurrency ? formatCurrency(evt.totalEscrow) : `Rs. ${evt.totalEscrow.toLocaleString()}`}
                                                </div>
                                            </td>

                                            {/* Vault Status */}
                                            <td className="p-4">
                                                {evt.escrowFrozen ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                                                        <ShieldAlert className="w-3 h-3" /> Frozen / Hold
                                                    </span>
                                                ) : evt.earningRecord?.status === 'released' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        <CheckCircle2 className="w-3 h-3" /> Settled & Paid
                                                    </span>
                                                ) : evt.status === 'completed' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                        <Clock className="w-3 h-3" /> Awaiting Release
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                        <Lock className="w-3 h-3" /> Active In Play
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedEventForLedger(evt)}
                                                        className="p-2 bg-dark hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition"
                                                        title="Inspect Player Registration Transactions"
                                                    >
                                                        <Receipt className="w-4 h-4" />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setFreezeModalEvent(evt);
                                                            setFreezeReason(evt.freezeReason || '');
                                                        }}
                                                        className={`p-2 rounded-lg border transition ${
                                                            evt.escrowFrozen 
                                                                ? 'bg-red-600/20 text-red-400 border-red-500/40 hover:bg-red-600 hover:text-white' 
                                                                : 'bg-dark hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                                                        }`}
                                                        title={evt.escrowFrozen ? 'Unfreeze Escrow' : 'Freeze Escrow (Investigate Protest)'}
                                                    >
                                                        {evt.escrowFrozen ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                                    </button>

                                                    {isPaid && evt.totalEntryFeesLocked > 0 && evt.status !== 'completed' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setRefundModalEvent(evt)}
                                                            className="p-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-lg transition"
                                                            title="Emergency Batch Refund All Participants"
                                                        >
                                                            <RotateCcw className="w-4 h-4" />
                                                        </button>
                                                    )}
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

            {/* Modal 1: Participant Registration Ledger Inspector */}
            {selectedEventForLedger && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-2xl rounded-3xl border border-slate-800 p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                            <div>
                                <div className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                                    Escrow Vault Registration Ledger
                                </div>
                                <h3 className="text-xl font-black text-white uppercase mt-0.5">
                                    {selectedEventForLedger.title}
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Entry Fee: {formatCurrency ? formatCurrency(selectedEventForLedger.entryFee) : `Rs. ${selectedEventForLedger.entryFee}`} • Total Locked: {formatCurrency ? formatCurrency(selectedEventForLedger.totalEntryFeesLocked) : `Rs. ${selectedEventForLedger.totalEntryFeesLocked}`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedEventForLedger(null)}
                                className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-dark transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Transactions List */}
                        <div className="space-y-3">
                            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                Registered Player Payments ({getEventRegistrationTxs(selectedEventForLedger.id).length})
                            </div>
                            
                            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {getEventRegistrationTxs(selectedEventForLedger.id).length === 0 ? (
                                    <div className="p-6 text-center text-slate-500 bg-dark/40 rounded-2xl border border-slate-800">
                                        No direct wallet debit transactions recorded. (Participants may have joined during free tier or direct roster upload).
                                    </div>
                                ) : (
                                    getEventRegistrationTxs(selectedEventForLedger.id).map(tx => (
                                        <div key={tx.id} className="bg-dark/50 p-3.5 rounded-xl border border-slate-800 flex justify-between items-center">
                                            <div>
                                                <div className="text-white font-bold text-sm">{tx.username || 'Registered Player'}</div>
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                    REF: {tx.refId} • {formatDate ? formatDate(tx.timestamp) : ''}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono font-bold text-red-400">
                                                    -{formatCurrency ? formatCurrency(Math.abs(tx.amount)) : `Rs. ${Math.abs(tx.amount)}`}
                                                </div>
                                                <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                    Debited & Locked
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setSelectedEventForLedger(null)}
                                className="px-5 py-2.5 bg-dark hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                            >
                                Close Ledger
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal 2: Freeze / Unfreeze Escrow */}
            {freezeModalEvent && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-3xl border border-slate-800 p-6 space-y-5 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-2xl ${freezeModalEvent.escrowFrozen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {freezeModalEvent.escrowFrozen ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase">
                                    {freezeModalEvent.escrowFrozen ? 'Unfreeze Escrow Vault' : 'Freeze Escrow Vault'}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">{freezeModalEvent.title}</p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                            {freezeModalEvent.escrowFrozen
                                ? 'Unfreezing will restore normal payout capabilities. Organizer earnings and player prizes can be finalized.'
                                : 'Freezing locks all prize distributions and prevents organizer profit releases. Use this if score protests, player cheating, or disputes are under investigation.'}
                        </p>

                        {!freezeModalEvent.escrowFrozen && (
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase block mb-1.5">
                                    Reason for Hold / Investigation
                                </label>
                                <textarea
                                    value={freezeReason}
                                    onChange={(e) => setFreezeReason(e.target.value)}
                                    placeholder="e.g. Host score tampering reported by Team A, investigating room screenshots..."
                                    rows={3}
                                    className="w-full bg-dark border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-red-500 focus-visible:outline-none"
                                />
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setFreezeModalEvent(null)}
                                disabled={isProcessingAction}
                                className="flex-1 py-2.5 bg-dark hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleToggleFreezeEscrow}
                                disabled={isProcessingAction}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition uppercase ${
                                    freezeModalEvent.escrowFrozen
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                        : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/40'
                                }`}
                            >
                                {isProcessingAction ? 'Processing...' : freezeModalEvent.escrowFrozen ? 'Confirm Unfreeze' : 'Confirm Freeze'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal 3: Emergency Batch Refund All Participants */}
            {refundModalEvent && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-3xl border border-red-500/40 p-6 space-y-5 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-red-500/20 text-red-400">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase">Emergency Batch Refund</h3>
                                <p className="text-xs text-slate-400 mt-0.5">{refundModalEvent.title}</p>
                            </div>
                        </div>

                        <div className="bg-red-950/30 border border-red-500/30 p-4 rounded-2xl space-y-2">
                            <div className="text-xs font-bold text-red-300">
                                This will automatically refund all {refundModalEvent.registeredCount} registered participants!
                            </div>
                            <div className="text-xs text-slate-300">
                                Total refund payout: <span className="font-mono font-bold text-white">{formatCurrency ? formatCurrency(refundModalEvent.totalEntryFeesLocked) : `Rs. ${refundModalEvent.totalEntryFeesLocked}`}</span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                                Each player will receive their debited entry fee credited back to their wallet balance, with an official refund audit transaction logged.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setRefundModalEvent(null)}
                                disabled={isProcessingAction}
                                className="flex-1 py-2.5 bg-dark hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleExecuteEmergencyRefund}
                                disabled={isProcessingAction}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition uppercase shadow-lg shadow-red-950/40"
                            >
                                {isProcessingAction ? 'Refunding...' : 'Confirm Safe Refund'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default EscrowWalletsTab;
