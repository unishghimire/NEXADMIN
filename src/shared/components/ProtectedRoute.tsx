import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { user, profile, loading, authError, retryAuth, logout } = useAuth();
    const location = useLocation();
    const [profileTimeout, setProfileTimeout] = useState(false);

    useEffect(() => {
        if (user && !profile && !loading && allowedRoles) {
            const timer = setTimeout(() => setProfileTimeout(true), 5000);
            return () => clearTimeout(timer);
        }
        setProfileTimeout(false);
    }, [user, profile, loading, allowedRoles]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Verifying session...</p>
            </div>
        );
    }

    // Not authenticated at all — redirect to login
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // User IS authenticated but profile failed to load — show retry instead of
    // redirecting to /login (which creates a bounce loop: login sees user → redirects back)
    if (authError) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <p className="text-red-400 font-bold text-center max-w-sm">{authError}</p>
                <button
                    onClick={retryAuth}
                    className="px-6 py-2 bg-brand-500 hover:bg-brand-400 text-white font-bold rounded-lg transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    // Wait for profile to load before checking roles
    if (allowedRoles && !profile && !profileTimeout) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading profile...</p>
            </div>
        );
    }

    if (allowedRoles && profileTimeout && !profile) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
                <p className="text-amber-400 font-bold text-sm">Failed to verify administrator profile. Please check your connection.</p>
                <button
                    onClick={retryAuth}
                    className="px-6 py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-lg transition cursor-pointer"
                >
                    Retry Verification
                </button>
            </div>
        );
    }

    if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-2">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-wider">Access Restricted</h2>
                <p className="text-sm text-slate-400 max-w-md">
                    Your account ({profile.email || user.email}) does not have administrative privileges for the NexPlay Master Suite.
                </p>
                <div className="flex gap-3 mt-2">
                    <button
                        onClick={logout}
                        className="px-5 py-2.5 bg-surface hover:bg-surface/80 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition cursor-pointer"
                    >
                        Sign Out
                    </button>
                    <a
                        href={import.meta.env.VITE_MAIN_APP_URL || 'https://www.nexplayorg.app'}
                        className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition"
                    >
                        Go to Main App
                    </a>
                </div>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>
            {children}
        </>
    );
};

export default ProtectedRoute;
