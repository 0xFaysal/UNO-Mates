'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, ShieldAlert, Award, AlertCircle } from 'lucide-react';

export default function RulesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex items-center justify-between pb-4 border-b border-slate-800">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <span className="text-sm font-black text-yellow-400 uppercase tracking-wider">
            Official Rules
          </span>
        </header>

        <div className="bg-slate-900/90 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 via-amber-500 to-yellow-400 flex items-center justify-center font-black text-slate-950 text-base shadow-md">
              UNO
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Classic UNO Rules</h1>
              <p className="text-xs text-slate-400">Standard 108-card deck rules</p>
            </div>
          </div>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-yellow-400 flex items-center gap-2">
              <Award className="w-4 h-4" />
              <span>1. Game Objective</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Be the first player to get rid of all the cards in your hand. The round ends immediately when a player legally plays their last card.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-red-400 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>2. Matching Cards</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              On your turn, match a card in your hand with the top card on the discard pile by:
            </p>
            <ul className="list-disc list-inside text-xs sm:text-sm text-slate-300 space-y-1 pl-2">
              <li><strong className="text-white">Color:</strong> Red, Yellow, Green, or Blue.</li>
              <li><strong className="text-white">Number:</strong> 0 through 9.</li>
              <li><strong className="text-white">Action symbol:</strong> Skip, Reverse, or Draw Two.</li>
              <li><strong className="text-white">Wild cards:</strong> Can be played on any card at any time.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-blue-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              <span>3. Action Cards</span>
            </h2>
            <div className="space-y-2 text-xs sm:text-sm text-slate-300">
              <p>• <strong className="text-white">Skip:</strong> The next player loses their turn.</p>
              <p>• <strong className="text-white">Reverse:</strong> Reverses play direction. In a 2-player game, Reverse behaves like a Skip.</p>
              <p>• <strong className="text-white">Draw Two (+2):</strong> Next player draws 2 cards and skips their turn.</p>
              <p>• <strong className="text-white">Wild:</strong> The player chooses the active color for upcoming turns.</p>
              <p>• <strong className="text-white">Wild Draw Four (+4):</strong> The player chooses the color. The targeted player draws 4 cards and loses their turn, unless they challenge!</p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>4. The Official +4 Challenge</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              You may only play Wild Draw Four if you hold NO cards matching the active color in play. The targeted player can challenge!
            </p>
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1">
              <p>• <strong className="text-emerald-400">If the challenge succeeds:</strong> The player who played the +4 was bluffing and must draw 4 cards! You draw zero.</p>
              <p>• <strong className="text-rose-400">If the challenge fails:</strong> The player played legally. You must draw 4 + 2 = 6 cards!</p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-emerald-400">
              5. Calling & Catching UNO
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              When you play down to 1 card, you must declare UNO! If an opponent catches you before you declare UNO, you must draw 2 penalty cards.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
