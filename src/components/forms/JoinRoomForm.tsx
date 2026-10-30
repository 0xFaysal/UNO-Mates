'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProfileFields } from '@/components/ui/ProfileFields';
import { AVATAR_COLORS } from '@/components/ui/AvatarPicker';
import { chooseNickname } from '@/lib/game/nicknames';
import { readProfile, saveProfile } from '@/lib/client/profile';
import { errorMessage } from '@/lib/errors';
import { forgetRoomCredentials } from '@/lib/client/room-credentials';
import { playCue } from '@/lib/client/sound';

export function JoinRoomForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialCode = params.get('code') || '';
  const submitting = useRef(false);

  const [nickname, setNickname] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[1]);
  const [code, setCode] = useState(initialCode.toUpperCase().slice(0, 6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error) playCue('error');
  }, [error]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = readProfile();
      setNickname(chooseNickname(saved.name));
      if (saved.color && AVATAR_COLORS.includes(saved.color)) setColor(saved.color);
      setCode(initialCode.toUpperCase().slice(0, 6));
    });
    return () => cancelAnimationFrame(frame);
  }, [initialCode]);

  async function join(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      setError('Enter the 6-character room code.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    const name = chooseNickname(nickname);
    saveProfile(name, color);
    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalized, name, avatarColor: color }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(errorMessage(data.error, 'Could not join the room.'));
      forgetRoomCredentials(data.roomCode);
      router.push('/room/' + data.roomCode);
    } catch (err) {
      setError(errorMessage(err, 'Could not reach the table. Please try again.'));
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="site-panel space-y-5">
      <div>
        <h1 className="form-card-title">Your seat is waiting.</h1>
        <p className="text-sm text-slate-400 mt-2">Enter your invite code and join the table.</p>
      </div>
      {params.get('removed') === '1' && (
        <p role="status" className="text-sm text-slate-300 leading-relaxed">
          Your previous seat is no longer in this room. You can join again with the code below.
        </p>
      )}
      {error && (
        <p id="join-error" role="alert" className="form-error">
          {error}
        </p>
      )}
      <form noValidate onSubmit={join} className="space-y-5">
        <div className="profile-field">
          <label htmlFor="join-code" className="block mb-2">
            Room code
          </label>
          <input
            id="join-code"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. A9B2X4"
            disabled={busy}
            aria-describedby={error ? 'join-error' : undefined}
            className="w-full bg-slate-950 text-white font-bold text-center tracking-widest px-4 py-3 rounded-2xl border border-slate-700 uppercase"
          />
        </div>
        <ProfileFields
          prefix="join"
          nickname={nickname}
          onNicknameChange={setNickname}
          color={color}
          onColorChange={setColor}
          disabled={busy}
        />
        <button type="submit" disabled={busy} className="brand-primary w-full py-4 rounded-2xl font-bold">
          {busy ? 'Joining your mates…' : 'Join Game Room'}
        </button>
      </form>
    </div>
  );
}
