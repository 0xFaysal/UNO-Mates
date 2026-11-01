import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/brand/SiteHeader';
import { HouseRulesContent } from '@/components/game/HouseRulesContent';
import { BookOpen } from 'lucide-react';
import {LearningLink} from '@/components/learning/OnboardingWelcome';

export const metadata: Metadata = {
  title: 'UNO Rules & House Rules Guide',
  description:
    'Learn UNO Mates house rules: +2/+4 stacking, UNO and Catch, twenty-second turns, number-card finishes and finishing ranks. Practise step by step with a robot.',
  keywords: [
    'UNO Rules',
    'UNO House Rules',
    'How to play UNO',
    'UNO card game rules',
    'UNO stacking rules',
    'UNO draw 4 rules',
    'UNO Mates robot practice',
    'Multiplayer UNO rules',
  ],
  alternates: {
    canonical: '/rules',
  },
  openGraph: {
    title: 'UNO Rules & House Rules Guide · UNO Mates',
    description:
      'Learn our +2/+4 stacking, UNO/Catch, number-card finishes and finishing ranks with a guided robot practice.',
  },
};

export default function RulesPage() {
  return (
    <div className="site-page min-h-screen p-4 sm:p-6 flex flex-col">
      <SiteHeader back />
      <main className="w-full max-w-2xl mx-auto py-6 flex-1">
        <div className="site-panel space-y-6">
          <div className="flex items-start gap-3">
            <BookOpen size={26} className="text-yellow-400 shrink-0 mt-1" aria-hidden="true" />
            <div>
              <h1 className="form-card-title">UNO Mates house rules</h1>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Stack penalties. Finish with a number. Play for your place.
              </p>
            </div>
          </div>
          <HouseRulesContent />
          <LearningLink returnTo="/rules"/>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
