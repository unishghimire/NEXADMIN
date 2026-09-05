import React, { useState, useRef, useEffect } from 'react';
import { useNotification } from '../../../shared/context/NotificationContext';
import { formatCurrency, formatDate } from '../../../shared/utils/utils';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import TournamentCreateModal from '../../tournaments/components/TournamentCreateModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import TransactionHistoryTab from '../components/TransactionHistoryTab';
import {
    Users,
    ArrowDown,
    ArrowUp,
    Layout,
    Check,
    X,
    Image as ImageIcon,
    CreditCard,
    QrCode,
    Megaphone,
    Newspaper,
    Trophy,
    Gamepad2,
    Tag,
    Sliders,
    DollarSign,
    ShieldAlert,
    ChevronDown,
    Search,
    Bell,
    Sparkles
} from 'lucide-react';
import {
    DashboardTab,
    TournamentsTab,
    OrgApprovalsTab,
    OrgTournamentsTab,
    UsersTab,
    OrganizersTab,
    OrgEarningsTab,
    PendingDepositsTab,
    PendingWithdrawalsTab,
    GamesTab,
    PaymentsTab,
    PromoTab,
    MediaTab,
    NewsTab,
    SettingsTab,
    DisputesTab
} from './admin-panel-tabs';
import DiscordAdminPanel from '../components/DiscordAdminPanel';
import { useAdminData } from '../hooks/useAdminData';
import TabErrorBoundary from '../../../shared/components/TabErrorBoundary';

interface AdminPageItem {
    id: string;
    label: string;
    description: string;
    group: string;
    icon: any;
    badge?: number;
    badgeColor?: string;
    quickPill?: boolean;
    pillLabel?: string;
}

