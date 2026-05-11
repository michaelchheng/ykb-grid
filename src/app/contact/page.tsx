import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact · Do You Know Ball?',
  description: 'Get in touch with the creator of Do You Know Ball?',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#08080d] text-white flex items-center justify-center px-5">
      <div className="max-w-sm w-full text-center">

        <h1 className="text-3xl font-black mb-1">
          Hi, I&apos;m <span className="text-yellow-400">Michael</span>
        </h1>
        <p className="text-white/40 text-base mb-8">
          Connecting those with elite ball knowledge.
        </p>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left space-y-4 mb-8">
          <p className="text-white/50 text-sm leading-relaxed">
            Feel free to let me know if you like this idea, or want to help expand it.
          </p>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Email</p>
            <a
              href="mailto:work.michaelchheng@gmail.com"
              className="text-yellow-400 font-semibold hover:text-yellow-300 transition-colors break-all"
            >
              work.michaelchheng@gmail.com
            </a>
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
