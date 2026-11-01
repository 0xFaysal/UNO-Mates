import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SiteHeader, SiteFooter } from '@/components/brand/SiteHeader';
import { JoinRoomForm } from '@/components/forms/JoinRoomForm';
import {OnboardingWelcome} from '@/components/learning/OnboardingWelcome';

export const metadata: Metadata = {
  title: 'Join UNO Game Room',
  description:
    'Enter your 6-letter room code to jump straight into an active multiplayer UNO card game table with your friends.',
  keywords: [
    'Join UNO room',
    'Enter UNO room code',
    'Play UNO with friends',
    'UNO invite code',
    'Multiplayer card room',
  ],
  alternates: {
    canonical: '/join',
  },
};

export default function JoinPage() {
  return (
    <div className="site-page min-h-screen text-white p-4 sm:p-6 flex flex-col">
      <SiteHeader back />
      <OnboardingWelcome/>
      <main className="max-w-md w-full mx-auto my-auto py-6">
        <Suspense
          fallback={
            <p role="status" className="text-center text-slate-400 py-12">
              Getting your invitation ready…
            </p>
          }
        >
          <JoinRoomForm />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
