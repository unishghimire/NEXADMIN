import { sanitizeUrl } from '../../../../shared/utils/utils';
import React, { useState, useMemo } from 'react';
import { 
    ArrowDown, 
    Check, 
    Eye, 
    X, 
    AlertTriangle, 
    Copy, 
    CheckCheck, 
    ZoomIn, 
    ZoomOut, 
    RotateCw, 
    ShieldAlert, 
    User, 
    Wallet,
    ExternalLink
} from 'lucide-react';
import { AdminPanelTabProps } from './types';
import { Transaction, UserProfile } from '../../../../shared/types/types';

interface DuplicateCollision {
    matchedTx: Transaction;
    field: 'code' | 'ref' | 'proof';
    isAlreadyCredited: boolean;
}

export const PendingDepositsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { 
        allTransactions = [], 
        users = [],
        closeConfirmModal, 
        formatCurrency, 
        formatCurrencyExact,
        formatDate,
        getRelativeTime, 
        handleApproveTx, 
        handleRejectTx, 
        setConfirmModal, 
        setSelectedTx 
    } = props;

    const [processingId, setProcessingId] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [overrideTxId, setOverrideTxId] = useState<string | null>(null);
    
    // Lightbox modal state
    const [activeScreenshot, setActiveScreenshot] = useState<string | null>(null);
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [rotation, setRotation] = useState<number>(0);

    const pendingDeposits = (allTransactions as Transaction[]).filter(
        t => t.type === 'deposit' && t.status === 'pending'
    );

    // Map user profile lookup
    const userMap = useMemo(() => {
        const map = new Map<string, UserProfile>();
        (users as UserProfile[]).forEach(u => {
            if (u.uid) map.set(u.uid, u);
        });
        return map;
    }, [users]);

    // Anti-Fraud & Duplicate Reference Detection Engine
    const duplicateMap = useMemo(() => {
        const map = new Map<string, DuplicateCollision>();
        const allTxs = allTransactions as Transaction[];

        pendingDeposits.forEach(pending => {
            const cleanCode = pending.transactionCode?.trim().toLowerCase();
            const cleanRef = pending.refId?.trim().toLowerCase();
            const cleanProof = pending.proofUrl?.trim();

            for (const other of allTxs) {
                if (other.id === pending.id) continue;

                // Check 1: Duplicate Transaction Code
                if (cleanCode && other.transactionCode && other.transactionCode.trim().toLowerCase() === cleanCode) {
                    map.set(pending.id, {
                        matchedTx: other,
                        field: 'code',
                        isAlreadyCredited: other.status === 'success' || other.status === 'completed'
                    });
                    break;
                }

                // Check 2: Duplicate External Reference ID
                if (cleanRef && other.refId && other.refId.trim().toLowerCase() === cleanRef) {
                    map.set(pending.id, {
                        matchedTx: other,
                        field: 'ref',
                        isAlreadyCredited: other.status === 'success' || other.status === 'completed'
                    });
                    break;
                }

                // Check 3: Duplicate Receipt Screenshot URL
                if (cleanProof && other.proofUrl && other.proofUrl.trim() === cleanProof) {
                    map.set(pending.id, {
                        matchedTx: other,
                        field: 'proof',
                        isAlreadyCredited: other.status === 'success' || other.status === 'completed'
                    });
                    break;
                }
            }
        });

        return map;
    }, [pendingDeposits, allTransactions]);

    const flaggedDuplicateCount = useMemo(() => {
        let count = 0;
        pendingDeposits.forEach(t => {
            if (duplicateMap.has(t.id)) count += 1;
        });
        return count;
    }, [pendingDeposits, duplicateMap]);

    const handleCopy = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(label);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const openScreenshotLightbox = (url: string) => {
        setActiveScreenshot(url);
        setZoomLevel(1);
        setRotation(0);
    };

    const handleSafeApprove = async (tx: Transaction) => {
        const collision = duplicateMap.get(tx.id);
        if (collision && overrideTxId !== tx.id) {
            setConfirmModal({
                isOpen: true,
                title: 'WARNING: Potential Duplicate Transaction',
                message: `This transaction matches existing ${collision.field === 'code' ? 'TX CODE' : collision.field === 'ref' ? 'REFERENCE' : 'SCREENSHOT'} from ${collision.matchedTx.username || 'another user'} (Amount: ${formatCurrency(collision.matchedTx.amount)} on ${formatDate ? formatDate(collision.matchedTx.timestamp) : 'prior date'}). Are you ABSOLUTELY sure this is legitimate and verified in your banking portal?`,
                isDestructive: true,
                onConfirm: async () => {
                    closeConfirmModal();
                    setOverrideTxId(tx.id);
                    setProcessingId(tx.id);
                    try {
                        await handleApproveTx(tx);
                    } finally {
                        setProcessingId(null);
                    }
                }
            });
            return;
        }

        setProcessingId(tx.id);
        try {
            await handleApproveTx(tx);
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="bg-card p-6 rounded-3xl border border-slate-800 space-y-6">
            {/* Header with Anti-Fraud Summary */}
            <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center gap-4 flex-wrap">
                    <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <ArrowDown className="text-emerald-400" /> Pending Deposit Slips
                    </h2>
                    <span className="bg-emerald-500/20 text-emerald-400 text-xs font-black px-3 py-1 rounded-full border border-emerald-500/30">
                        {pendingDeposits.length} Pending
                    </span>
                    {flaggedDuplicateCount > 0 && (
                        <span className="bg-red-500/20 text-red-400 text-xs font-black px-3 py-1 rounded-full border border-red-500/30 flex items-center gap-1.5 animate-pulse">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            {flaggedDuplicateCount} Potential Duplicate{flaggedDuplicateCount > 1 ? 's' : ''} Detected
                        </span>
                    )}
                </div>

                {pendingDeposits.length > 0 && (
                    <div className="flex items-center gap-3">
                        <button 
                            type="button" 
                            onClick={() => {
                                setConfirmModal({
                                    isOpen: true,
                                    title: 'Bulk Reject Deposits',
                                    message: 'Are you sure you want to REJECT ALL pending deposits?',
                                    isDestructive: true,
                                    onConfirm: async () => {
                                        for (const t of pendingDeposits) {
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
                        
                        <button 
                            type="button" 
                            onClick={() => {
                                // Auto-filter out duplicates during bulk approve
                                const safeToApprove = pendingDeposits.filter(t => !duplicateMap.has(t.id));
                                const hasDuplicates = pendingDeposits.some(t => duplicateMap.has(t.id));

                                setConfirmModal({
                                    isOpen: true,
                                    title: 'Bulk Approve Clean Deposits',
                                    message: hasDuplicates 
                                        ? `There are ${flaggedDuplicateCount} flagged duplicate slip(s). Bulk approval will ONLY approve ${safeToApprove.length} safe verified deposit(s) to protect from double-crediting. Proceed?`
                                        : `Are you sure you want to approve all ${pendingDeposits.length} pending deposits?`,
                                    onConfirm: async () => {
                                        for (const t of safeToApprove) {
                                            setProcessingId(t.id);
                                            try {
                                                await handleApproveTx(t);
                                            } finally {
                                                setProcessingId(null);
                                            }
                                        }
                                        closeConfirmModal();
                                    }
                                });
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-950/40"
                        >
                            Bulk Approve Safe Slips
                        </button>
                    </div>
                )}
            </div>

            {/* Deposits Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[680px] overflow-y-auto custom-scrollbar pr-1">
                {pendingDeposits.length > 0 ? (
                    pendingDeposits.map(t => {
                        const collision = duplicateMap.get(t.id);
                        const userProfile = userMap.get(t.userId);
                        const isFlagged = Boolean(collision);

                        return (
                            <div 
                                key={t.id} 
                                className={`p-5 rounded-2xl border transition-all shadow-md group flex flex-col justify-between ${
                                    isFlagged 
                                        ? 'bg-red-950/20 border-red-500/50 hover:border-red-500' 
                                        : 'bg-dark/60 hover:bg-dark border-slate-800 hover:border-slate-700'
                                }`}
                            >
                                <div>
                                    {/* Duplicate Alert Banner */}
                                    {isFlagged && collision && (
                                        <div className="mb-4 p-3 bg-red-900/40 border border-red-500/40 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
                                            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                            <div>
                                                <div className="font-black uppercase tracking-wider text-red-200">
                                                    COLLISION DETECTED: DUPLICATE {collision.field.toUpperCase()}
                                                </div>
                                                <p className="text-[11px] text-red-300/90 mt-0.5 leading-relaxed">
                                                    Matched with TX #{collision.matchedTx.id.slice(0, 8)} for @{collision.matchedTx.username || 'user'} ({(formatCurrencyExact || formatCurrency)(collision.matchedTx.amount)} on {formatDate ? formatDate(collision.matchedTx.timestamp) : 'prior date'}).
                                                    {collision.isAlreadyCredited && <span className="font-bold text-red-100 ml-1">ALREADY CREDITED!</span>}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Top Row: User & Amount */}
                                    <div className="flex justify-between items-start mb-3 border-b border-slate-800 pb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-black tracking-wider text-emerald-400 uppercase text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                    Deposit
                                                </span>
                                                <span className="text-[10px] bg-surface px-2 py-0.5 rounded-full text-slate-300 font-bold tracking-wider">
                                                    {t.method}
                                                </span>
                                            </div>
                                            <div className="text-white font-bold text-sm flex items-center gap-1.5">
                                                <span>{t.username || userProfile?.username || 'Player'}</span>
                                                {userProfile && (
                                                    <span className="text-[10px] font-normal text-slate-400 font-mono">
                                                        (Bal: {(formatCurrencyExact || formatCurrency)(userProfile.balance)})
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono">{getRelativeTime(t.timestamp)}</div>
                                        </div>
                                        <div className="text-xl font-black text-emerald-400 tracking-tight font-mono">
                                            +{(formatCurrencyExact || formatCurrency)(Math.abs(t.amount))}
                                        </div>
                                    </div>

                                    {/* Middle Row: Codes & Copy Buttons */}
                                    <div className="text-[11px] text-slate-400 mb-3 space-y-2">
                                        <div className="bg-dark/40 p-2 rounded-xl border border-slate-800/80 font-mono flex justify-between items-center">
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

                                        {t.transactionCode && (
                                            <div className={`p-2 rounded-xl font-mono flex justify-between items-center border ${
                                                isFlagged && collision?.field === 'code' 
                                                    ? 'bg-red-950/40 border-red-500/40 text-red-200' 
                                                    : 'bg-dark/40 border-slate-800/80 text-slate-300'
                                            }`}>
                                                <span className="text-slate-500 text-[10px]">TX / UTR CODE:</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold select-all break-all">{t.transactionCode}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(t.transactionCode || '', `code_${t.id}`)}
                                                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700/50 transition"
                                                        title="Copy Tx Code"
                                                    >
                                                        {copiedField === `code_${t.id}` ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {t.accountDetails && (
                                            <div className="bg-dark/40 p-2 rounded-xl border border-slate-800/80 font-mono flex justify-between items-center">
                                                <span className="text-slate-500 text-[10px]">SENDER PHONE / ACC:</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-slate-200 select-all break-all">{t.accountDetails}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(t.accountDetails || '', `acc_${t.id}`)}
                                                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700/50 transition"
                                                        title="Copy Sender Phone"
                                                    >
                                                        {copiedField === `acc_${t.id}` ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Payment Screenshot Thumbnail & Inspector Button */}
                                    {t.proofUrl && (
                                        <div className="mb-3">
                                            <div 
                                                onClick={() => openScreenshotLightbox(t.proofUrl || '')}
                                                className="cursor-pointer group/img relative rounded-xl overflow-hidden border border-slate-800 hover:border-brand-500 transition"
                                            >
                                                <img 
                                                    src={t.proofUrl} 
                                                    alt="Payment proof" 
                                                    className="w-full max-h-40 object-contain bg-black/60 rounded-lg" 
                                                    referrerPolicy="no-referrer" 
                                                    onError={(e) => { e.currentTarget.style.display = "none"; }} 
                                                    loading="lazy" 
                                                />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center gap-2">
                                                    <span className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 bg-dark/80 px-3 py-1.5 rounded-lg border border-slate-700">
                                                        <ZoomIn className="w-3.5 h-3.5 text-brand-400" /> Inspect Stamp & Reference
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
                                    <button 
                                        type="button" 
                                        onClick={() => handleSafeApprove(t)} 
                                        disabled={processingId === t.id} 
                                        className={`py-2.5 min-h-[44px] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${
                                            isFlagged 
                                                ? 'bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40' 
                                                : 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 hover:border-emerald-500'
                                        }`}
                                    >
                                        <Check className="w-4 h-4 shrink-0" />
                                        <span>{isFlagged ? 'Override & Approve' : 'Approve'}</span>
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => handleRejectTx && handleRejectTx(t, isFlagged ? 'Duplicate reference code detected' : undefined)} 
                                        disabled={processingId === t.id} 
                                        className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 hover:border-red-500 py-2.5 min-h-[44px] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                                    >
                                        <X className="w-4 h-4 shrink-0" /> Reject
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
                        <p className="text-xs text-slate-600 mt-1">No pending deposits requiring verification.</p>
                    </div>
                )}
            </div>

            {/* Screenshot Lightbox Modal with Zoom / Pan Tools */}
            {activeScreenshot && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[120] flex flex-col items-center justify-center p-4">
                    <div className="absolute top-4 right-4 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setZoomLevel(prev => Math.min(prev + 0.3, 3))}
                            className="p-2.5 bg-dark border border-slate-700 hover:border-slate-500 rounded-xl text-white transition"
                            title="Zoom In"
                        >
                            <ZoomIn className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setZoomLevel(prev => Math.max(prev - 0.3, 0.5))}
                            className="p-2.5 bg-dark border border-slate-700 hover:border-slate-500 rounded-xl text-white transition"
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setRotation(prev => (prev + 90) % 360)}
                            className="p-2.5 bg-dark border border-slate-700 hover:border-slate-500 rounded-xl text-white transition"
                            title="Rotate"
                        >
                            <RotateCw className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveScreenshot(null)}
                            className="p-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-white transition"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="max-w-4xl max-h-[85vh] overflow-hidden flex items-center justify-center">
                        <img
                            src={activeScreenshot}
                            alt="Payment Slip Proof"
                            style={{
                                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                                transition: 'transform 0.2s ease-out'
                            }}
                            className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl"
                            referrerPolicy="no-referrer"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
export default PendingDepositsTab;
