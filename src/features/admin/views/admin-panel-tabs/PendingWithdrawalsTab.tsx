import React, { useState, useMemo } from 'react';
import { 
    ArrowUp, 
    Check, 
    Eye, 
    X, 
    Copy, 
    CheckCheck, 
    AlertTriangle, 
    Wallet, 
    Building, 
    Send,
    ShieldCheck,
    Clock
} from 'lucide-react';
import { AdminPanelTabProps } from './types';
import { Transaction, UserProfile } from '../../../../shared/types/types';

export const PendingWithdrawalsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { 
        allTransactions = [], 
        users = [],
        closeConfirmModal, 
        formatCurrency, 
        formatCurrencyExact,
        getRelativeTime, 
        handleApproveTx, 
        handleRejectTx, 
        setConfirmModal, 
        setSelectedTx 
    } = props;

    const [processingId, setProcessingId] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    
    // Approval payout reference modal
    const [approvingTx, setApprovingTx] = useState<Transaction | null>(null);
    const [payoutRefInput, setPayoutRefInput] = useState('');

    // Rejection modal
    const [rejectingTx, setRejectingTx] = useState<Transaction | null>(null);
    const [selectedRejectReason, setSelectedRejectReason] = useState('Invalid account details provided');
    const [customRejectReason, setCustomRejectReason] = useState('');

    const pendingWithdrawals = (allTransactions as Transaction[]).filter(
        t => (t.type === 'withdrawal' || t.type === 'withdraw') && t.status === 'pending'
    );

    const userMap = useMemo(() => {
        const map = new Map<string, UserProfile>();
        (users as UserProfile[]).forEach(u => {
            if (u.uid) map.set(u.uid, u);
        });
        return map;
    }, [users]);

    const totalPendingAmount = useMemo(() => {
        return pendingWithdrawals.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    }, [pendingWithdrawals]);

    const handleCopy = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(label);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleConfirmApproval = async () => {
        if (!approvingTx) return;
        setProcessingId(approvingTx.id);
        try {
            // Include payout reference if provided
            const txPayload = {
                ...approvingTx,
                payoutReference: payoutRefInput.trim() || undefined
            };
            await handleApproveTx(txPayload);
            setApprovingTx(null);
            setPayoutRefInput('');
        } finally {
            setProcessingId(null);
        }
    };

    const handleConfirmRejection = async () => {
        if (!rejectingTx) return;
        setProcessingId(rejectingTx.id);
        const finalReason = customRejectReason.trim() || selectedRejectReason;
        try {
            if (handleRejectTx) {
                await handleRejectTx(rejectingTx, finalReason);
            }
            setRejectingTx(null);
            setCustomRejectReason('');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="bg-card p-6 rounded-3xl border border-slate-800 space-y-6 text-gray-100">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center gap-4 flex-wrap">
                    <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <ArrowUp className="text-red-400" /> Pending Cashout Requests
                    </h2>
                    <span className="bg-red-500/20 text-red-400 text-xs font-black px-3 py-1 rounded-full border border-red-500/30">
                        {pendingWithdrawals.length} Pending
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">
                        Total Payout Value: <span className="text-white">{formatCurrency(totalPendingAmount)}</span>
                    </span>
                </div>

                {pendingWithdrawals.length > 0 && (
                    <div className="flex items-center gap-3">
                        <button 
                            type="button" 
                            onClick={() => {
                                setConfirmModal({
                                    isOpen: true,
                                    title: 'Bulk Reject Withdrawals',
                                    message: 'Are you sure you want to REJECT ALL pending withdrawals? Withdrawn funds will be returned immediately to each user\'s wallet.',
                                    isDestructive: true,
                                    onConfirm: async () => {
                                        for (const t of pendingWithdrawals) {
                                            setProcessingId(t.id);
                                            try {
                                                if (handleRejectTx) await handleRejectTx(t, 'Bulk rejected by admin');
                                            } finally {
                                                setProcessingId(null);
                                            }
                                        }
                                        closeConfirmModal();
                                    }
                                });
                            }}
                            className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 hover:border-red-500 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition"
                        >
                            Bulk Reject All
                        </button>
                    </div>
                )}
            </div>

            {/* Withdrawals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[680px] overflow-y-auto custom-scrollbar pr-1">
                {pendingWithdrawals.length > 0 ? (
                    pendingWithdrawals.map(t => {
                        const userProfile = userMap.get(t.userId);
                        const userTotalBalance = (userProfile?.balance || 0) + (userProfile?.orgWalletBalance || 0);

                        return (
                            <div key={t.id} className="bg-dark/60 hover:bg-dark p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all shadow-md group flex flex-col justify-between">
                                <div>
                                    {/* Top Row: Method, User & Amount */}
                                    <div className="flex justify-between items-start mb-3 border-b border-slate-800 pb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-black tracking-wider text-red-400 uppercase text-[10px] bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                                    Cashout
                                                </span>
                                                <span className="text-[10px] bg-surface px-2 py-0.5 rounded-full text-slate-300 font-bold tracking-wider">
                                                    {t.method}
                                                </span>
                                            </div>
                                            <div className="text-white font-bold text-sm flex items-center gap-1.5">
                                                <span>{t.username || userProfile?.username || 'Player'}</span>
                                                {userProfile && (
                                                    <span className="text-[10px] font-normal text-slate-400 font-mono">
                                                        ({userProfile.role || 'player'})
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono">{getRelativeTime(t.timestamp)}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-black text-red-400 tracking-tight font-mono">
                                                -{(formatCurrencyExact || formatCurrency)(Math.abs(t.amount))}
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                Rem. Bal: {(formatCurrencyExact || formatCurrency)(userTotalBalance)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Details Cards & Copy Helpers */}
                                    <div className="text-[11px] text-slate-400 mb-4 space-y-2">
                                        <div className="bg-dark/40 p-2.5 rounded-xl border border-slate-800/80 font-mono flex justify-between items-center">
                                            <span className="text-slate-500 text-[10px]">INTERNAL REF:</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-brand-300 select-all break-all">{t.refId}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(t.refId, `ref_${t.id}`)}
                                                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700/50 transition"
                                                    title="Copy Ref"
                                                >
                                                    {copiedField === `ref_${t.id}` ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        </div>

                                        {t.accountDetails && (
                                            <div className="bg-dark/40 p-2.5 rounded-xl border border-slate-800/80 font-mono flex justify-between items-center">
                                                <span className="text-slate-500 text-[10px]">RECEIVING ACCOUNT:</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-white font-bold select-all break-all">{t.accountDetails}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(t.accountDetails || '', `acc_${t.id}`)}
                                                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700/50 transition"
                                                        title="Copy Account Details"
                                                    >
                                                        {copiedField === `acc_${t.id}` ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setApprovingTx(t);
                                            setPayoutRefInput('');
                                        }} 
                                        disabled={processingId === t.id} 
                                        className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 hover:border-emerald-500 py-2.5 min-h-[44px] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                                    >
                                        <Check className="w-4 h-4 shrink-0" /> Approve Payout
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setRejectingTx(t);
                                            setSelectedRejectReason('Invalid account details provided');
                                            setCustomRejectReason('');
                                        }} 
                                        disabled={processingId === t.id} 
                                        className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 hover:border-red-500 py-2.5 min-h-[44px] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                                    >
                                        <X className="w-4 h-4 shrink-0" /> Reject & Refund
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setSelectedTx(t)} 
                                        className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500 py-2.5 min-h-[44px] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                                    >
                                        <Eye className="w-4 h-4 shrink-0" /> Review
                                    </button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full flex flex-col items-center justify-center text-slate-400 py-20">
                        <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4 border border-slate-800">
                            <Check className="text-3xl text-emerald-500/50" />
                        </div>
                        <p className="font-bold uppercase tracking-widest text-sm text-slate-400">All Caught Up!</p>
                        <p className="text-xs text-slate-600 mt-1">No pending withdrawal cashouts to process.</p>
                    </div>
                )}
            </div>

            {/* Approval Modal with Outgoing Payout Reference Tracking */}
            {approvingTx && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-3xl border border-slate-800 p-6 space-y-5 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400">
                                <Send className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase">Confirm Payout Transfer</h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Disbursing {formatCurrency(Math.abs(approvingTx.amount))} to {approvingTx.username}
                                </p>
                            </div>
                        </div>

                        <div className="bg-dark/50 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Channel:</span>
                                <span className="font-bold text-white">{approvingTx.method}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Account / Wallet:</span>
                                <span className="font-mono font-bold text-brand-300 select-all">{approvingTx.accountDetails}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Net Amount to Send:</span>
                                <span className="font-mono font-black text-emerald-400">{formatCurrency(Math.abs(approvingTx.amount))}</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1.5">
                                Bank / eSewa Payout Reference Code (Optional)
                            </label>
                            <input
                                type="text"
                                value={payoutRefInput}
                                onChange={(e) => setPayoutRefInput(e.target.value)}
                                placeholder="e.g. ESEWA_TX_8920194 or Bank UTR"
                                className="w-full bg-dark border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-emerald-500 focus-visible:outline-none font-mono"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                                Recording this reference embeds it in the transaction ledger for tax and dispute auditability.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setApprovingTx(null)}
                                disabled={processingId === approvingTx.id}
                                className="flex-1 py-2.5 bg-dark hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmApproval}
                                disabled={processingId === approvingTx.id}
                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition uppercase shadow-lg shadow-emerald-950/40"
                            >
                                {processingId === approvingTx.id ? 'Processing...' : 'Confirm & Mark Paid'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Modal with Reason Selection */}
            {rejectingTx && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-3xl border border-red-500/40 p-6 space-y-5 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-red-500/20 text-red-400">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase">Reject Cashout Request</h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Funds will be refunded to {rejectingTx.username}'s wallet
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1.5">
                                Select Rejection Reason
                            </label>
                            <select
                                value={selectedRejectReason}
                                onChange={(e) => setSelectedRejectReason(e.target.value)}
                                className="w-full bg-dark border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-red-500 focus-visible:outline-none mb-3"
                            >
                                <option value="Invalid account details provided">Invalid account details provided</option>
                                <option value="Account name does not match user profile KYC">Account name does not match user profile KYC</option>
                                <option value="Bank service currently offline - please try eSewa">Bank service currently offline - please try eSewa</option>
                                <option value="Match earnings under dispute verification">Match earnings under dispute verification</option>
                                <option value="other">Custom Reason (enter below)</option>
                            </select>

                            {selectedRejectReason === 'other' && (
                                <textarea
                                    value={customRejectReason}
                                    onChange={(e) => setCustomRejectReason(e.target.value)}
                                    placeholder="Enter specific reason for rejecting this cashout..."
                                    rows={3}
                                    className="w-full bg-dark border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-red-500 focus-visible:outline-none"
                                />
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setRejectingTx(null)}
                                disabled={processingId === rejectingTx.id}
                                className="flex-1 py-2.5 bg-dark hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmRejection}
                                disabled={processingId === rejectingTx.id}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition uppercase shadow-lg shadow-red-950/40"
                            >
                                {processingId === rejectingTx.id ? 'Processing...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default PendingWithdrawalsTab;
