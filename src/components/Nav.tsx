'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const LINKS = [
  { href: '/',             label: 'Play'        },
  { href: '/leaderboard',  label: 'Leaderboard' },
  { href: '/patch-notes',  label: "What's New"  },
  { href: '/contact',      label: 'Contact'     },
];

export default function Nav() {
  const path = usePathname();
  const [isAdmin, setIsAdmin] = useState(() => typeof window !== 'undefined' && localStorage.getItem('ykb_admin') === '1');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'YKB_ADMIN_2026') {
      localStorage.setItem('ykb_admin', '1');
      setIsAdmin(true);
    }
  }, []);

  function resetSession() {
    if (confirm('Reset your handle and stats?')) {
      localStorage.clear();
      window.location.href = '/';
    }
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-white/[0.07] backdrop-blur-md bg-[#08080d]/90">
      <div className="max-w-3xl mx-auto px-5 h-13 flex items-center gap-7">
        <Link href="/" className="font-black text-base tracking-widest text-white mr-3 hover:text-white/80 transition-colors">
          YKB
        </Link>
        {LINKS.map(l => (
          <Link key={l.href} href={l.href}
            className={[
              'text-sm transition-colors',
              path === l.href ? 'text-white font-semibold' : 'text-white/40 hover:text-white/75',
            ].join(' ')}>
            {l.label}
          </Link>
        ))}
        <div className="flex-1" />
        {isAdmin && (
          <span className="text-[9px] font-sans text-violet-400/60 border border-violet-500/30 rounded px-1.5 py-0.5">
            ADMIN
          </span>
        )}
        <button onClick={resetSession}
          className="text-xs text-white/25 hover:text-white/50 transition-colors font-sans">
          reset
        </button>
      </div>
    </nav>
  );
}
