import React, { useState, useMemo } from 'react';
import { 
    CreditCard, 
    Search, 
    Eye, 
    Download, 
    Calendar, 
    Filter, 
    ArrowDownRight, 
    ArrowUpRight, 
    Lock, 
    Trophy, 
    RotateCcw, 
    Sliders,
    Layers
} from 'lucide-react';
import { Transaction, Tournament } from '../../../shared/types/types';

interface TransactionHistoryTabProps {
    allTransactions: Transaction[];
    allTournaments: Tournament[];
    setSelectedTx: (tx: Transaction) => void;
    formatDate: (timestamp: any) => string;
    getRelativeTime: (timestamp: any) => string;
    formatCurrency: (amount: number) => string;
    txFilterType: string;
    setTxFilterType: (val: any) => void;
    txFilterStatus: string;
    setTxFilterStatus: (val: any) => void;
    txFilterTournament: string;
    setTxFilterTournament: (val: string) => void;
    txSearchUser: string;
    setTxSearchUser: (val: string) => void;
}

export const TransactionHistoryTab: React.FC<TransactionHistoryTabProps> = ({
    allTransactions = [],
    allTournaments = [],
    setSelectedTx,
    formatDate,
    getRelativeTime,
    formatCurrency,
    txFilterType,
    setTxFilterType,
    txFilterStatus,
    setTxFilterStatus,
    txFilterTournament,
    setTxFilterTournament,
    txSearchUser,
    setTxSearchUser
}) => {
    const [dateRange, setDateRange] = useState<'all' | 'today' | 'month'>('all');

    // Filtered Transactions
    const filteredTransactions = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        return allTransactions.filter(t => {
            // Type Filter
            let matchesType = true;
            if (txFilterType !== 'all') {
                if (txFilterType === 'entry_fee') {
                    matchesType = t.type === 'entry_fee' || (t as any).type === 'scrim_entry_fee';
                } else if (txFilterType === 'prize') {
                    matchesType = t.type === 'prize' || (t as any).type === 'prize_payout';
                } else if (txFilterType === 'withdrawal') {
                    matchesType = t.type === 'withdrawal' || (t as any).type === 'withdraw';
                } else {
                    matchesType = t.type === txFilterType;
                }
            }

            // Status Filter
            let matchesStatus = true;
            if (txFilterStatus !== 'all') {
                if (txFilterStatus === 'success') {
                    matchesStatus = t.status === 'success' || t.status === 'completed';
                } else {
                    matchesStatus = t.status === txFilterStatus;
                }
            }

            // Tournament Filter
            const matchesTournament = txFilterTournament === 'all' || t.tournamentId === txFilterTournament;

            // User Search Filter
            const matchesUser = !txSearchUser || 
                t.username?.toLowerCase().includes(txSearchUser.toLowerCase()) ||
                t.userEmail?.toLowerCase().includes(txSearchUser.toLowerCase()) ||
                t.userId?.toLowerCase().includes(txSearchUser.toLowerCase()) ||
                t.refId?.toLowerCase().includes(txSearchUser.toLowerCase()) ||
                t.transactionCode?.toLowerCase().includes(txSearchUser.toLowerCase());

            // Date Range Filter
            let matchesDate = true;
            const txTime = t.timestamp?.toDate ? t.timestamp.toDate().getTime() : (new Date(t.timestamp).getTime() || 0);
            if (dateRange === 'today') {
                matchesDate = txTime >= startOfDay;
            } else if (dateRange === 'month') {
                matchesDate = txTime >= startOfMonth;
            }

            return matchesType && matchesStatus && matchesUser && matchesTournament && matchesDate;
        });
    }, [allTransactions, txFilterType, txFilterStatus, txFilterTournament, txSearchUser, dateRange]);

    // Financial Metrics for the Filtered Subset
    const filteredMetrics = useMemo(() => {
        let totalCredits = 0;
        let totalDebits = 0;

        filteredTransactions.forEach(t => {
            if (t.status === 'success' || t.status === 'completed') {
                if (t.amount > 0) totalCredits += t.amount;
                else totalDebits += Math.abs(t.amount);
            }
        });

        return {
            count: filteredTransactions.length,
            totalCredits,
            totalDebits,
            netVolume: totalCredits + totalDebits
        };
    }, [filteredTransactions]);

    // CSV Export for Platform Accounting and Audit Trail
    const handleExportCSV = () => {
        const headers = [
            'Date',
            'Time',
            'Transaction ID',
            'Reference ID',
            'Tx Code',
            'User Name',
            'User Email',
            'Type',
            'Method',
            'Amount',
            'Status',
            'Confirmed By',
            'Tournament ID',
            'Description'
        ].join(',');

        const rows = filteredTransactions.map(t => {
            const dateObj = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
            const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString() : '';
            const timeStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString() : '';

            return [
                `"${dateStr}"`,
                `"${timeStr}"`,
                `"${t.id}"`,
                `"${(t.refId || '').replace(/"/g, '""')}"`,
                `"${(t.transactionCode || '').replace(/"/g, '""')}"`,
                `"${(t.username || '').replace(/"/g, '""')}"`,
                `"${(t.userEmail || '').replace(/"/g, '""')}"`,
                `"${t.type}"`,
                `"${(t.method || '').replace(/"/g, '""')}"`,
                `"${t.amount}"`,
                `"${t.status}"`,
                `"${(t.confirmedByUsername || '').replace(/"/g, '""')}"`,
                `"${(t.tournamentId || '').replace(/"/g, '""')}"`,
                `"${(t.desc || '').replace(/"/g, '""')}"`
            ].join(',');
        }).join('\n');

        const csvContent = `${headers}\n${rows}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `nexplay_audit_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'deposit':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ArrowDownRight className="w-3 h-3" /> Deposit
                    </span>
                );
            case 'withdrawal':
            case 'withdraw':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                        <ArrowUpRight className="w-3 h-3" /> Cashout
                    </span>
                );
            case 'entry_fee':
            case 'scrim_entry_fee':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Lock className="w-3 h-3" /> Entry Fee (Escrow)
                    </span>
                );
            case 'prize':
            case 'prize_payout':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Trophy className="w-3 h-3" /> Prizepool
                    </span>
                );
            case 'refund':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        <RotateCcw className="w-3 h-3" /> Refund
                    </span>
                );
            case 'admin_adjustment':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        <Sliders className="w-3 h-3" /> Adjustment
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {type}
                    </span>
                );
        }
    };

    const getStatusBadge = (status: string) => {
        if (status === 'success' || status === 'completed') {
            return <span className="px-2.5 py-0.5 rounded-full font-black uppercase text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Completed</span>;
        }
        if (status === 'pending') {
            return <span className="px-2.5 py-0.5 rounded-full font-black uppercase text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span>;
        }
        if (status === 'refunded') {
            return <span className="px-2.5 py-0.5 rounded-full font-black uppercase text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20">Refunded</span>;
        }
        return <span className="px-2.5 py-0.5 rounded-full font-black uppercase text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">{status}</span>;
    };

    return (
        <div className="bg-card p-6 rounded-3xl border border-slate-800 space-y-6 text-gray-100">
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800 pb-5">
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Layers className="text-brand-500" /> Master Financial Ledger & Audit Trail
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Cryptographically reconciled record of every credit, debit, escrow lock, and fee deduction
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="bg-dark hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
                    >
                        <Download className="w-4 h-4 text-brand-400" /> Export Audit CSV
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar for Filtered View */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-dark/40 p-4 rounded-2xl border border-slate-800">
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtered Records</div>
                    <div className="text-lg font-black text-white font-mono">{filteredMetrics.count}</div>
                </div>
                <div>
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Total Credits In</div>
                    <div className="text-lg font-black text-emerald-400 font-mono">+{formatCurrency(filteredMetrics.totalCredits)}</div>
                </div>
                <div>
                    <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Total Debits Out</div>
                    <div className="text-lg font-black text-red-400 font-mono">-{formatCurrency(filteredMetrics.totalDebits)}</div>
                </div>
                <div>
                    <div className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">Gross Flow Volume</div>
                    <div className="text-lg font-black text-white font-mono">{formatCurrency(filteredMetrics.netVolume)}</div>
                </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2.5 bg-dark/60 p-3.5 rounded-2xl border border-slate-800">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search user, ref ID, tx code..." 
                        value={txSearchUser}
                        onChange={e => setTxSearchUser(e.target.value)}
                        className="w-full bg-dark border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white text-xs placeholder-slate-500 focus:border-brand-500 focus-visible:outline-none"
                    />
                </div>

                {/* Type Filter */}
                <select 
                    value={txFilterType} 
                    onChange={e => setTxFilterType(e.target.value as any)}
                    className="bg-dark border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-brand-500 focus-visible:outline-none"
                >
                    <option value="all">All Flow Types</option>
                    <option value="deposit">Deposits Only</option>
                    <option value="withdrawal">Cashouts Only</option>
                    <option value="entry_fee">Entry Fees (Escrow)</option>
                    <option value="prize">Prizepool Payouts</option>
                    <option value="refund">Refunds</option>
                    <option value="admin_adjustment">Admin Adjustments</option>
                    <option value="promo">Promo Codes</option>
                </select>

                {/* Status Filter */}
                <select 
                    value={txFilterStatus} 
                    onChange={e => setTxFilterStatus(e.target.value as any)}
                    className="bg-dark border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-brand-500 focus-visible:outline-none"
                >
                    <option value="all">All Statuses</option>
                    <option value="success">Completed / Settled</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                    <option value="refunded">Refunded</option>
                </select>

                {/* Tournament Filter */}
                <select 
                    value={txFilterTournament} 
                    onChange={e => setTxFilterTournament(e.target.value)}
                    className="bg-dark border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-brand-500 focus-visible:outline-none max-w-[180px]"
                >
                    <option value="all">All Tournaments</option>
                    {allTournaments.map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                </select>

                {/* Date Preset Filter */}
                <div className="flex items-center gap-1 bg-dark p-1 rounded-xl border border-slate-700">
                    <button
                        type="button"
                        onClick={() => setDateRange('all')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition ${
                            dateRange === 'all' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        All
                    </button>
                    <button
                        type="button"
                        onClick={() => setDateRange('today')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition ${
                            dateRange === 'today' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => setDateRange('month')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition ${
                            dateRange === 'month' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Month
                    </button>
                </div>
            </div>

            {/* Ledger Table */}
            <div className="overflow-x-auto custom-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-800 bg-dark/40">
                            <th className="py-3 px-4 font-bold">Date & Time</th>
                            <th className="py-3 px-4 font-bold">User / Account</th>
                            <th className="py-3 px-4 font-bold">Flow Type</th>
                            <th className="py-3 px-4 font-bold">Channel / Gateway</th>
                            <th className="py-3 px-4 font-bold">Amount</th>
                            <th className="py-3 px-4 font-bold">Ledger Status</th>
                            <th className="py-3 px-4 font-bold">Audit Reference</th>
                            <th className="py-3 px-4 font-bold text-right">Details</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-800/60">
                        {filteredTransactions.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                                    No ledger records found matching your filters.
                                </td>
                            </tr>
                        ) : (
                            filteredTransactions.map(t => {
                                const isPositive = t.amount > 0;
                                return (
                                    <tr 
                                        key={t.id} 
                                        onClick={() => setSelectedTx(t)}
                                        className="hover:bg-slate-800/30 transition cursor-pointer group"
                                    >
                                        <td className="py-3 px-4 text-slate-400 font-mono">
                                            <div className="text-white text-xs">{formatDate ? formatDate(t.timestamp) : ''}</div>
                                            <div className="text-[10px] text-slate-500">{getRelativeTime(t.timestamp)}</div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="text-white font-bold">{t.username || t.userId?.slice(0, 8)}</div>
                                            <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{t.userEmail}</div>
                                            {t.confirmedByUsername && (
                                                <div className="text-[9px] text-brand-400 font-mono font-bold">Auditor: {t.confirmedByUsername}</div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            {getTypeBadge(t.type)}
                                        </td>
                                        <td className="py-3 px-4 text-slate-300 font-medium">
                                            {t.method || 'Internal Vault'}
                                        </td>
                                        <td className={`py-3 px-4 font-mono font-black ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {isPositive ? `+${formatCurrency(t.amount)}` : `-${formatCurrency(Math.abs(t.amount))}`}
                                        </td>
                                        <td className="py-3 px-4">
                                            {getStatusBadge(t.status)}
                                        </td>
                                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                                            <div className="text-slate-300 font-bold select-all truncate max-w-[130px]">{t.refId || 'N/A'}</div>
                                            {t.transactionCode && (
                                                <div className="text-[10px] text-brand-400 truncate max-w-[130px]">Code: {t.transactionCode}</div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.stopPropagation(); setSelectedTx(t); }}
                                                className="bg-dark hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition border border-slate-700 flex items-center gap-1 ml-auto"
                                            >
                                                <Eye className="w-3 h-3 text-brand-400" /> Audit
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TransactionHistoryTab;
