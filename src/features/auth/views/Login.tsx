import Seo from '../../../shared/components/Seo';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotification } from '../../../shared/context/NotificationContext';
import { useAuth } from '../../../shared/context/AuthContext';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldAlert, ShieldCheck } from 'lucide-react';
import { signInWithEmailAndPassword, signInWithRedirect, signInWithPopup, getRedirectResult, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth, googleProvider, appleProvider } from '../../../shared/config/firebase';
import { isSafeInternalPath } from '../../../shared/utils/utils';
import { executeRecaptchaEnterprise } from '../../../shared/utils/recaptchaEnterprise';

async function verifyAdminStatus(firebaseUser: any): Promise<boolean> {
    try {
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        if (tokenResult.claims?.role === 'admin') {
            return true;
        }
    } catch {}

    try {
        const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDocSnap.exists() && userDocSnap.data()?.role === 'admin') {
            return true;
        }
    } catch {}

    return false;
}

const Login: React.FC = () => {
    const { showToast } = useNotification();
    const { user, profile, loading: authLoading, profileLoading, authError, retryAuth, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const getRedirectTarget = () => {
        const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
        if (from && isSafeInternalPath(from.pathname)) {
            return from.pathname + (from.search || '');
        }
        return '/';
    };

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isAppleLoading, setIsAppleLoading] = useState(false);
    const [error, setError] = useState('');
    const [redirectTarget, setRedirectTarget] = useState<string>(() => getRedirectTarget());
    const submittingRef = useRef(false);
    const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim();

    // Verify authenticated user role: only 'admin' is permitted to enter
    useEffect(() => {
        if (!user || authLoading || profileLoading) return;

        const checkRole = async () => {
            const firebaseUser = auth.currentUser;
            let isAdmin = false;
            if (firebaseUser) {
                isAdmin = await verifyAdminStatus(firebaseUser);
            } else if (profile?.role === 'admin' || user?.role === 'admin') {
                isAdmin = true;
            }

            if (isAdmin) {
                navigate(redirectTarget, { replace: true });
            } else {
                await logout();
                const roleName = profile?.role || user?.role || 'player';
                setError(`Access Denied: Your account (${profile?.email || user.email}) is registered as '${roleName}'. The NexAdmin Portal is strictly restricted to platform administrators only.`);
                showToast('Access Denied: Only administrators can log in here.', 'error');
            }
        };

        void checkRole();
    }, [user, profile, authLoading, profileLoading, redirectTarget, navigate, logout, showToast]);

    // Handle the result of signInWithRedirect (fires after the page reloads from OAuth).
    useEffect(() => {
        let cancelled = false;
        const pendingGoogle = sessionStorage.getItem('google-redirect-pending') === 'true';
        const pendingApple = sessionStorage.getItem('apple-redirect-pending') === 'true';
        if (pendingGoogle) setIsGoogleLoading(true);
        if (pendingApple) setIsAppleLoading(true);

        getRedirectResult(auth)
            .then(async (result) => {
                if (cancelled) return;
                sessionStorage.removeItem('google-redirect-pending');
                sessionStorage.removeItem('apple-redirect-pending');
                if (result && result.user) {
                    const isAdmin = await verifyAdminStatus(result.user);

                    if (!isAdmin) {
                        await signOut(auth);
                        setIsGoogleLoading(false);
                        setIsAppleLoading(false);
                        const msg = `Access Denied: Account '${result.user.email}' does not have administrator privileges. The NexAdmin Portal is restricted to platform administrators only.`;
                        setError(msg);
                        showToast(msg, 'error');
                        return;
                    }

                    showToast('Welcome back, Administrator!', 'success');
                    setRedirectTarget(getRedirectTarget());
                } else {
                    setIsGoogleLoading(false);
                    setIsAppleLoading(false);
                }
            })
            .catch((err: any) => {
                if (cancelled) return;
                sessionStorage.removeItem('google-redirect-pending');
                sessionStorage.removeItem('apple-redirect-pending');
                setIsGoogleLoading(false);
                setIsAppleLoading(false);
                console.error('Redirect result error:', err?.code, err);
                const authErrMap: Record<string, string> = {
                    'auth/unauthorized-domain': 'This domain is not authorised in Firebase. Add it in Firebase Console → Authentication → Authorized Domains.',
                    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Console → Authentication → Sign-in method.',
                    'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
                    'auth/network-request-failed': 'Network error. Check your connection and try again.',
                    'auth/internal-error': 'An internal error occurred. Please try again.',
                };
                const errMsg = authErrMap[err?.code] || `Social Sign-In failed (${err?.code || 'unknown'}). Please try again.`;
                setError(errMsg);
                showToast(errMsg, 'error');
            });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // If profile initialization fails, release the loading state so the user can retry
    useEffect(() => {
        if (authError && (isLoading || isGoogleLoading || isAppleLoading)) {
            setIsLoading(false);
            setIsGoogleLoading(false);
            setIsAppleLoading(false);
        }
    }, [authError, isLoading, isGoogleLoading, isAppleLoading]);

    // Safety net: unblock form after bounded wait
    useEffect(() => {
        if ((!isLoading && !isGoogleLoading && !isAppleLoading) || user || authLoading || authError) return;
        const timer = setTimeout(() => {
            submittingRef.current = false;
            setIsLoading(false);
            setIsGoogleLoading(false);
            setIsAppleLoading(false);
            setError('Sign-in could not be confirmed. Please try again.');
        }, 15000);
        return () => clearTimeout(timer);
    }, [isLoading, isGoogleLoading, isAppleLoading, user, authLoading, authError]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submittingRef.current || user) return;
        submittingRef.current = true;
        setIsLoading(true);
        setError('');

        try {
            // Invisible reCAPTCHA Enterprise background verification token
            if (recaptchaSiteKey) {
                await executeRecaptchaEnterprise('LOGIN');
            }
            const cred = await signInWithEmailAndPassword(auth, email, password);

            // Immediate admin role verification
            const isAdmin = await verifyAdminStatus(cred.user);

            if (!isAdmin) {
                await signOut(auth);
                submittingRef.current = false;
                setIsLoading(false);
                const msg = `Access Denied: Your account (${cred.user.email}) does not have administrator privileges. The NexAdmin Portal is strictly restricted to platform administrators.`;
                setError(msg);
                showToast(msg, 'error');
                return;
            }

            showToast('Welcome back, Administrator!', 'success');
            setRedirectTarget(getRedirectTarget());
            // Keep the loading state on success — the redirect effect navigates once session settles.
        } catch (err: any) {
            submittingRef.current = false;
            setIsLoading(false);
            console.error('Login error:', err);
            const firebaseErrMap: Record<string, string> = {
                'auth/invalid-credential': 'Invalid email or password',
                'auth/user-not-found': 'Invalid email or password',
                'auth/wrong-password': 'Invalid email or password',
                'auth/too-many-requests': 'Too many attempts. Try again later.',
                'auth/user-disabled': 'This account has been disabled.',
                'auth/network-request-failed': 'Network error. Check your connection.'
            };
            const errMsg = firebaseErrMap[err.code] || 'Login failed. Please try again.';
            setError(errMsg);
            showToast(errMsg, 'error');
        }
    };

    const handleGoogleSignIn = async () => {
        if (submittingRef.current || user) return;
        setError('');
        submittingRef.current = true;
        setIsGoogleLoading(true);

        try {
            let credUser = null;
            try {
                const res = await signInWithPopup(auth, googleProvider);
                credUser = res.user;
            } catch (popupErr: any) {
                if (popupErr?.code === 'auth/popup-blocked' || popupErr?.code === 'auth/cancelled-popup-request') {
                    // Fall back to redirect — set flag for the redirect handler
                    sessionStorage.setItem('google-redirect-pending', 'true');
                    await signInWithRedirect(auth, googleProvider);
                    return;
                } else {
                    throw popupErr;
                }
            }

            if (credUser) {
                const isAdmin = await verifyAdminStatus(credUser);

                if (!isAdmin) {
                    await signOut(auth);
                    submittingRef.current = false;
                    setIsGoogleLoading(false);
                    const msg = `Access Denied: Your account (${credUser.email}) does not have administrator privileges. Only platform administrators are permitted to enter NexAdmin.`;
                    setError(msg);
                    showToast(msg, 'error');
                    return;
                }

                showToast('Welcome back, Administrator!', 'success');
                setRedirectTarget(getRedirectTarget());
            }
        } catch (err: any) {
            submittingRef.current = false;
            setIsGoogleLoading(false);
            if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
                return;
            }
            console.error('Google Sign-In error:', err?.code, err);
            const googleErrMap: Record<string, string> = {
                'auth/unauthorized-domain': 'This domain is not authorised in Firebase. Add it in Firebase Console → Authentication → Authorized Domains.',
                'auth/operation-not-allowed': 'Google Sign-In is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.',
                'auth/network-request-failed': 'Network error. Check your connection and try again.',
                'auth/internal-error': 'An internal error occurred. Please try again.',
                'auth/popup-blocked': 'Popup was blocked by the browser. Please allow popups for this site and try again.',
            };
            const errMsg = googleErrMap[err?.code] || `Google Sign-In failed (${err?.code || 'unknown'}). Please try again.`;
            setError(errMsg);
            showToast(errMsg, 'error');
        }
    };

    const handleAppleSignIn = async () => {
        if (submittingRef.current || user) return;
        setError('');
        submittingRef.current = true;
        setIsAppleLoading(true);

        try {
            let credUser = null;
            try {
                const res = await signInWithPopup(auth, appleProvider);
                credUser = res.user;
            } catch (popupErr: any) {
                if (popupErr?.code === 'auth/popup-blocked' || popupErr?.code === 'auth/cancelled-popup-request') {
                    sessionStorage.setItem('apple-redirect-pending', 'true');
                    await signInWithRedirect(auth, appleProvider);
                    return;
                } else {
                    throw popupErr;
                }
            }

            if (credUser) {
                const isAdmin = await verifyAdminStatus(credUser);

                if (!isAdmin) {
                    await signOut(auth);
                    submittingRef.current = false;
                    setIsAppleLoading(false);
                    const msg = `Access Denied: Your account (${credUser.email}) does not have administrator privileges. Only platform administrators are permitted to enter NexAdmin.`;
                    setError(msg);
                    showToast(msg, 'error');
                    return;
                }

                showToast('Welcome back, Administrator!', 'success');
                setRedirectTarget(getRedirectTarget());
            }
        } catch (err: any) {
            submittingRef.current = false;
            setIsAppleLoading(false);
            if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
                return;
            }
            console.error('Apple Sign-In error:', err?.code, err);
            const appleErrMap: Record<string, string> = {
                'auth/unauthorized-domain': 'This domain is not authorised in Firebase. Add it in Firebase Console → Authentication → Authorized Domains.',
                'auth/operation-not-allowed': 'Apple Sign-In is not enabled. Enable it in Firebase Console → Authentication → Sign-in method → Apple.',
                'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
                'auth/network-request-failed': 'Network error. Check your connection and try again.',
                'auth/popup-blocked': 'Popup was blocked by the browser. Please allow popups for this site and try again.',
            };
            const errMsg = appleErrMap[err?.code] || `Apple Sign-In failed (${err?.code || 'unknown'}). Please try again.`;
            setError(errMsg);
            showToast(errMsg, 'error');
        }
    };

    const handleForgotPassword = async () => {
        if (!email || !email.includes('@')) {
            showToast('Please enter a valid email address first', 'warning');
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            showToast('Password reset link sent to your email!', 'success');
        } catch (err: any) {
            console.error('Password reset error:', err);
            showToast(err.message || 'Failed to send reset link', 'error');
        }
    };

    return (
        <>
        <Seo
            title="Admin Login | NexPlay"
            description="Log in to the NexPlay Admin Command Center."
            canonicalPath="/login"
            noindex
        />
        <div className="min-h-[100dvh] flex items-center justify-center p-4 md:p-8 bg-black">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full"
            >
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/25 mb-4 shadow-lg shadow-red-500/10">
                        <ShieldAlert className="w-10 h-10 text-red-400" />
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-[10px] font-black uppercase tracking-widest text-red-400 mb-3">
                        <ShieldAlert className="w-3 h-3" />
                        Restricted Access • NexPlay Admin Suite
                    </div>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight uppercase mb-2">
                        Admin Command Center
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-sm mx-auto">
                        This portal is strictly restricted to verified platform administrators. Player and Organizer accounts cannot sign in here.
                    </p>
                </div>

                <div className="bg-card/50 border border-gray-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Administrator Email</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-500 transition">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-14 pr-6 py-4 bg-black border border-gray-800 rounded-2xl text-white placeholder-gray-700 focus:focus-visible:outline-none focus:border-brand-500 transition font-bold"
                                    placeholder="admin@nexplay.gg"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2 ml-1">
                                <label htmlFor="password" className="block text-xs font-black text-gray-500 uppercase tracking-widest">Password</label>
                                <button 
                                    type="button"
                                    onClick={handleForgotPassword}
                                    className="text-xs font-black text-brand-500 hover:text-brand-400 uppercase tracking-widest transition"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-500 transition">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-14 pr-14 py-4 bg-black border border-gray-800 rounded-2xl text-white placeholder-gray-700 focus:focus-visible:outline-none focus:border-brand-500 transition font-bold"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-5 flex items-center text-gray-500 hover:text-white transition"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl text-xs font-bold leading-relaxed flex items-start gap-3"
                            >
                                <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <div>{error}</div>
                            </motion.div>
                        )}

                        {authError && user && (
                            <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex flex-col gap-3"
                            >
                                <span>{authError}</span>
                                <button
                                    type="button"
                                    onClick={() => retryAuth()}
                                    className="self-start text-white bg-amber-500/20 hover:bg-amber-500/30 px-4 py-2 rounded-xl transition"
                                >
                                    Retry
                                </button>
                            </motion.div>
                        )}

                        {recaptchaSiteKey ? (
                            <div className="text-center text-[11px] text-slate-500">
                                Protected by Google reCAPTCHA Enterprise. <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline hover:text-slate-400">Privacy</a> & <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="underline hover:text-slate-400">Terms</a>.
                            </div>
                        ) : null}

                        <button
                            type="submit"
                            disabled={isLoading || isGoogleLoading || !!user}
                            className="w-full flex items-center justify-center py-5 px-6 rounded-2xl text-sm font-black text-white bg-brand-500 hover:bg-brand-400 focus:focus-visible:outline-none transition disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest shadow-lg shadow-brand-500/20 cursor-pointer"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    Admin Sign In <ArrowRight className="ml-2 w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="flex-1 border-t border-gray-800"></div>
                            <span className="text-xs font-black text-gray-600 uppercase tracking-widest">Or continue with</span>
                            <div className="flex-1 border-t border-gray-800"></div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading || isGoogleLoading || isAppleLoading || !!user}
                            className="w-full flex items-center justify-center py-5 px-6 border border-gray-800 rounded-2xl bg-black text-sm font-black text-white hover:bg-card focus:focus-visible:outline-none transition disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest cursor-pointer"
                        >
                            {isGoogleLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                        <path
                                            fill="currentColor"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="#34A853"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="#FBBC05"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        />
                                        <path
                                            fill="#EA4335"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                    Google Admin Sign In
                                </>
                            )}
                        </button>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-800 text-center space-y-3">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                            Not a NexPlay Platform Administrator?
                        </p>
                        <div className="flex flex-wrap justify-center items-center gap-3 text-xs font-black">
                            <a
                                href="https://www.nexplayorg.app"
                                className="px-3.5 py-2 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 transition uppercase tracking-wider flex items-center gap-1"
                            >
                                🎮 Player Portal →
                            </a>
                            <a
                                href="https://nexorg-lyart.vercel.app/"
                                className="px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition uppercase tracking-wider flex items-center gap-1"
                            >
                                🏢 Organizer Portal →
                            </a>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
        </>
    );
};

export default Login;
