import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/brand/SiteHeader';
import { PreferenceControls } from '@/components/game/PreferenceControls';
import {LearningLink} from '@/components/learning/OnboardingWelcome';

export const metadata: Metadata = {
  title: 'Sound & Audio Settings',
  description:
    'Customize your UNO Mates experience. Toggle sound effects, lo-fi procedural ambient music, and game table preferences.',
  alternates: {
    canonical: '/settings',
  },
};

export default function SettingsPage() {
  return (
    <div className="site-page min-h-screen p-4 sm:p-6 flex flex-col">
      <SiteHeader back />
      <main className="max-w-md w-full mx-auto py-6 flex-1">
        <section className="site-panel">
          <h1 className="form-card-title mb-2">Sound &amp; feedback</h1>
          <p className="text-sm text-slate-400 mb-6">Make this table feel like yours.</p>
          <PreferenceControls />
          <LearningLink returnTo="/settings"/>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
