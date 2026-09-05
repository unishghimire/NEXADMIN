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

type AdminDepartmentId = 'overview' | 'finance' | 'organizers' | 'content' | 'system';

interface AdminDepartment {
    id: AdminDepartmentId;
    label: string;
    icon: any;
    defaultTab: string;
    description: string;
}

interface AdminPageItem {
    id: string;
    label: string;
    shortLabel: string;
    description: string;
    department: AdminDepartmentId;
    icon: any;
    badge?: number;
    badgeColor?: string;
    isUrgent?: boolean;
}

// 5 Core Operational Departments
const DEPARTMENTS: AdminDepartment[] = [
    {
        id: 'overview',
        label: 'Overview & Users',
        icon: Layout,
        defaultTab: 'tab-dashboard',
        description: 'Key metrics, live tournaments, and user accounts'
    },
    {
        id: 'finance',
        label: 'Financial Ops',
        icon: DollarSign,
        defaultTab: 'tab-pending-deposits',
        description: 'Deposit slips, cashouts, withdrawal limits & audit logs'
    },
    {
        id: 'organizers',
        label: 'Organizer Hub',
        icon: Users,
        defaultTab: 'tab-org-approvals',
        description: 'Host verification, community scrims & earnings releases'
    },
    {
        id: 'content',
        label: 'Tournaments & Content',
        icon: Trophy,
        defaultTab: 'tab-tournaments',
        description: 'Official brackets, disputes, games directory & promo vouchers'
    },
    {
        id: 'system',
        label: 'System & Config',
        icon: Sliders,
        defaultTab: 'tab-settings',
        description: 'Platform commission %, maintenance mode & Discord webhooks'
    }
];

