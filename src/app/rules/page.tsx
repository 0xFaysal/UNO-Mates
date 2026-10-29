'use client';

import React from 'react';
import { HouseRulesContent } from '@/components/game/HouseRulesContent';
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
            House Rules
          </span>
        </header>

        <div className="bg-slate-900/90 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 via-amber-500 to-yellow-400 flex items-center justify-center font-black text-slate-950 text-base shadow-md">
              UNO
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">UNO House Rules</h1>
              <p className="text-xs text-slate-400">Stack penalties. Finish with a number card.</p>
            </div>
          </div>

          <HouseRulesContent />
        </div>
      </div>
    </div>
  );
}
