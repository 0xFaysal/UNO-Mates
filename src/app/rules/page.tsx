import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/brand/SiteHeader';
import { HouseRulesContent } from '@/components/game/HouseRulesContent';
import { BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'UNO Rules & House Rules Guide',
  description:
    'Learn how to play UNO online with friends. Complete guide to official UNO rules, action cards, and UNO Mates house rules including +2/+4 stacking, 7-0 swaps, and jump-in.',
  keywords: [
    'UNO Rules',
    'UNO House Rules',
    'How to play UNO',
    'UNO card game rules',
    'UNO stacking rules',
    'UNO draw 4 rules',
    'UNO 7-0 rule',
    'Multiplayer UNO rules',
  ],
  alternates: {
    canonical: '/rules',
  },
  openGraph: {
    title: 'UNO Rules & House Rules Guide · UNO Mates',
    description:
      'Learn how to play UNO online with friends. Official UNO rules plus stacking +2 and +4, jump-in, and 7-0 swaps.',
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
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
