'use client';

import { useState } from 'react';

interface Props { onSubmit: (name: string, email?: string) => void; }

export default function UsernameModal({ onSubmit }: Props) {
  const [step,   setStep]   = useState<'splash' | 'handle'>('splash');
  const [handle, setHandle] = useState('');
  const [email,  setEmail]  = useState('');

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
                You Know<br /><span style={{ color: '#facc15' }}>Ball</span>
              </h1>
            </div>
            <button
              onClick={() => setStep('handle')}
              className="px-10 py-3.5 rounded-xl bg-white text-black font-black text-base hover:bg-white/90 active:scale-[0.98] transition-all"
            >
              Let&apos;s find out
            </button>
            <p className="text-white/20 text-xs font-mono">NBA stats trivia · daily lockout by tier</p>
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
