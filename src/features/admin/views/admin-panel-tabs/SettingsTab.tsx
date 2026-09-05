import React, { useState, useRef, useEffect } from 'react';
import {
    Users,
    Settings,
    Megaphone,
    AlertTriangle,
    DollarSign,
    Percent,
    ShieldAlert,
    Phone,
    Mail,
    Save,
    Sliders,
    Layers,
    Sparkles,
    ChevronDown,
    Check
} from 'lucide-react';

import { AdminPanelTabProps } from './types';

type SettingsSection = 'financial' | 'platform' | 'organizer' | 'support' | 'discord' | 'all';

export const SettingsTab: React.FC<AdminPanelTabProps> = (props) => {
    const {
        handleSaveSettings,
        handleSaveFinancial,
        handleSavePlatform,
        handleSaveOrganizer,
        handleSaveSupport,
        handleSaveDiscord,
        isNoticeActive,
        maintenanceMode,
        minWithdrawal,
        notice,
        orgFormDescription,
        platformCommission,
        setIsNoticeActive,
        setMaintenanceMode,
        setMinWithdrawal,
        setNotice,
        setOrgFormDescription,
        setPlatformCommission,
        setSupportEmail,
        setSupportPhone,
        siteSettings,
        supportEmail,
        supportPhone,
        toggleOrgForm,
        discordWebhooks,
        setDiscordWebhooks,
        showToast
    } = props;

    const [activeSection, setActiveSection] = useState<SettingsSection>('financial');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [savingSection, setSavingSection] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Dedicated save executor for any section
    const onSaveSection = async (section: SettingsSection) => {
        setSavingSection(section);
        try {
            if (section === 'financial' && handleSaveFinancial) {
                await handleSaveFinancial();
            } else if (section === 'platform' && handleSavePlatform) {
                await handleSavePlatform();
            } else if (section === 'organizer' && handleSaveOrganizer) {
                await handleSaveOrganizer();
            } else if (section === 'support' && handleSaveSupport) {
                await handleSaveSupport();
            } else if (section === 'discord' && handleSaveDiscord) {
                await handleSaveDiscord();
            } else if (handleSaveSettings) {
                await handleSaveSettings();
            }
        } finally {
            setSavingSection(null);
        }
    };

    // Financial calculations for live visual split preview
    const commissionNum = Math.min(100, Math.max(0, Number(platformCommission) || 15));
    const orgShareNum = 100 - commissionNum;
    const exampleProfit = 1000;
    const examplePlatformCut = Math.round((exampleProfit * commissionNum) / 100);
    const exampleOrgNet = exampleProfit - examplePlatformCut;

    const sections = [
        {
            id: 'financial' as const,
            label: 'Financial & Commission',
            desc: 'Platform fee %, minimum withdrawal limit, and revenue split',
            icon: DollarSign,
            color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
            badge: `${commissionNum}% Platform Cut`
        },
        {
            id: 'platform' as const,
            label: 'Platform & Maintenance',
            desc: 'Maintenance mode toggle and site-wide broadcast notice banner',
            icon: ShieldAlert,
            color: 'text-red-400 bg-red-500/10 border-red-500/20',
            badge: maintenanceMode ? 'MAINTENANCE ACTIVE' : undefined
        },
        {
            id: 'organizer' as const,
            label: 'Organizer Portal',
            desc: 'Host verification application status and form guidelines',
            icon: Users,
            color: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
            badge: siteSettings?.isOrgFormOpen ?? true ? 'Applications Open' : 'Applications Closed'
        },
        {
            id: 'support' as const,
            label: 'Support & Contacts',
            desc: 'Official support email and phone/WhatsApp escalation channel',
            icon: Mail,
            color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
        },
        {
            id: 'discord' as const,
            label: 'Discord Multi-Webhooks',
            desc: 'Tournament & Scrim automated announcements, results, and test pings',
            icon: Megaphone,
            color: 'text-[#5865F2] bg-[#5865F2]/10 border-[#5865F2]/20'
        },
        {
            id: 'all' as const,
            label: 'All Settings (Consolidated)',
            desc: 'View and manage all settings stacked together on one page',
            icon: Layers,
            color: 'text-gray-400 bg-gray-500/10 border-gray-500/20'
        }
    ];

    const activeSectionData = sections.find(s => s.id === activeSection) || sections[0];
    const ActiveIcon = activeSectionData.icon;

    const getMainSaveConfig = () => {
        const isCurrentlySaving = savingSection !== null;
        switch (activeSection) {
            case 'financial':
                return {
                    label: isCurrentlySaving ? 'Saving Financial...' : 'Save Financial Settings',
                    color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25',
                    targetSection: 'financial' as const
                };
            case 'platform':
                return {
                    label: isCurrentlySaving ? 'Saving Platform...' : 'Save Platform & Notices',
                    color: 'bg-red-600 hover:bg-red-500 shadow-red-600/25',
                    targetSection: 'platform' as const
                };
            case 'organizer':
                return {
                    label: isCurrentlySaving ? 'Saving Organizer...' : 'Save Organizer Settings',
                    color: 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/25',
                    targetSection: 'organizer' as const
                };
            case 'support':
                return {
                    label: isCurrentlySaving ? 'Saving Support...' : 'Save Support Info',
                    color: 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/25',
                    targetSection: 'support' as const
                };
            case 'discord':
                return {
                    label: isCurrentlySaving ? 'Saving Webhooks...' : 'Save Discord Webhooks',
                    color: 'bg-[#5865F2] hover:bg-[#4752c4] shadow-[#5865F2]/25',
                    targetSection: 'discord' as const
                };
            default:
                return {
                    label: isCurrentlySaving ? 'Saving All...' : 'Save All Settings',
                    color: 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/25',
                    targetSection: 'all' as const
                };
        }
    };

    const mainSave = getMainSaveConfig();

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Top Control Bar with Dropdown Navigator & THE Single Main Save Button */}
            <div className="bg-card p-5 sm:p-7 rounded-2xl border border-gray-800 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
                    <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-brand-500/10 text-brand-400 rounded-2xl border border-brand-500/20">
                            <Settings className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                                Site Configuration
                            </h2>
                            <p className="text-xs text-gray-400 font-medium mt-0.5">
                                Select a category below and save dedicated settings using the main save button.
                            </p>
                        </div>
                    </div>

                    {/* The ONLY Main Save Button on the Page */}
                    <button
                        type="button"
                        onClick={() => onSaveSection(mainSave.targetSection)}
                        disabled={savingSection !== null}
                        className={`w-full sm:w-auto flex items-center justify-center gap-2.5 text-white px-7 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition shadow-lg disabled:opacity-50 cursor-pointer shrink-0 ${mainSave.color}`}
                    >
                        <Save className="w-4 h-4" />
                        <span>{mainSave.label}</span>
                    </button>
                </div>

                {/* Dropdown Category Selector (Mobile & Desktop Friendly) */}
                <div className="relative" ref={dropdownRef}>
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between block">
                        <span>Settings Category</span>
                        <span className="text-[10px] text-brand-400 font-bold">Tap to switch view</span>
                    </label>

                    {/* Trigger Button */}
                    <button
                        type="button"
                        onClick={() => setIsDropdownOpen(prev => !prev)}
                        className="w-full flex items-center justify-between bg-dark/95 hover:bg-dark border border-gray-700 hover:border-brand-500/60 p-4 rounded-2xl transition cursor-pointer shadow-lg group text-left"
                    >
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className={`p-2.5 rounded-xl border shrink-0 ${activeSectionData.color}`}>
                                <ActiveIcon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-white font-black text-sm sm:text-base tracking-tight">
                                        {activeSectionData.label}
                                    </span>
                                    {activeSectionData.badge && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                                            activeSectionData.badge.includes('MAINTENANCE')
                                                ? 'bg-red-500 text-white animate-pulse'
                                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                        }`}>
                                            {activeSectionData.badge}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400 font-medium truncate mt-0.5">
                                    {activeSectionData.desc}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pl-3 shrink-0">
                            <span className="text-xs font-bold text-brand-400 hidden sm:inline">Select</span>
                            <div className="p-1.5 rounded-lg bg-surface border border-gray-700 group-hover:border-brand-500/40 transition">
                                <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-brand-400' : ''}`} />
                            </div>
                        </div>
                    </button>

                    {/* Dropdown Menu List */}
                    {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-card/95 border border-gray-700/90 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden p-2 space-y-1 animate-fade-in">
                            {sections.map(sec => {
                                const SecIcon = sec.icon;
                                const isSelected = activeSection === sec.id;
                                return (
                                    <button
                                        key={sec.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveSection(sec.id);
                                            setIsDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between p-3.5 rounded-xl transition text-left cursor-pointer ${
                                            isSelected
                                                ? 'bg-brand-500/15 border border-brand-500/40 text-white'
                                                : 'hover:bg-surface/80 text-gray-300 border border-transparent'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`p-2 rounded-xl border shrink-0 ${sec.color}`}>
                                                <SecIcon className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs sm:text-sm tracking-tight ${isSelected ? 'text-brand-400 font-black' : 'text-white font-bold'}`}>
                                                        {sec.label}
                                                    </span>
                                                    {sec.badge && (
                                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${
                                                            sec.badge.includes('MAINTENANCE')
                                                                ? 'bg-red-500 text-white'
                                                                : 'bg-surface text-gray-300 border border-gray-700'
                                                        }`}>
                                                            {sec.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-gray-400 font-medium truncate mt-0.5">
                                                    {sec.desc}
                                                </p>
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <div className="p-1 text-brand-400 shrink-0 ml-2">
                                                <Check className="w-4 h-4" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* SECTION 1: FINANCIAL & COMMISSION */}
            {(activeSection === 'financial' || activeSection === 'all') && (
                <div className="bg-card p-6 sm:p-8 rounded-2xl border border-gray-800 space-y-6 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white uppercase tracking-wider">
                                    Financial Settings & Platform Commission
                                </h3>
                                <p className="text-xs text-gray-400 font-medium">
                                    Configure the revenue split applied to completed tournaments and scrims.
                                </p>
                            </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-full uppercase">
                            Active: {commissionNum}% Platform / {orgShareNum}% Org
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Input Controls */}
                        <div className="space-y-6">
                            {/* Platform Commission Rate */}
                            <div className="bg-dark/60 p-5 rounded-2xl border border-gray-800 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="platform-commission" className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                        <Percent className="w-4 h-4 text-emerald-400" />
                                        Platform Commission Rate (%)
                                    </label>
                                    <span className="text-xs font-bold text-emerald-400 font-mono">{commissionNum}% Cut</span>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        id="platform-commission"
                                        min="0"
                                        max="100"
                                        value={platformCommission ?? '15'}
                                        onChange={e => setPlatformCommission && setPlatformCommission(e.target.value)}
                                        placeholder="15"
                                        className="w-full bg-surface border border-gray-700 rounded-xl p-3.5 pr-12 text-white font-black text-lg focus:border-brand-500 focus-visible:outline-none transition"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 font-black text-base">%</span>
                                </div>
                                <p className="text-[11px] text-gray-400 font-medium">
                                    Percentage of match net profit (Entry Fees minus Prize Pool) retained by NexPlay. The remaining <span className="text-brand-400 font-bold">{orgShareNum}%</span> is automatically credited to the organizer upon release.
                                </p>
                            </div>

                            {/* Minimum Withdrawal Amount */}
                            <div className="bg-dark/60 p-5 rounded-2xl border border-gray-800 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="min-withdrawal" className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-brand-400" />
                                        Minimum Withdrawal Amount (Rs.)
                                    </label>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-sm">Rs.</span>
                                    <input
                                        type="number"
                                        id="min-withdrawal"
                                        value={minWithdrawal}
                                        onChange={e => setMinWithdrawal(e.target.value)}
                                        placeholder="500"
                                        className="w-full bg-surface border border-gray-700 rounded-xl p-3.5 pl-12 text-white font-black text-lg focus:border-brand-500 focus-visible:outline-none transition"
                                    />
                                </div>
                                <p className="text-[11px] text-gray-400 font-medium">
                                    Minimum payout limit allowed per eSewa, Khalti, or Bank Transfer request. Protects against spam transactions.
                                </p>
                            </div>
                        </div>

                        {/* Live Revenue Split Visualizer */}
                        <div className="bg-dark/80 p-6 rounded-2xl border border-gray-800 flex flex-col justify-between space-y-6">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wider mb-3">
                                    <Sparkles className="w-4 h-4 text-brand-400" />
                                    Live Revenue Split Preview
                                </div>

                                {/* Split Bar */}
                                <div className="w-full h-8 rounded-xl overflow-hidden flex shadow-inner border border-gray-700">
                                    <div
                                        style={{ width: `${commissionNum}%` }}
                                        className="bg-emerald-500 flex items-center justify-center text-white text-[11px] font-black uppercase tracking-wider transition-all duration-300"
                                        title={`Platform Cut: ${commissionNum}%`}
                                    >
                                        {commissionNum >= 12 && `${commissionNum}% Platform`}
                                    </div>
                                    <div
                                        style={{ width: `${orgShareNum}%` }}
                                        className="bg-brand-500 flex items-center justify-center text-white text-[11px] font-black uppercase tracking-wider transition-all duration-300"
                                        title={`Organizer Share: ${orgShareNum}%`}
                                    >
                                        {orgShareNum >= 12 && `${orgShareNum}% Organizer`}
                                    </div>
                                </div>

                                <div className="flex justify-between items-center text-[11px] text-gray-400 font-mono mt-2 px-1">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                                        Platform Cut: <strong className="text-emerald-400">{commissionNum}%</strong>
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-brand-500 inline-block" />
                                        Organizer Net: <strong className="text-brand-400">{orgShareNum}%</strong>
                                    </span>
                                </div>
                            </div>

                            {/* Practical Example Box */}
                            <div className="p-4 rounded-xl bg-surface/60 border border-gray-800 space-y-2.5">
                                <div className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
                                    Example Calculation (Rs. {exampleProfit.toLocaleString()} Net Match Profit)
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="p-3 bg-dark/70 rounded-lg border border-emerald-500/20">
                                        <div className="text-[10px] text-gray-400 uppercase font-bold">NexPlay Platform Cut</div>
                                        <div className="text-lg font-black text-emerald-400 mt-0.5">
                                            Rs. {examplePlatformCut.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-dark/70 rounded-lg border border-brand-500/20">
                                        <div className="text-[10px] text-gray-400 uppercase font-bold">Organizer Share</div>
                                        <div className="text-lg font-black text-brand-400 mt-0.5">
                                            Rs. {exampleOrgNet.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 2: PLATFORM & MAINTENANCE */}
            {(activeSection === 'platform' || activeSection === 'all') && (
                <div className="bg-card p-6 sm:p-8 rounded-2xl border border-gray-800 space-y-6 shadow-xl">
                    <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                        <div className="p-2.5 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-wider">
                                Platform Status & Broadcast Notices
                            </h3>
                            <p className="text-xs text-gray-400 font-medium">
                                Control site-wide maintenance lockdown and real-time public announcements.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Maintenance Mode Card */}
                        <div className="bg-dark/60 p-6 rounded-2xl border border-gray-800 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <AlertTriangle className={`w-5 h-5 ${maintenanceMode ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
                                    <div>
                                        <div className="text-sm text-white font-black uppercase tracking-wide">Maintenance Mode</div>
                                        <div className={`text-[10px] font-bold uppercase tracking-wider ${maintenanceMode ? 'text-red-400' : 'text-gray-500'}`}>
                                            {maintenanceMode ? 'ACTIVE — Public Access Blocked' : 'INACTIVE — System Live'}
                                        </div>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={maintenanceMode}
                                        onChange={e => setMaintenanceMode(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-12 h-6 bg-surface peer-focus:focus-visible:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-red-600"></div>
                                </label>
                            </div>

                            {maintenanceMode && (
                                <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 font-medium flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                                    <span>Warning: All regular player and organizer views are currently locked behind the maintenance splash screen.</span>
                                </div>
                            )}

                            <p className="text-xs text-gray-400 leading-relaxed font-medium">
                                When enabled, standard users are directed to the maintenance page. Administrators retain full access to manage and test the site.
                            </p>
                        </div>

                        {/* Broadcast Notice Card */}
                        <div className="bg-dark/60 p-6 rounded-2xl border border-gray-800 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <Megaphone className="w-5 h-5 text-brand-400" />
                                    <div>
                                        <div className="text-sm text-white font-black uppercase tracking-wide">Site-Wide Notice Banner</div>
                                        <div className={`text-[10px] font-bold uppercase tracking-wider ${isNoticeActive ? 'text-brand-400' : 'text-gray-500'}`}>
                                            {isNoticeActive ? 'BROADCASTING NOW' : 'DISABLED'}
                                        </div>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={isNoticeActive}
                                        onChange={e => setIsNoticeActive(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-12 h-6 bg-surface peer-focus:focus-visible:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-brand-500"></div>
                                </label>
                            </div>

                            <textarea
                                value={notice}
                                onChange={e => setNotice(e.target.value)}
                                className="w-full bg-surface border border-gray-700 rounded-xl p-3.5 text-white text-xs focus:border-brand-500 focus-visible:outline-none h-24 transition leading-relaxed"
                                placeholder="Enter public announcement... (e.g. Server maintenance scheduled tonight at 11:00 PM NPT. All matches paused.)"
                            />

                            {/* Live Notice Preview */}
                            {isNoticeActive && notice && (
                                <div className="p-3 bg-brand-950/30 border border-brand-500/30 rounded-xl flex items-center gap-2.5 text-xs text-brand-200">
                                    <Megaphone className="w-4 h-4 text-brand-400 shrink-0" />
                                    <span className="font-semibold">{notice}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 3: ORGANIZER PORTAL CONFIGURATION */}
            {(activeSection === 'organizer' || activeSection === 'all') && (
                <div className="bg-card p-6 sm:p-8 rounded-2xl border border-gray-800 space-y-6 shadow-xl">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-brand-500/10 text-brand-400 rounded-xl border border-brand-500/20">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white uppercase tracking-wider">
                                    Organizer Applications & Requirements
                                </h3>
                                <p className="text-xs text-gray-400 font-medium">
                                    Manage who can apply for verified host status and set application criteria.
                                </p>
                            </div>
                        </div>
                        <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full uppercase border ${
                            siteSettings?.isOrgFormOpen ?? true
                                ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30'
                                : 'text-amber-400 bg-amber-950/40 border-amber-500/30'
                        }`}>
                            {siteSettings?.isOrgFormOpen ?? true ? 'Applications Open' : 'Applications Closed'}
                        </span>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-dark/60 p-6 rounded-2xl border border-gray-800 flex items-center justify-between">
                            <div>
                                <div className="text-sm text-white font-black uppercase tracking-wide">
                                    Accept New Organizer Applications
                                </div>
                                <p className="text-xs text-gray-400 mt-1 font-medium">
                                    When active, players can submit verification forms to host tournaments and scrims from the contact page.
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                                <input
                                    type="checkbox"
                                    checked={siteSettings?.isOrgFormOpen ?? true}
                                    onChange={toggleOrgForm}
                                    className="sr-only peer"
                                />
                                <div className="w-12 h-6 bg-surface peer-focus:focus-visible:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-brand-500"></div>
                            </label>
                        </div>

                        <div className="bg-dark/60 p-6 rounded-2xl border border-gray-800 space-y-2">
                            <label htmlFor="organizer-form-desc" className="text-xs font-black text-gray-300 uppercase tracking-wider block">
                                Application Guidelines & Requirement Instructions
                            </label>
                            <textarea
                                id="organizer-form-desc"
                                value={orgFormDescription}
                                onChange={e => setOrgFormDescription(e.target.value)}
                                className="w-full bg-surface border border-gray-700 rounded-xl p-4 text-white text-xs focus:border-brand-500 focus-visible:outline-none h-32 leading-relaxed transition font-medium"
                                placeholder="Explain guidelines for applicants (e.g. Valid Nepali Citizenship/ID, past tournament hosting experience, minimum social media audience, and verified payment details required)..."
                            />
                            <p className="text-[11px] text-gray-400 font-medium">
                                Displayed at the top of the organizer application modal to guide prospective hosts.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 4: SUPPORT & CONTACTS */}
            {(activeSection === 'support' || activeSection === 'all') && (
                <div className="bg-card p-6 sm:p-8 rounded-2xl border border-gray-800 space-y-6 shadow-xl">
                    <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                        <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                            <Mail className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-wider">
                                Official Support & Contact Channels
                            </h3>
                            <p className="text-xs text-gray-400 font-medium">
                                Primary communication routes displayed to players and organizers across the portal.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-dark/60 p-6 rounded-2xl border border-gray-800 space-y-2">
                            <label htmlFor="support-email" className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                <Mail className="w-4 h-4 text-blue-400" />
                                Official Support Email
                            </label>
                            <input
                                type="email"
                                id="support-email"
                                value={supportEmail}
                                onChange={e => setSupportEmail(e.target.value)}
                                placeholder="support@nexplay.gg"
                                className="w-full bg-surface border border-gray-700 rounded-xl p-3.5 text-white text-sm focus:border-brand-500 focus-visible:outline-none transition font-medium"
                            />
                            <p className="text-[11px] text-gray-400 font-medium">
                                Displayed on error pages, transaction queries, and dispute contact sections.
                            </p>
                        </div>

                        <div className="bg-dark/60 p-6 rounded-2xl border border-gray-800 space-y-2">
                            <label htmlFor="support-phone" className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                <Phone className="w-4 h-4 text-emerald-400" />
                                Support Phone / WhatsApp Hotline
                            </label>
                            <input
                                type="text"
                                id="support-phone"
                                value={supportPhone}
                                onChange={e => setSupportPhone(e.target.value)}
                                placeholder="+977 98XXXXXXXX"
                                className="w-full bg-surface border border-gray-700 rounded-xl p-3.5 text-white text-sm focus:border-brand-500 focus-visible:outline-none transition font-medium"
                            />
                            <p className="text-[11px] text-gray-400 font-medium">
                                Used for urgent payment escalations, organizer verification, and dispute resolution.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 5: DISCORD MULTI-WEBHOOK AUTOMATION */}
            {(activeSection === 'discord' || activeSection === 'all') && (
                <div className="bg-card p-6 sm:p-8 rounded-2xl border border-gray-800 space-y-6 shadow-xl">
                    <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                        <div className="p-2.5 bg-[#5865F2]/10 text-[#5865F2] rounded-xl border border-[#5865F2]/20">
                            <Megaphone className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-wider">
                                Discord Server Multi-Webhook Automation
                            </h3>
                            <p className="text-xs text-gray-400 font-medium">
                                Real-time broadcast hooks for tournaments and scrim announcements, draws, and results.
                            </p>
                        </div>
                    </div>

                    <DiscordSettingsCard
                        discordWebhooks={props.discordWebhooks}
                        setDiscordWebhooks={props.setDiscordWebhooks}
                        showToast={props.showToast}
                    />
                </div>
            )}
        </div>
    );
};

interface DiscordSettingsCardProps {
    discordWebhooks?: any;
    setDiscordWebhooks?: any;
    showToast?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const DiscordSettingsCard: React.FC<DiscordSettingsCardProps> = ({ discordWebhooks, setDiscordWebhooks, showToast }) => {
    const [activeTab, setActiveTab] = React.useState<'tournaments' | 'scrims'>('tournaments');
    const [testingCategory, setTestingCategory] = React.useState<string | null>(null);

    const activeWebhooks = discordWebhooks?.[activeTab] || {};
    const isAutoEnabled = discordWebhooks?.autoAnnounce?.[activeTab] ?? true;

    const updateWebhook = (category: string, value: string) => {
        setDiscordWebhooks?.((prev: any) => ({
            ...(prev || {}),
            [activeTab]: {
                ...(prev?.[activeTab] || {}),
                [category]: value,
            }
        }));
    };

    const toggleAutoAnnounce = (enabled: boolean) => {
        setDiscordWebhooks?.((prev: any) => ({
            ...(prev || {}),
            autoAnnounce: {
                ...(prev?.autoAnnounce || {}),
                [activeTab]: enabled,
            }
        }));
    };

    const handleTest = async (category: string, url?: string) => {
        const targetUrl = url?.trim() || activeWebhooks[category]?.trim();
        if (!targetUrl) {
            showToast?.(`Please enter a webhook URL for ${category} first.`, 'warning');
            return;
        }
        setTestingCategory(category);
        showToast?.(`Sending test ping to Discord [${category}]...`, 'info');
        try {
            const { testSpecificDiscordWebhook } = await import('../../../../shared/services/DiscordService');
            const res = await testSpecificDiscordWebhook(activeTab, category as any, targetUrl);
            showToast?.(res.message, res.success ? 'success' : 'error');
        } catch (err: any) {
            showToast?.(err.message || 'Test delivery failed', 'error');
        } finally {
            setTestingCategory(null);
        }
    };

    const categories = [
        {
            key: 'announcement',
            title: activeTab === 'tournaments' ? 'Tournament Announcement Webhook' : 'Scrim Announcement Webhook',
            desc: activeTab === 'tournaments' ? 'Broadcasts when a new tournament is created & opened.' : 'Broadcasts new scrim lobby open for booking.',
            icon: '📢',
            placeholder: 'https://discord.com/api/webhooks/... (e.g. #tournament-announcements)'
        },
        {
            key: 'registration',
            title: activeTab === 'tournaments' ? 'Register Announcement Webhook' : 'Scrim Registration Webhook',
            desc: 'Broadcasts player / squad registration alerts and live slot counts.',
            icon: '📝',
            placeholder: 'https://discord.com/api/webhooks/... (e.g. #registration-feed)'
        },
        {
            key: 'group',
            title: activeTab === 'tournaments' ? 'Group Draw Webhook' : 'Scrim Lobby / Group Webhook',
            desc: activeTab === 'tournaments' ? 'Broadcasts group stage drawings and team allocations.' : 'Broadcasts confirmed slot list and player allocations.',
            icon: '📋',
            placeholder: 'https://discord.com/api/webhooks/... (e.g. #group-draws)'
        },
        {
            key: 'matchSchedule',
            title: activeTab === 'tournaments' ? 'Match Schedule & Room Webhook' : 'Scrim Match Schedule Webhook',
            desc: 'Broadcasts match reminders, countdowns, and room credentials (ID & password).',
            icon: '⏰',
            placeholder: 'https://discord.com/api/webhooks/... (e.g. #match-schedule)'
        },
        {
            key: 'result',
            title: activeTab === 'tournaments' ? 'Result Webhook' : 'Scrim Result Webhook',
            desc: 'Broadcasts match scoring, kill tallies, and updated round standings.',
            icon: '📊',
            placeholder: 'https://discord.com/api/webhooks/... (e.g. #match-results)'
        },
        {
            key: 'champion',
            title: activeTab === 'tournaments' ? 'Champion Announcement Webhook' : 'Scrim Champion / Winner Webhook',
            desc: 'Broadcasts grand champions, final rankings, and prize distributions.',
            icon: '👑',
            placeholder: 'https://discord.com/api/webhooks/... (e.g. #hall-of-champions)'
        },
    ];

    return (
        <div className="bg-dark p-6 rounded-xl border border-gray-800 space-y-6">
            {/* Format Switcher */}
            <div className="flex bg-surface p-1.5 rounded-xl border border-gray-800 gap-1.5">
                <button
                    type="button"
                    onClick={() => setActiveTab('tournaments')}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                        activeTab === 'tournaments'
                            ? 'bg-[#5865F2] text-white shadow-md shadow-[#5865F2]/25'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    🏆 Tournaments Webhooks
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('scrims')}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                        activeTab === 'scrims'
                            ? 'bg-[#5865F2] text-white shadow-md shadow-[#5865F2]/25'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    🎯 Scrims Webhooks
                </button>
            </div>

            {/* Master Toggle */}
            <div className="flex items-center justify-between p-4 bg-surface rounded-xl border border-gray-800">
                <div>
                    <div className="text-xs text-white font-bold uppercase tracking-wide">
                        Automatic {activeTab === 'tournaments' ? 'Tournament' : 'Scrim'} Broadcasts
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                        Automatically dispatch updates across the 6 channels below when lifecycle events occur.
                    </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                    <input 
                        type="checkbox" 
                        checked={isAutoEnabled} 
                        onChange={e => toggleAutoAnnounce(e.target.checked)} 
                        className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-dark peer-focus:focus-visible:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-[#5865F2]"></div>
                </label>
            </div>

            {/* 6 Granular Webhooks */}
            <div className="space-y-4">
                {categories.map(cat => {
                    const val = activeWebhooks[cat.key] || '';
                    const isConfigured = val.trim().length > 0;
                    const isTesting = testingCategory === cat.key;

                    return (
                        <div key={cat.key} className="p-4 bg-surface rounded-xl border border-gray-800 space-y-2">
                            <div className="flex items-center justify-between">
                                <label htmlFor={`webhook-${activeTab}-${cat.key}`} className="text-xs text-white font-bold uppercase flex items-center gap-2">
                                    <span>{cat.icon}</span>
                                    <span>{cat.title}</span>
                                </label>
                                {isConfigured ? (
                                    <span className="text-[9px] text-green-400 font-black bg-green-950/60 border border-green-500/30 px-2 py-0.5 rounded uppercase">CONFIGURED</span>
                                ) : (
                                    <span className="text-[9px] text-yellow-400 font-black bg-yellow-950/60 border border-yellow-500/30 px-2 py-0.5 rounded uppercase">NOT SET</span>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-400 font-bold">{cat.desc}</p>
                            <div className="flex gap-2 pt-1">
                                <input
                                    id={`webhook-${activeTab}-${cat.key}`}
                                    type="url"
                                    value={val}
                                    onChange={e => updateWebhook(cat.key, e.target.value)}
                                    placeholder={cat.placeholder}
                                    className="w-full bg-dark border border-gray-700 rounded-lg p-2.5 text-white font-mono text-xs focus:border-[#5865F2] focus-visible:outline-none"
                                />
                                <button
                                    type="button"
                                    disabled={isTesting}
                                    onClick={() => handleTest(cat.key, val)}
                                    className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition shrink-0 flex items-center gap-1.5"
                                >
                                    {isTesting ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        'Test Ping'
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