// Admin Panel View - Main Management Hub (Reformed with Dropdown Page Navigation)
const AdminPanel: React.FC = () => {
    const { showToast } = useNotification();
    const {
        activeTab, adjustmentAmount, adjustmentType, allTournaments, allTransactions, closeConfirmModal, confirmModal, fetchOrgTournaments, getRelativeTime, handleAdjustBalance, handleApproveTx, handleRefundTx, handleRejectTx, handleUpdateUserRole, isSidebarOpen, isTournamentModalOpen, pendingDepositsCount, pendingOrgCount, pendingWithdrawalsCount, rejectionReason, selectedOrgId, selectedTournament, selectedTx, selectedUser, setActiveTab, setAdjustmentAmount, setAdjustmentType, setIsSidebarOpen, setIsTournamentModalOpen, setRejectionReason, setSelectedTournament, setSelectedTx, setSelectedUser, setTxFilterStatus, setTxFilterTournament, setTxFilterType, setTxSearchUser, tabProps, txFilterStatus, txFilterTournament, txFilterType, txSearchUser
    } = useAdminData(showToast);

    const [isNavOpen, setIsNavOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const pendingDisputesCount = tabProps.allDisputes?.filter((d: any) => (d.status || 'pending') === 'pending').length || 0;
    const totalUrgentAlerts = (pendingDepositsCount || 0) + (pendingWithdrawalsCount || 0) + (pendingOrgCount || 0) + pendingDisputesCount;

    // Handle outside clicks and ESC key for dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsNavOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsNavOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Complete catalog of admin management pages
    const adminPages: AdminPageItem[] = [
        // 1. Core & Overview
        {
            id: 'tab-dashboard',
            label: 'Dashboard',
            description: 'Platform metrics, revenue, active tournaments & stats',
            group: 'Core & Overview',
            icon: Layout,
            quickPill: true,
            pillLabel: 'Dashboard'
        },
        {
            id: 'tab-users',
            label: 'Manage Users',
            description: 'Player accounts, balance adjustment, and role assignments',
            group: 'Core & Overview',
            icon: Users,
            quickPill: true,
            pillLabel: 'Users'
        },
        {
            id: 'tab-settings',
            label: 'Settings & Commission',
            description: 'Platform cut %, withdrawal limits, notices, and host rules',
            group: 'Core & Overview',
            icon: Sliders,
            quickPill: true,
            pillLabel: 'Settings'
        },

        // 2. Financial Operations
        {
            id: 'tab-pending-deposits',
            label: 'Pending Deposits',
            description: 'Verify payment slips and credit user wallet balances',
            group: 'Financial Operations',
            icon: ArrowDown,
            badge: pendingDepositsCount,
            badgeColor: 'bg-emerald-500 text-white',
            quickPill: true,
            pillLabel: 'Deposits'
        },
        {
            id: 'tab-pending-withdrawals',
            label: 'Pending Withdrawals',
            description: 'Approve eSewa, Khalti & bank payout cashout requests',
            group: 'Financial Operations',
            icon: ArrowUp,
            badge: pendingWithdrawalsCount,
            badgeColor: 'bg-red-500 text-white',
            quickPill: true,
            pillLabel: 'Withdrawals'
        },
        {
            id: 'tab-tx-history',
            label: 'Transaction History',
            description: 'Complete audit logs of wallet credits, debits & commissions',
            group: 'Financial Operations',
            icon: CreditCard
        },

        // 3. Organization Hub
        {
            id: 'tab-org-approvals',
            label: 'Org Approvals',
            description: 'Review and verify host organizer applications',
            group: 'Organization Hub',
            icon: Check,
            badge: pendingOrgCount,
            badgeColor: 'bg-brand-500 text-white',
            quickPill: true,
            pillLabel: 'Org Approvals'
        },
        {
            id: 'tab-org-tournaments',
            label: 'Org Tournaments',
            description: 'Monitor organizer-hosted tournaments and scrims',
            group: 'Organization Hub',
            icon: Trophy
        },
        {
            id: 'tab-organizers',
            label: 'Manage Organizations',
            description: 'Verified organizers directory, bans & permissions',
            group: 'Organization Hub',
            icon: Users
        },
        {
            id: 'tab-org-earnings',
            label: 'Org Earnings & Release',
            description: 'Calculate platform commission cut & release payouts',
            group: 'Organization Hub',
            icon: DollarSign
        },

        // 4. Platform Management
        {
            id: 'tab-tournaments',
            label: 'Tournaments Hub',
            description: 'Create and oversee official platform tournaments',
            group: 'Platform Management',
            icon: Trophy,
            quickPill: true,
            pillLabel: 'Tournaments'
        },
        {
            id: 'tab-disputes',
            label: 'Disputes & Reports',
            description: 'Player protests, room claims, and fraud tickets',
            group: 'Platform Management',
            icon: ShieldAlert,
            badge: pendingDisputesCount,
            badgeColor: 'bg-amber-500 text-black',
            quickPill: true,
            pillLabel: 'Disputes'
        },
        {
            id: 'tab-games',
            label: 'Games Directory',
            description: 'Supported battle royales, MOBAs, and game formats',
            group: 'Platform Management',
            icon: Gamepad2
        },
        {
            id: 'tab-payments',
            label: 'Payment Methods',
            description: 'Configure deposit QR codes & official payment accounts',
            group: 'Platform Management',
            icon: QrCode
        },
        {
            id: 'tab-promo',
            label: 'Promo Codes',
            description: 'Discount codes, bonus cash, and referral vouchers',
            group: 'Platform Management',
            icon: Tag
        },
        {
            id: 'tab-media',
            label: 'Media Library',
            description: 'Manage homepage banners, sliders, and graphic assets',
            group: 'Platform Management',
            icon: ImageIcon
        },
        {
            id: 'tab-news',
            label: 'News & Announcements',
            description: 'Publish platform articles, guides, and notice banners',
            group: 'Platform Management',
            icon: Newspaper
        },

        // 5. System & Automation
        {
            id: 'tab-discord',
            label: 'Discord Automation',
            description: 'Discord bot webhooks, pings, and announcement links',
            group: 'System & Automation',
            icon: Megaphone
        }
    ];

    const activePage = adminPages.find(p => p.id === activeTab) || adminPages[0];
    const ActiveIcon = activePage.icon;

    const filteredPages = adminPages.filter(page => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            page.label.toLowerCase().includes(q) ||
            page.description.toLowerCase().includes(q) ||
            page.group.toLowerCase().includes(q)
        );
    });

    const pageGroups = Array.from(new Set(filteredPages.map(p => p.group)));
    const quickPills = adminPages.filter(p => p.quickPill);

    return (
        <div className="animate-fade-in max-w-7xl mx-auto space-y-6 relative">
            {/* Top Admin Command Bar with Dropdown Page Switcher & Quick Jumps */}
            <div className="bg-card/90 backdrop-blur-xl p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-800 shadow-2xl space-y-5">
                {/* Header Row: Title, Action Counter & Quick Settings */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
                    <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-brand-500/10 text-brand-400 rounded-2xl border border-brand-500/20">
                            <Sliders className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-2.5">
                                <span>NexPlay Admin Hub</span>
                                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider bg-brand-500/20 text-brand-400 border border-brand-500/30">
                                    Operations
                                </span>
                            </h1>
                            <p className="text-xs text-gray-400 font-medium mt-0.5">
                                Unified operations center for tournaments, finance, organizations, and platform controls.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        {totalUrgentAlerts > 0 && (
                            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-wider animate-pulse">
                                <Bell className="w-3.5 h-3.5" />
                                <span>{totalUrgentAlerts} Action{totalUrgentAlerts > 1 ? 's' : ''} Pending</span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setActiveTab('tab-settings')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer border shadow-lg ${
                                activeTab === 'tab-settings'
                                    ? 'bg-brand-500 text-white border-brand-400 shadow-brand-500/20'
                                    : 'bg-surface text-gray-300 border-gray-700 hover:border-brand-500/50 hover:text-white'
                            }`}
                        >
                            <Sliders className="w-3.5 h-3.5 text-brand-400" />
                            <span>Settings & Commission</span>
                        </button>
                    </div>
                </div>

                {/* Dropdown Page Switcher (Mobile & Desktop Friendly) */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setIsNavOpen(prev => !prev)}
                        className="w-full flex items-center justify-between bg-dark/95 hover:bg-dark border border-gray-700 hover:border-brand-500/60 p-4 sm:p-5 rounded-2xl sm:rounded-3xl transition cursor-pointer shadow-xl group text-left"
                    >
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="p-3 bg-brand-500/15 text-brand-400 border border-brand-500/30 rounded-2xl shrink-0 group-hover:scale-105 transition">
                                <ActiveIcon className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="text-white font-black text-base sm:text-lg tracking-tight">
                                        {activePage.label}
                                    </span>
                                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider bg-surface text-gray-400 border border-gray-700">
                                        {activePage.group}
                                    </span>
                                    {activePage.badge && activePage.badge > 0 ? (
                                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider animate-pulse ${activePage.badgeColor || 'bg-red-500 text-white'}`}>
                                            {activePage.badge} Pending
                                        </span>
                                    ) : null}
                                </div>
                                <p className="text-xs text-gray-400 font-medium truncate mt-1">
                                    {activePage.description}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pl-3 shrink-0">
                            <div className="hidden sm:flex flex-col items-end">
                                <span className="text-xs font-black text-brand-400 uppercase tracking-wider">Switch Page</span>
                                <span className="text-[10px] text-gray-500 font-medium">Click to browse all</span>
                            </div>
                            <div className="p-2 rounded-xl bg-surface border border-gray-700 group-hover:border-brand-500/40 transition">
                                <ChevronDown className={`w-5 h-5 text-gray-300 transition-transform duration-200 ${isNavOpen ? 'rotate-180 text-brand-400' : ''}`} />
                            </div>
                        </div>
                    </button>

                    {/* Popover Dropdown Menu */}
                    {isNavOpen && (
                        <div className="absolute top-full left-0 right-0 mt-3 z-50 bg-card/98 border border-gray-700/90 rounded-2xl sm:rounded-3xl shadow-2xl backdrop-blur-2xl overflow-hidden p-4 sm:p-6 space-y-5 animate-fade-in max-h-[80vh] overflow-y-auto custom-scrollbar">
                            {/* Search Filter Input */}
                            <div className="relative">
                                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search admin pages (e.g. deposits, commission, tournaments, users)..."
                                    className="w-full bg-surface border border-gray-700 rounded-xl pl-10 pr-16 py-3 text-xs text-white placeholder-gray-500 focus:border-brand-500 focus-visible:outline-none transition"
                                    autoFocus
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-bold px-2 py-1 bg-dark/80 rounded-md"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {/* Grouped Pages Grid */}
                            <div className="space-y-5">
                                {pageGroups.length === 0 ? (
                                    <div className="text-center py-8 text-xs text-gray-500">
                                        No admin pages match "{searchQuery}".
                                    </div>
                                ) : (
                                    pageGroups.map(groupName => {
                                        const groupPages = filteredPages.filter(p => p.group === groupName);
                                        return (
                                            <div key={groupName} className="space-y-2.5">
                                                <div className="text-[11px] font-black text-gray-500 uppercase tracking-[0.18em] px-1 flex items-center justify-between">
                                                    <span>{groupName}</span>
                                                    <span className="text-[10px] text-gray-600 font-mono">{groupPages.length} pages</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5">
                                                    {groupPages.map(page => {
                                                        const PageIcon = page.icon;
                                                        const isCurrent = activeTab === page.id;
                                                        return (
                                                            <button
                                                                key={page.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setActiveTab(page.id);
                                                                    setIsNavOpen(false);
                                                                    setSearchQuery('');
                                                                }}
                                                                className={`flex items-center justify-between p-3.5 rounded-2xl transition text-left cursor-pointer border ${
                                                                    isCurrent
                                                                        ? 'bg-brand-500/15 border-brand-500/50 text-white shadow-lg shadow-brand-500/10'
                                                                        : 'bg-surface/50 hover:bg-surface border-gray-800 hover:border-gray-700 text-gray-300'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className={`p-2.5 rounded-xl border shrink-0 ${
                                                                        isCurrent
                                                                            ? 'bg-brand-500 text-white border-brand-400'
                                                                            : 'bg-dark text-gray-400 border-gray-700'
                                                                    }`}>
                                                                        <PageIcon className="w-4 h-4" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-xs sm:text-sm tracking-tight ${isCurrent ? 'font-black text-brand-400' : 'font-bold text-white'}`}>
                                                                                {page.label}
                                                                            </span>
                                                                            {page.badge && page.badge > 0 ? (
                                                                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${page.badgeColor || 'bg-red-500 text-white'}`}>
                                                                                    {page.badge}
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                        <p className="text-[11px] text-gray-400 font-medium truncate mt-0.5">
                                                                            {page.description}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                {isCurrent && (
                                                                    <div className="w-2 h-2 rounded-full bg-brand-400 shrink-0 ml-2 shadow-sm shadow-brand-400" />
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick 1-Click Navigation Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar pt-1">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest shrink-0 pr-1 hidden sm:inline">
                        Quick Jump:
                    </span>
                    {quickPills.map(page => {
                        const Icon = page.icon;
                        const isCurrent = activeTab === page.id;
                        return (
                            <button
                                key={page.id}
                                type="button"
                                onClick={() => setActiveTab(page.id)}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition cursor-pointer shrink-0 border ${
                                    isCurrent
                                        ? 'bg-brand-500 text-white border-brand-400 shadow-md shadow-brand-500/20'
                                        : 'bg-dark/70 text-gray-400 border-gray-800 hover:border-gray-700 hover:text-white'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{page.pillLabel || page.label}</span>
                                {page.badge && page.badge > 0 ? (
                                    <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                                        {page.badge}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area (Full Width Canvas) */}
            <div className="bg-dark/50 rounded-2xl sm:rounded-[2rem] border border-gray-800 p-4 sm:p-6 lg:p-8 min-h-[600px] w-full overflow-hidden shadow-xl">
                {activeTab === 'tab-dashboard' && <TabErrorBoundary tabName="Dashboard Tab"><DashboardTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-tournaments' && <TabErrorBoundary tabName="Tournaments Tab"><TournamentsTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-org-approvals' && <TabErrorBoundary tabName="Org Approvals Tab"><OrgApprovalsTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-org-tournaments' && <TabErrorBoundary tabName="Org Tournaments Tab"><OrgTournamentsTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-users' && <TabErrorBoundary tabName="Users Tab"><UsersTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-organizers' && <TabErrorBoundary tabName="Organizers Tab"><OrganizersTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-org-earnings' && <TabErrorBoundary tabName="Org Earnings Tab"><OrgEarningsTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-pending-deposits' && <TabErrorBoundary tabName="Pending Deposits Tab"><PendingDepositsTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-pending-withdrawals' && <TabErrorBoundary tabName="Pending Withdrawals Tab"><PendingWithdrawalsTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-tx-history' && (
                    <TabErrorBoundary tabName="Transaction History Tab">
                        <TransactionHistoryTab 
                            allTransactions={allTransactions}
                            allTournaments={allTournaments}
                            setSelectedTx={setSelectedTx}
                            formatDate={formatDate}
                            getRelativeTime={getRelativeTime}
                            formatCurrency={formatCurrency}
                            txFilterType={txFilterType}
                            setTxFilterType={setTxFilterType}
                            txFilterStatus={txFilterStatus}
                            setTxFilterStatus={setTxFilterStatus}
                            txFilterTournament={txFilterTournament}
                            setTxFilterTournament={setTxFilterTournament}
                            txSearchUser={txSearchUser}
                            setTxSearchUser={setTxSearchUser}
                        />
                    </TabErrorBoundary>
                )}
                {activeTab === 'tab-disputes' && <TabErrorBoundary tabName="Disputes Tab"><DisputesTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-games' && <TabErrorBoundary tabName="Games Tab"><GamesTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-payments' && <TabErrorBoundary tabName="Payments Tab"><PaymentsTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-promo' && <TabErrorBoundary tabName="Promo Codes Tab"><PromoTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-media' && <TabErrorBoundary tabName="Media Library Tab"><MediaTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-news' && <TabErrorBoundary tabName="News Tab"><NewsTab {...tabProps} /></TabErrorBoundary>}
                {activeTab === 'tab-settings' && <TabErrorBoundary tabName="Settings Tab"><SettingsTab {...tabProps} /></TabErrorBoundary>}

                {activeTab === 'tab-discord' && (
                    <TabErrorBoundary tabName="Discord Tab">
                        <DiscordAdminPanel allTournaments={allTournaments} showToast={showToast} />
                    </TabErrorBoundary>
                )}
            </div>

            {/* Tournament Edit Modal */}
            <TournamentCreateModal 
                isOpen={isTournamentModalOpen}
                onClose={() => {
                    setIsTournamentModalOpen(false);
                    setSelectedTournament(null);
                }}
                onSuccess={() => {
                    // Refresh tournaments
                    if (selectedOrgId) fetchOrgTournaments(selectedOrgId);
                }}
                editTournament={selectedTournament}
            />

            {selectedUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-2xl border border-gray-800 p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-bold text-white uppercase tracking-widest">Manage User</h3>
                            <button type="button" aria-label="Close user modal" onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-white bg-dark min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="bg-dark p-4 rounded-xl border border-gray-800">
                            <div className="text-white font-bold">{selectedUser.username}</div>
                            <div className="text-sm text-gray-400">{selectedUser.email}</div>
                            <div className="text-sm text-brand-400 mt-2 font-mono">Current Balance: {formatCurrency(selectedUser.balance)}</div>
                        </div>

                        <div className="space-y-4">
                            <label htmlFor="adjust-balance" className="text-xs text-gray-500 uppercase font-bold block">Adjust Balance</label>
                            <div className="flex gap-2">
                                <button type="button" 
                                    onClick={() => setAdjustmentType('add')}
                                    className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase border ${adjustmentType === 'add' ? 'bg-green-600 border-green-500 text-white' : 'bg-dark border-gray-700 text-gray-500'}`}
                                >
                                    Add
                                </button>
                                <button type="button" 
                                    onClick={() => setAdjustmentType('subtract')}
                                    className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase border ${adjustmentType === 'subtract' ? 'bg-red-600 border-red-500 text-white' : 'bg-dark border-gray-700 text-gray-500'}`}
                                >
                                    Subtract
                                </button>
                            </div>
                            <input 
                                type="number" 
                                value={adjustmentAmount}
                                onChange={(e) => setAdjustmentAmount(e.target.value)}
                                placeholder="Enter amount..."
                                className="w-full bg-dark border border-gray-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none"
                            />
                            <button type="button" onClick={handleAdjustBalance} className="w-full bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition uppercase text-sm">
                                Confirm Adjustment
                            </button>
                        </div>

                        <div className="space-y-4 border-t border-gray-800 pt-6">
                            <label htmlFor="update-role" className="text-xs text-gray-500 uppercase font-bold block">Update Role</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {(['player', 'organizer', 'admin'] as const).map(role => (
                                    <button type="button" 
                                        key={role}
                                        onClick={() => handleUpdateUserRole(selectedUser.uid, role)}
                                        className={`py-2 rounded-lg font-bold text-xs uppercase border transition-colors ${selectedUser.role === role ? 'bg-brand-600 border-brand-500 text-white' : 'bg-dark border-gray-700 text-gray-500 hover:border-gray-600'}`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedTx && (
                <TransactionDetailModal 
                    selectedTx={selectedTx}
                    onClose={() => setSelectedTx(null)}
                    onDashboard={() => { setSelectedTx(null); setActiveTab('tab-dashboard'); }}
                    onApprove={handleApproveTx}
                    onReject={handleRejectTx}
                    onRefund={handleRefundTx}
                    rejectionReason={rejectionReason}
                    setRejectionReason={setRejectionReason}
                    getRelativeTime={getRelativeTime}
                />
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirmModal}
                isDestructive={confirmModal.isDestructive}
            />
        </div>
    );
};
export default AdminPanel;
