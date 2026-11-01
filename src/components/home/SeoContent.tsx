import { BookOpen, Sparkles, ShieldCheck, Zap, HelpCircle } from 'lucide-react';
import Link from 'next/link';

export function SeoContent() {
  return (
    <section
      aria-label="About UNO Mates Multiplayer Card Game"
      className="w-full max-w-2xl mx-auto mt-12 mb-8 space-y-10 text-slate-300"
    >
      {/* Intro Feature Overview */}
      <div className="site-panel space-y-4 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 text-xs font-semibold">
          <Sparkles size={14} aria-hidden="true" />
          <span>The Ultimate Free Multiplayer UNO Experience</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Play UNO Online with Friends — Free Multiplayer Card Table
        </h2>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Welcome to <strong className="text-yellow-400">UNO Mates</strong>, the modern browser-based card room built for real friends and genuine game nights. No app store downloads, no annoying account registrations, and no paywalls. Just generate an instant 6-letter room code, invite up to 9 mates, and deal the deck right away.
        </p>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400 mb-3">
            <Zap size={20} aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-white">Stacking House Rules (+2 &amp; +4)</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Stack any +2 or +4 on +2; only +4 can answer +4. Take the full penalty or keep the chain going. Finish with a number card and play for your finishing rank.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400 mb-3">
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-white">Instant Private Rooms</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Create an exclusive private table in 1 click. Share your custom invitation link or 6-letter code with friends on Discord, WhatsApp, or Messenger for immediate play.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="w-10 h-10 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center text-blue-400 mb-3">
            <BookOpen size={20} aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-white">Live Round-Table &amp; Turn Clock</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Watch real-time seat rotations, turn indicators, table emojis, and a responsive turn clock to keep the match moving briskly with up to 10 players.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="w-10 h-10 rounded-xl bg-purple-400/10 border border-purple-400/20 flex items-center justify-center text-purple-400 mb-3">
            <Sparkles size={20} aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-white">AI Computer Bots</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Solo practice or missing a fourth player? Fill empty seats with intelligent AI bots that mimic realistic player decisions, color calls, and stacking strategies.
          </p>
        </div>
      </div>

      {/* How To Play Step Guide */}
      <div className="site-panel space-y-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span>How to Play Multiplayer UNO Online on UNO Mates</span>
        </h3>
        <ol className="space-y-3 text-sm text-slate-300">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-400 text-slate-950 font-bold text-xs flex items-center justify-center mt-0.5">
              1
            </span>
            <div>
              <strong className="text-white">Create a Private Room:</strong> Choose your nickname, pick an avatar color, and hit &ldquo;Create Private Room&rdquo; to launch your table.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-400 text-slate-950 font-bold text-xs flex items-center justify-center mt-0.5">
              2
            </span>
            <div>
              <strong className="text-white">Invite Your Friends:</strong> Share the generated 6-letter room code or click the invite link to let friends join directly from mobile or desktop.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-400 text-slate-950 font-bold text-xs flex items-center justify-center mt-0.5">
              3
            </span>
            <div>
              <strong className="text-white">Get Ready &amp; Play:</strong> Choose your seats, add robot mates if you like, and get everyone ready. The host starts the game with our shared house rules.
            </div>
          </li>
        </ol>
        <div className="pt-2">
          <Link
            href="/rules"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-400 hover:text-yellow-300 underline underline-offset-4"
          >
            Read the complete UNO Mates House Rules Guide &rarr;
          </Link>
        </div>
      </div>

      {/* FAQ Rich Snippets Accordion */}
      <div className="site-panel space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle size={22} className="text-yellow-400 shrink-0" aria-hidden="true" />
          <h3 className="text-xl font-bold text-white">Frequently Asked Questions (FAQ)</h3>
        </div>

        <div className="space-y-3">
          <details className="group rounded-xl border border-slate-800 bg-slate-900/60 p-4 open:bg-slate-900/90 transition-colors">
            <summary className="font-semibold text-white text-sm cursor-pointer list-none flex items-center justify-between">
              <span>Is UNO Mates completely free to play?</span>
              <span className="text-yellow-400 font-bold group-open:rotate-180 transition-transform">
                &darr;
              </span>
            </summary>
            <p className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Yes, 100%! UNO Mates is completely free with no microtransactions, paywalls, or forced account creation. You can play unlimited matches with your friends anytime.
            </p>
          </details>

          <details className="group rounded-xl border border-slate-800 bg-slate-900/60 p-4 open:bg-slate-900/90 transition-colors">
            <summary className="font-semibold text-white text-sm cursor-pointer list-none flex items-center justify-between">
              <span>How many players can join a game?</span>
              <span className="text-yellow-400 font-bold group-open:rotate-180 transition-transform">
                &darr;
              </span>
            </summary>
            <p className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed">
              UNO Mates supports from 2 up to 10 players in a single private room. You can also mix real friends and computer AI players at the same table.
            </p>
          </details>

          <details className="group rounded-xl border border-slate-800 bg-slate-900/60 p-4 open:bg-slate-900/90 transition-colors">
            <summary className="font-semibold text-white text-sm cursor-pointer list-none flex items-center justify-between">
              <span>Does UNO Mates work on smartphones and tablets?</span>
              <span className="text-yellow-400 font-bold group-open:rotate-180 transition-transform">
                &darr;
              </span>
            </summary>
            <p className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Yes! The game is fully responsive and supports touch gestures on iOS (iPhone &amp; iPad) and Android Chrome, Safari, Firefox, and Edge browsers. You can even install it as a PWA app on your home screen.
            </p>
          </details>

          <details className="group rounded-xl border border-slate-800 bg-slate-900/60 p-4 open:bg-slate-900/90 transition-colors">
            <summary className="font-semibold text-white text-sm cursor-pointer list-none flex items-center justify-between">
              <span>Can we stack Draw Two (+2) and Wild Draw Four (+4) cards?</span>
              <span className="text-yellow-400 font-bold group-open:rotate-180 transition-transform">
                &darr;
              </span>
            </summary>
            <p className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Yes! Stacking is fully supported. If a player puts down a +2, you can respond with another +2 to pass a +4 penalty to the next person. The room host can customize this rule before dealing.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