// Admin Panel View - Main Management Hub (Reformed with Crystal Clear Department & Dropdown Navigation)
const AdminPanel: React.FC = () => {
    const { showToast } = useNotification();
    const {
        activeTab, adjustmentAmount, adjustmentType, allTournaments, allTransactions, closeConfirmModal, confirmModal, fetchOrgTournaments, getRelativeTime, handleAdjustBalance, handleApproveTx, handleRefundTx, handleRejectTx, handleUpdateUserRole, isTournamentModalOpen, pendingDepositsCount, pendingOrgCount, pendingWithdrawalsCount, rejectionReason, selectedOrgId, selectedTournament, selectedTx, selectedUser, setActiveTab, setAdjustmentAmount, setAdjustmentType, setIsTournamentModalOpen, setRejectionReason, setSelectedTournament, setSelectedTx, setSelectedUser, setTxFilterStatus, setTxFilterTournament, setTxFilterType, setTxSearchUser, tabProps, txFilterStatus, txFilterTournament, txFilterType, txSearchUser
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
        // 1. Overview & Users
        {
            id: 'tab-dashboard',
            label: 'Platform Dashboard',
            shortLabel: 'Dashboard',
            description: 'Live platform KPIs, revenue analytics, active scrims & summary',
            department: 'overview',
            icon: Layout
        },
        {
            id: 'tab-users',
            label: 'User Management',
            shortLabel: 'Users',
            description: 'Player profiles, manual balance adjustment & admin role assignments',
            department: 'overview',
            icon: Users
        },

        // 2. Financial Operations
        {
            id: 'tab-pending-deposits',
            label: 'Pending Deposits',
            shortLabel: 'Deposits',
            description: 'Verify payment slips and credit player wallet balances',
            department: 'finance',
            icon: ArrowDown,
            badge: pendingDepositsCount,
            badgeColor: 'bg-emerald-500 text-white',
            isUrgent: pendingDepositsCount > 0
        },
        {
            id: 'tab-pending-withdrawals',
            label: 'Pending Withdrawals',
            shortLabel: 'Withdrawals',
            description: 'Process player cashouts to eSewa, Khalti & Bank accounts',
            department: 'finance',
            icon: ArrowUp,
            badge: pendingWithdrawalsCount,
            badgeColor: 'bg-red-500 text-white',
            isUrgent: pendingWithdrawalsCount > 0
        },
        {
            id: 'tab-tx-history',
            label: 'Transaction History',
            shortLabel: 'Transactions',
            description: 'Complete audit log of wallet credits, debits & fee deductions',
            department: 'finance',
            icon: CreditCard
        },

        // 3. Organization Hub
        {
            id: 'tab-org-approvals',
            label: 'Host Applications',
            shortLabel: 'Org Approvals',
            description: 'Review and approve prospective tournament host applications',
            department: 'organizers',
            icon: Check,
            badge: pendingOrgCount,
            badgeColor: 'bg-brand-500 text-white',
            isUrgent: pendingOrgCount > 0
        },
        {
            id: 'tab-org-tournaments',
            label: 'Organizer Matches',
            shortLabel: 'Org Tournaments',
            description: 'Supervise tournaments and scrims hosted by community organizers',
            department: 'organizers',
            icon: Trophy
        },
        {
            id: 'tab-organizers',
            label: 'Manage Organizations',
            shortLabel: 'Host Directory',
            description: 'Verified hosts directory, permission toggles & suspensions',
            department: 'organizers',
            icon: Users
        },
        {
            id: 'tab-org-earnings',
            label: 'Earnings & Releases',
            shortLabel: 'Payout Releases',
            description: 'Calculate platform commission cut and release net earnings to hosts',
            department: 'organizers',
            icon: DollarSign
        },

        // 4. Tournaments & Content
        {
            id: 'tab-tournaments',
            label: 'Official Tournaments',
            shortLabel: 'Tournaments',
            description: 'Create and oversee official platform tournaments and brackets',
            department: 'content',
            icon: Trophy
        },
        {
            id: 'tab-disputes',
            label: 'Disputes & Reports',
            shortLabel: 'Disputes',
            description: 'Resolve player room claims, score protests & fraud tickets',
            department: 'content',
            icon: ShieldAlert,
            badge: pendingDisputesCount,
            badgeColor: 'bg-amber-500 text-black',
            isUrgent: pendingDisputesCount > 0
        },
        {
            id: 'tab-games',
            label: 'Supported Games',
            shortLabel: 'Games',
            description: 'Battle royales, team shooters, and competition game formats',
            department: 'content',
            icon: Gamepad2
        },
        {
            id: 'tab-payments',
            label: 'Payment Gateways',
            shortLabel: 'Payment QR',
            description: 'Configure official deposit QR codes and receiving account numbers',
            department: 'content',
            icon: QrCode
        },
        {
            id: 'tab-promo',
            label: 'Promo Codes',
            shortLabel: 'Promo Codes',
            description: 'Discount codes, player cash rewards and referral vouchers',
            department: 'content',
            icon: Tag
        },
        {
            id: 'tab-media',
            label: 'Media Assets',
            shortLabel: 'Media Library',
            description: 'Manage homepage banner sliders, graphic assets and logos',
            department: 'content',
            icon: ImageIcon
        },
        {
            id: 'tab-news',
            label: 'News & Bulletins',
            shortLabel: 'News',
            description: 'Publish platform patch notes, announcements & community articles',
            department: 'content',
            icon: Newspaper
        },

        // 5. System & Config
        {
            id: 'tab-settings',
            label: 'Settings & Commission',
            shortLabel: 'Platform Settings',
            description: 'Platform fee %, withdrawal rules, maintenance mode & host guidelines',
            department: 'system',
            icon: Sliders
        },
        {
            id: 'tab-discord',
            label: 'Discord Automation',
            shortLabel: 'Discord Webhooks',
            description: 'Real-time Discord bot webhooks, pings & announcement links',
            department: 'system',
            icon: Megaphone
        }
    ];

    // Identify current page and current department
    const activePage = adminPages.find(p => p.id === activeTab) || adminPages[0];
    const ActiveIcon = activePage.icon;
    const currentDepartment = activePage.department;
    const activeDeptData = DEPARTMENTS.find(d => d.id === currentDepartment) || DEPARTMENTS[0];

    // Sub-pages in the current department
    const currentDeptPages = adminPages.filter(p => p.department === currentDepartment);

    // Calculate department badges
    const getDeptBadge = (deptId: AdminDepartmentId) => {
        switch (deptId) {
            case 'finance': return (pendingDepositsCount || 0) + (pendingWithdrawalsCount || 0);
            case 'organizers': return pendingOrgCount || 0;
            case 'content': return pendingDisputesCount || 0;
            default: return 0;
        }
    };

    // Filter pages for the All Pages search directory
    const filteredPages = adminPages.filter(page => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            page.label.toLowerCase().includes(q) ||
            page.shortLabel.toLowerCase().includes(q) ||
            page.description.toLowerCase().includes(q) ||
            page.department.toLowerCase().includes(q)
        );
    });

    return (
        <div className="animate-fade-in max-w-7xl mx-auto space-y-6 relative">
            {/* Top Navigation & Department Command Bar */}
            <div className="bg-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-800 shadow-xl space-y-4 sm:space-y-5">
                {/* Level 1: Breadcrumb + Urgent Action Alerts + All Pages Directory */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
                    <div className="flex items-center gap-2.5 text-xs text-gray-400 font-bold uppercase tracking-wider flex-wrap">
                        <span className="text-brand-400 font-black flex items-center gap-1.5">
                            <Sliders className="w-4 h-4" />
                            NexPlay Admin
                        </span>
                        <span className="text-gray-600">/</span>
                        <span className="text-gray-300">{activeDeptData.label}</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-white font-black">{activePage.shortLabel}</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {totalUrgentAlerts > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-wider animate-pulse">
                                <Bell className="w-3.5 h-3.5" />
                                <span>{totalUrgentAlerts} Pending Action{totalUrgentAlerts > 1 ? 's' : ''}</span>
                            </div>
                        )}

                        {/* Searchable All Pages Directory Dropdown Trigger */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsNavOpen(prev => !prev)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer border ${
                                    isNavOpen
                                        ? 'bg-brand-500 text-white border-brand-400 shadow-md shadow-brand-500/25'
                                        : 'bg-surface hover:bg-gray-800 text-gray-200 border-gray-700 hover:border-gray-600'
                                }`}
                            >
                                <Search className="w-3.5 h-3.5 text-brand-400" />
                                <span>All Pages ({adminPages.length})</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isNavOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* All Pages Popover Search Menu */}
                            {isNavOpen && (
                                <div className="absolute right-0 sm:right-0 mt-3 z-50 w-[92vw] sm:w-[480px] bg-card border border-gray-700 rounded-2xl sm:rounded-3xl shadow-2xl backdrop-blur-2xl p-4 sm:p-5 space-y-4 animate-fade-in max-h-[80vh] overflow-y-auto custom-scrollbar">
                                    <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                                        <div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                                <span>Admin Page Directory</span>
                                            </h3>
                                            <p className="text-[11px] text-gray-400 font-medium">Search and switch to any page instantly</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsNavOpen(false)}
                                            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-surface"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Quick Filter Search */}
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="Type page name or keyword (e.g. deposit, fee, users)..."
                                            className="w-full bg-surface border border-gray-700 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-gray-500 focus:border-brand-500 focus-visible:outline-none transition"
                                            autoFocus
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-bold"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>

                                    {/* Pages List */}
                                    <div className="space-y-2">
                                        {filteredPages.length === 0 ? (
                                            <div className="text-center py-6 text-xs text-gray-500 font-medium">
                                                No admin pages found matching "{searchQuery}".
                                            </div>
                                        ) : (
                                            filteredPages.map(page => {
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
                                                        className={`w-full flex items-center justify-between p-3 rounded-xl transition text-left cursor-pointer border ${
                                                            isCurrent
                                                                ? 'bg-brand-500/15 border-brand-500/50 text-white'
                                                                : 'bg-surface/50 hover:bg-surface border-gray-800 hover:border-gray-700 text-gray-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`p-2 rounded-lg border shrink-0 ${
                                                                isCurrent
                                                                    ? 'bg-brand-500 text-white border-brand-400'
                                                                    : 'bg-dark text-gray-400 border-gray-700'
                                                            }`}>
                                                                <PageIcon className="w-4 h-4" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-xs ${isCurrent ? 'font-black text-brand-400' : 'font-bold text-white'}`}>
                                                                        {page.label}
                                                                    </span>
                                                                    {page.badge && page.badge > 0 ? (
                                                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${page.badgeColor || 'bg-red-500 text-white'}`}>
                                                                            {page.badge}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                                                    {page.description}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {isCurrent && (
                                                            <div className="w-2 h-2 rounded-full bg-brand-400 shrink-0 ml-2 shadow-sm shadow-brand-400" />
                                                        )}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Level 2: The 5 Core Department Tabs */}
                <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">
                        Departments
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                        {DEPARTMENTS.map(dept => {
                            const DeptIcon = dept.icon;
                            const isDeptActive = currentDepartment === dept.id;
                            const badgeCount = getDeptBadge(dept.id);
                            return (
                                <button
                                    key={dept.id}
                                    type="button"
                                    onClick={() => setActiveTab(dept.defaultTab)}
                                    className={`flex items-center justify-between p-3 sm:p-3.5 rounded-2xl transition cursor-pointer border text-left ${
                                        isDeptActive
                                            ? 'bg-brand-500/15 border-brand-500/60 shadow-lg shadow-brand-500/10'
                                            : 'bg-surface/50 hover:bg-surface border-gray-800 hover:border-gray-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`p-2 rounded-xl border shrink-0 ${
                                            isDeptActive
                                                ? 'bg-brand-500 text-white border-brand-400'
                                                : 'bg-dark text-gray-400 border-gray-700'
                                        }`}>
                                            <DeptIcon className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className={`text-xs block truncate ${isDeptActive ? 'font-black text-brand-400' : 'font-bold text-gray-300'}`}>
                                                {dept.label}
                                            </span>
                                        </div>
                                    </div>

                                    {badgeCount > 0 && (
                                        <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ml-1 animate-pulse">
                                            {badgeCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Level 3: Department Sub-Pages Row */}
                <div className="pt-2 border-t border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest shrink-0 pr-1 hidden sm:inline">
                            Pages:
                        </span>
                        {currentDeptPages.map(page => {
                            const PageIcon = page.icon;
                            const isCurrent = activeTab === page.id;
                            return (
                                <button
                                    key={page.id}
                                    type="button"
                                    onClick={() => setActiveTab(page.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shrink-0 border ${
                                        isCurrent
                                            ? 'bg-brand-500 text-white border-brand-400 shadow-md shadow-brand-500/25'
                                            : 'bg-dark/80 text-gray-300 border-gray-800 hover:border-gray-700 hover:text-white'
                                    }`}
                                >
                                    <PageIcon className="w-3.5 h-3.5" />
                                    <span>{page.shortLabel}</span>
                                    {page.badge && page.badge > 0 ? (
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${page.badgeColor || 'bg-red-500 text-white'}`}>
                                            {page.badge}
                                        </span>
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>

                    <div className="text-[11px] text-gray-400 font-medium hidden lg:block shrink-0">
                        {activePage.description}
                    </div>
                </div>
            </div>

            {/* Main Content Area (Full Width Canvas with Active Page Banner) */}
            <div className="bg-dark/50 rounded-2xl sm:rounded-[2rem] border border-gray-800 p-4 sm:p-6 lg:p-8 min-h-[600px] w-full overflow-hidden shadow-xl">
                {/* Active Page Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-800">
                    <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-brand-500/10 text-brand-400 border border-brand-500/25 rounded-2xl shrink-0">
                            <ActiveIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    {activeDeptData.label}
                                </span>
                                <span className="text-gray-600 font-bold">•</span>
                                <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                                    {activePage.label}
                                </h2>
                                {activePage.badge && activePage.badge > 0 ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-red-500 text-white animate-pulse">
                                        {activePage.badge} Pending Action{activePage.badge > 1 ? 's' : ''}
                                    </span>
                                ) : null}
                            </div>
                            <p className="text-xs text-gray-400 font-medium mt-1">
                                {activePage.description}
                            </p>
                        </div>
                    </div>
                </div>
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
