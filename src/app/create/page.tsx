import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/brand/SiteHeader';
import { CreateRoomForm } from '@/components/forms/CreateRoomForm';

export const metadata: Metadata = {
  title: 'Create Private UNO Room',
  description:
    'Create a free private multiplayer UNO room for up to 10 friends. Choose custom house rules and start playing online in seconds.',
  keywords: [
    'Create UNO room',
    'Host UNO game',
    'Private UNO table',
    'Multiplayer UNO room',
    'Play UNO online free',
  ],
  alternates: {
    canonical: '/create',
  },
};

export default function CreateRoomPage() {
  return (
    <div className="site-page min-h-screen text-white p-4 sm:p-6 flex flex-col">
      <SiteHeader back />
      <main className="max-w-md w-full mx-auto my-auto py-6">
        <CreateRoomForm />
      </main>
      <SiteFooter />
    </div>
  );
}
