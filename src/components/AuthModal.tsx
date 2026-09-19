import React, { useState } from 'react';
import { 
  auth, 
  googleProvider, 
  recordUserLogin,
  UserProfile 
} from '../lib/firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  ShieldCheck, 
  Crown, 
  CheckCircle2, 
  Sparkles, 
  Loader2,
  AlertCircle
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: UserProfile) => void;
  initialMode?: 'signin' | 'signup';
  isVipFlow?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signin',
  isVipFlow = false,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      const profile = await recordUserLogin(result.user);
      if (profile) {
        onSuccess(profile);
      }
      onClose();
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      setError(err?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (mode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name && userCredential.user) {
          await updateProfile(userCredential.user, { displayName: name });
        }
        const profile = await recordUserLogin(userCredential.user);
        if (profile) onSuccess(profile);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const profile = await recordUserLogin(userCredential.user);
        if (profile) onSuccess(profile);
      }

      onClose();
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please Sign In.');
      } else {
        setError(err.message || 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0d0d12] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl text-white overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1.5 mb-5">
          <div className="inline-flex p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-1">
            {isVipFlow ? <Crown className="w-6 h-6 text-amber-400" /> : <Sparkles className="w-6 h-6 text-cyan-400" />}
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {isVipFlow 
              ? 'Login to Activate VIP Pass' 
              : mode === 'signin' ? 'Welcome Back' : 'Create Creator Account'}
          </h2>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            {isVipFlow
              ? 'Your ₹99 VIP pass and lifetime perks will be permanently linked to your account'
              : 'Save your customized audio visualizers & access HD templates'}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 1-Click Google Sign In */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-xs flex items-center justify-center space-x-2.5 transition-all shadow-md active:scale-[0.99] cursor-pointer disabled:opacity-50 mb-4"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-800" />
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.93 6.72-4.93z"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-4">
          <div className="border-t border-zinc-800 w-full" />
          <span className="bg-[#0d0d12] px-3 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
            or with email
          </span>
          <div className="border-t border-zinc-800 w-full" />
        </div>

        {/* Email / Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Your Name
              </label>
              <div className="relative flex items-center">
                <User className="w-3.5 h-3.5 absolute left-3 text-zinc-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="w-3.5 h-3.5 absolute left-3 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@gmail.com"
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-3.5 h-3.5 absolute left-3 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.99] cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-4 text-center">
          {mode === 'signin' ? (
            <p className="text-xs text-zinc-400">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className="text-cyan-400 font-semibold hover:underline cursor-pointer"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p className="text-xs text-zinc-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className="text-cyan-400 font-semibold hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </p>
          )}
        </div>

        {/* Privacy Note */}
        <div className="mt-4 pt-3 border-t border-zinc-850 flex items-center justify-center space-x-1 text-[10px] text-zinc-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Secured with Google Cloud Firestore & Firebase Auth</span>
        </div>
      </div>
    </div>
  );
};
