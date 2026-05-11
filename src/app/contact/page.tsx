import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact · Do You Know Ball?',
  description: 'Get in touch with the creator of Do You Know Ball?',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#08080d] text-white flex items-center justify-center px-5">
      <div className="max-w-sm w-full text-center">

        <p className="text-5xl mb-6">🏀</p>

        <h1 className="text-3xl font-black mb-2">Hi, I&apos;m Michael Chheng</h1>
        <p className="text-white/40 text-base mb-8">
          Connecting those with ball knowledge.
        </p>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left space-y-4 mb-8">
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Email</p>
            <a
              href="mailto:work.michaelchheng@gmail.com"
              className="text-yellow-400 font-semibold hover:text-yellow-300 transition-colors break-all"
            >
              work.michaelchheng@gmail.com
            </a>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">About</p>
            <p className="text-white/60 text-sm leading-relaxed">
              Built this for the fans who live and breathe the game — the ones who can tell you stats from 2007
              and still win arguments about the GOAT. If you have ideas, feedback, or just want to talk hoops, reach out.
            </p>
          </div>
        </div>

        <a
          href="/"
          className="inline-block px-8 py-3 rounded-xl bg-yellow-400 text-black font-black text-sm hover:bg-yellow-300 transition-all"
        >
          ← Back to the game
        </a>

      </div>
    </main>
  );
}
