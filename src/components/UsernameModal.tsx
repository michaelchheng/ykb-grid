'use client';

import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { pullFromFirestore } from '@/lib/tierSync';

interface Props { onSubmit: (name: string, email?: string) => void; }

export default function UsernameModal({ onSubmit }: Props) {
  const [step,      setStep]      = useState<'splash' | 'handle'>('splash');
  const [handle,    setHandle]    = useState('');
  const [email,     setEmail]     = useState('');
  const [gLoading,  setGLoading]  = useState(false);
  const [gError,    setGError]    = useState('');

  async function signInWithGoogle() {
    setGLoading(true);
    setGError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user   = result.user;
      const uid    = user.uid;
      const name   = (user.displayName || user.email?.split('@')[0] || 'Player').slice(0, 20);
      localStorage.setItem('ykb_uid',      uid);
      localStorage.setItem('ykb_username', name);
      await Promise.all((['easy','medium','hard','unhinged'] as const).map(t => pullFromFirestore(uid, t)));
      onSubmit(name);
    } catch {
      setGError('Sign-in failed. Try again.');
    } finally {
      setGLoading(false);
    }
  }

  function submit() {
    const h = handle.trim();
    if (h.length < 2) return;
    onSubmit(h, email.trim() || undefined);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08080d]">
      <div className="w-full max-w-sm mx-4 text-center">

        {step === 'splash' ? (
          <div className="space-y-8">
            <div>
              <h1 className="text-[clamp(3rem,12vw,5rem)] font-black tracking-tighter leading-none text-white">
                Do You Know<br /><span style={{ color: '#facc15' }}>Ball?</span>
              </h1>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={signInWithGoogle}
                disabled={gLoading}
                className="flex items-center justify-center gap-3 w-full px-6 py-3.5 rounded-xl bg-white text-black font-black text-sm hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {gLoading ? 'Signing in…' : 'Continue with Google'}
              </button>
              <button
                onClick={() => setStep('handle')}
                className="px-10 py-3 rounded-xl border border-white/15 text-white/60 font-semibold text-sm hover:text-white hover:border-white/30 active:scale-[0.98] transition-all"
              >
                Play as guest
              </button>
            </div>
            {gError && <p className="text-red-400 text-xs">{gError}</p>}
            <p className="text-white/35 text-sm font-medium">NBA stats trivia · daily lockout by tier</p>
          </div>

        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-yellow-400/70 text-[10px] font-mono uppercase tracking-widest mb-3">You Know Ball</p>
              <h2 className="text-2xl font-black text-white">Create your account</h2>
              <p className="text-white/35 text-sm mt-1">Track your streak &amp; get notified when you unlock.</p>
            </div>

            <div className="space-y-2.5 text-left">
              <div>
                <label className="text-[10px] font-mono text-white/35 uppercase tracking-widest block mb-1.5">Handle</label>
                <input
                  type="text"
                  value={handle}
                  onChange={e => setHandle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  placeholder="e.g. CourtVision"
                  maxLength={20}
                  className="w-full bg-white/5 border border-white/12 rounded-lg px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/30 focus:bg-white/8 transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-white/35 uppercase tracking-widest block mb-1.5">
                  Email <span className="text-white/20 normal-case tracking-normal">— get notified when you unlock</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  placeholder="you@example.com (optional)"
                  className="w-full bg-white/5 border border-white/12 rounded-lg px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/30 focus:bg-white/8 transition-colors"
                />
              </div>
            </div>

            <button
              onClick={submit}
              disabled={handle.trim().length < 2}
              className="w-full py-3 rounded-lg bg-white text-black font-bold text-sm disabled:opacity-25 hover:bg-white/90 transition-all"
            >
              Start Playing
            </button>

            <button onClick={() => setStep('splash')} className="text-white/20 text-xs font-mono hover:text-white/40 transition-colors">← back</button>
          </div>
        )}

      </div>
    </div>
  );
}
