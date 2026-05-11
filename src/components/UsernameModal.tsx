'use client';

import { useState } from 'react';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { pullFromFirestore, saveUsername } from '@/lib/tierSync';

interface Props { onSubmit: (name: string) => void; }

const TIERS = ['easy','medium','hard','unhinged'] as const;

async function syncAndSubmit(uid: string, name: string, onSubmit: (n: string) => void) {
  localStorage.setItem('ykb_uid',      uid);
  localStorage.setItem('ykb_username', name);
  await Promise.all([
    saveUsername(uid, name),
    ...TIERS.map(t => pullFromFirestore(uid, t)),
  ]);
  onSubmit(name);
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function UsernameModal({ onSubmit }: Props) {
  const [step,     setStep]     = useState<'splash' | 'email' | 'guest' | 'pick-handle'>('splash');
  const [mode,     setMode]     = useState<'signup' | 'login'>('signup');
  const [handle,   setHandle]   = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [pendingUid, setPendingUid] = useState('');

  async function signInGoogle() {
    setLoading(true); setError('');
    try {
      const r    = await signInWithPopup(auth, googleProvider);
      const suggested = (r.user.displayName || r.user.email?.split('@')[0] || 'Player').slice(0, 20);
      setPendingUid(r.user.uid);
      setHandle(suggested);
      await Promise.all(TIERS.map(t => pullFromFirestore(r.user.uid, t)));
      setStep('pick-handle');
    } catch (e: unknown) {
      const msg = (e as { code?: string }).code;
      setError(msg === 'auth/popup-closed-by-user' ? 'Popup closed.' : 'Google sign-in failed. Try again.');
    } finally { setLoading(false); }
  }

  async function confirmHandle() {
    const h = handle.trim();
    if (h.length < 2) { setError('Pick a handle (2+ chars).'); return; }
    await syncAndSubmit(pendingUid, h, onSubmit);
  }

  async function submitEmail() {
    const h = handle.trim();
    const em = email.trim();
    const pw = password;
    if (!em || pw.length < 6) { setError('Need email + password (6+ chars).'); return; }
    if (mode === 'signup' && h.length < 2) { setError('Pick a handle (2+ chars).'); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'signup') {
        const r = await createUserWithEmailAndPassword(auth, em, pw);
        await updateProfile(r.user, { displayName: h });
        await syncAndSubmit(r.user.uid, h, onSubmit);
      } else {
        const r = await signInWithEmailAndPassword(auth, em, pw);
        const name = (r.user.displayName || r.user.email?.split('@')[0] || 'Player').slice(0, 20);
        await syncAndSubmit(r.user.uid, name, onSubmit);
      }
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/email-already-in-use') setError('Account exists — try logging in.');
      else if (code === 'auth/user-not-found' || code === 'auth/wrong-password') setError('Wrong email or password.');
      else setError('Something went wrong. Try again.');
    } finally { setLoading(false); }
  }

  function submitGuest() {
    const h = handle.trim();
    if (h.length < 2) return;
    localStorage.setItem('ykb_username', h);
    onSubmit(h);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08080d]">
      <div className="w-full max-w-sm mx-4 text-center">

        {/* ── SPLASH ── */}
        {step === 'splash' && (
          <div className="space-y-8">
            <h1 className="text-[clamp(3rem,12vw,5rem)] font-black tracking-tighter leading-none text-white">
              Do You Know<br /><span style={{ color: '#facc15' }}>Ball?</span>
            </h1>
            <div className="flex flex-col gap-3">
              <button onClick={signInGoogle} disabled={loading}
                className="flex items-center justify-center gap-3 w-full px-6 py-3.5 rounded-xl bg-white text-black font-black text-sm hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50">
                <GoogleIcon />
                {loading ? 'Signing in…' : 'Continue with Google'}
              </button>
              <button onClick={() => { setMode('signup'); setStep('email'); }}
                className="w-full px-6 py-3.5 rounded-xl border border-white/15 text-white/70 font-semibold text-sm hover:text-white hover:border-white/30 transition-all">
                Sign up with email
              </button>
              <button onClick={() => { setMode('login'); setStep('email'); }}
                className="w-full px-6 py-3 rounded-xl text-white/35 font-medium text-sm hover:text-white/60 transition-all">
                Log in
              </button>
              <button onClick={() => setStep('guest')}
                className="w-full px-6 py-2.5 rounded-xl text-white/20 text-xs hover:text-white/40 transition-all">
                Play as guest (no stats saved)
              </button>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <p className="text-white/30 text-sm">NBA stats trivia · daily lockout by tier</p>
          </div>
        )}

        {/* ── EMAIL SIGN UP / LOG IN ── */}
        {step === 'email' && (
          <div className="space-y-5 text-left">
            <div className="text-center">
              <h2 className="text-2xl font-black text-white">{mode === 'signup' ? 'Create account' : 'Welcome back'}</h2>
              <p className="text-white/35 text-sm mt-1">{mode === 'signup' ? 'Your streak saves across devices.' : 'Pick up where you left off.'}</p>
            </div>
            <div className="space-y-2.5">
              {mode === 'signup' && (
                <input type="text" value={handle} onChange={e => setHandle(e.target.value)}
                  placeholder="Handle (e.g. CourtVision)" maxLength={20} autoFocus
                  className="w-full bg-white/5 border border-white/12 rounded-lg px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/30 transition-colors" />
              )}
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email" autoFocus={mode === 'login'}
                className="w-full bg-white/5 border border-white/12 rounded-lg px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/30 transition-colors" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitEmail()}
                placeholder="Password (6+ characters)"
                className="w-full bg-white/5 border border-white/12 rounded-lg px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/30 transition-colors" />
            </div>
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <button onClick={submitEmail} disabled={loading}
              className="w-full py-3 rounded-lg bg-white text-black font-bold text-sm disabled:opacity-25 hover:bg-white/90 transition-all">
              {loading ? '…' : mode === 'signup' ? 'Create Account' : 'Log In'}
            </button>
            <div className="text-center space-y-2">
              <p className="text-white/30 text-xs">
                {mode === 'signup' ? 'Already have an account?' : "Don't have one?"}{' '}
                <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}
                  className="text-yellow-400 hover:text-yellow-300 underline">
                  {mode === 'signup' ? 'Log in' : 'Sign up'}
                </button>
              </p>
              <button onClick={() => { setStep('splash'); setError(''); }}
                className="text-white/20 text-xs hover:text-white/40 transition-colors">← back</button>
            </div>
          </div>
        )}

        {/* ── PICK HANDLE (after Google sign-in) ── */}
        {step === 'pick-handle' && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-2xl font-black text-white">Pick your handle</h2>
              <p className="text-white/35 text-sm mt-1">This is how you&apos;ll appear on the leaderboard.</p>
            </div>
            <input type="text" value={handle} onChange={e => setHandle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmHandle()}
              placeholder="e.g. CourtVision" maxLength={20} autoFocus
              className="w-full bg-white/5 border border-white/12 rounded-lg px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/30 transition-colors" />
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <button onClick={confirmHandle} disabled={handle.trim().length < 2}
              className="w-full py-3 rounded-lg bg-white text-black font-bold text-sm disabled:opacity-25 hover:bg-white/90 transition-all">
              Let&apos;s go
            </button>
          </div>
        )}

        {/* ── GUEST ── */}
        {step === 'guest' && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-2xl font-black text-white">Pick a handle</h2>
              <p className="text-white/35 text-sm mt-1">Stats won&apos;t save across devices.</p>
            </div>
            <input type="text" value={handle} onChange={e => setHandle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitGuest()}
              placeholder="e.g. CourtVision" maxLength={20} autoFocus
              className="w-full bg-white/5 border border-white/12 rounded-lg px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/30 transition-colors" />
            <button onClick={submitGuest} disabled={handle.trim().length < 2}
              className="w-full py-3 rounded-lg bg-white text-black font-bold text-sm disabled:opacity-25 hover:bg-white/90 transition-all">
              Start Playing
            </button>
            <button onClick={() => { setStep('splash'); setError(''); }}
              className="text-white/20 text-xs hover:text-white/40 transition-colors">← back</button>
          </div>
        )}

      </div>
    </div>
  );
}
