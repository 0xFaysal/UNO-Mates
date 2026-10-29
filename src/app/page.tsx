'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Users, Layers, Radio } from 'lucide-react';
import { Brand } from '@/components/brand/Brand';
import { SiteHeader, SiteFooter } from '@/components/brand/SiteHeader';
import { ProfileFields } from '@/components/ui/ProfileFields';
import { AVATAR_COLORS } from '@/components/ui/AvatarPicker';
import { chooseNickname } from '@/lib/game/nicknames';
import { readProfile, saveProfile } from '@/lib/client/profile';
import { errorMessage } from '@/lib/errors';
import { forgetRoomCredentials } from '@/lib/client/room-credentials';
import { playCue } from '@/lib/client/sound';

export default function HomePage() {
  const router = useRouter(); const submitting = useRef(false);
  const [nickname,setNickname]=useState(''); const [color,setColor]=useState(AVATAR_COLORS[0]);
  const [code,setCode]=useState(''); const [pending,setPending]=useState<'create'|'join'|null>(null); const [error,setError]=useState<string|null>(null);
  useEffect(()=>{if(error)playCue('error');},[error]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>{const saved=readProfile();setNickname(chooseNickname(saved.name));if(saved.color && AVATAR_COLORS.includes(saved.color))setColor(saved.color);});return()=>cancelAnimationFrame(frame);},[]);
  async function submit(kind:'create'|'join') {
    if(submitting.current)return;
    const roomCode=code.trim().toUpperCase();
    if(kind==='join'&&!/^[A-Z0-9]{6}$/.test(roomCode)){setError('Enter the 6-character room code.');return;}
    submitting.current=true;setPending(kind);setError(null);const name=chooseNickname(nickname);saveProfile(name,color);
    try{const response=await fetch('/api/rooms/'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,avatarColor:color,...(kind==='join'?{code:roomCode}:{})})});const data=await response.json();if(!response.ok)throw new Error(errorMessage(data.error,'Could not open your room. Try again.'));forgetRoomCredentials(data.roomCode);router.push('/room/'+data.roomCode);}
    catch(err){setError(errorMessage(err,'Could not reach the table. Check your connection and try again.'));submitting.current=false;setPending(null);}
  }
  return <div className="site-page min-h-screen text-white flex flex-col justify-between p-4 sm:p-6 font-sans">
    <SiteHeader rules />
    <main className="relative max-w-md w-full mx-auto my-auto py-6 space-y-6">
      <div className="brand-hero"><Brand size="hero" markOnly linked={false}/><h1>UNO <span>Mates</span></h1><p>Your friends. Your house rules.<br/>Pull up a chair and play with 2–10 mates.</p></div>
      {error&&<div id="home-error" role="alert" className="form-error">{error}</div>}
      <div className="profile-panel bg-slate-900 border border-slate-700 p-5 rounded-3xl"><ProfileFields prefix="home" nickname={nickname} onNicknameChange={setNickname} color={color} onColorChange={setColor} disabled={Boolean(pending)} descriptionId={error?'home-error':undefined}/></div>
      <div className="space-y-3"><button onClick={()=>submit('create')} disabled={Boolean(pending)} className="brand-primary w-full py-4 px-5 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2"><Play size={20} fill="currentColor" aria-hidden="true"/>{pending==='create'?'Creating your room…':'Create Private Room'}</button>
        <form noValidate onSubmit={(event:FormEvent)=>{event.preventDefault();void submit('join');}} className="flex gap-2"><label htmlFor="home-code" className="sr-only">Room code</label><input id="home-code" type="text" value={code} onChange={event=>setCode(event.target.value.toUpperCase())} placeholder="6-LETTER CODE" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={6} disabled={Boolean(pending)} aria-describedby={error?'home-error':undefined} className="min-w-0 flex-1 bg-slate-900 text-white font-bold text-center tracking-widest px-3 py-3.5 rounded-2xl border border-slate-700 uppercase"/><button type="submit" disabled={Boolean(pending)} className="px-5 rounded-2xl bg-slate-800 border border-slate-700 text-sm font-bold whitespace-nowrap">{pending==='join'?'Joining…':'Join Room'}</button></form>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400"><div><Users size={17} className="text-yellow-400 mx-auto mb-2" aria-hidden="true"/>2–10 friends</div><div><Radio size={17} className="text-yellow-400 mx-auto mb-2" aria-hidden="true"/>Live together</div><div><Layers size={17} className="text-yellow-400 mx-auto mb-2" aria-hidden="true"/>House rules</div></div>
    </main><SiteFooter/>
  </div>;
}
