'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/brand/SiteHeader';
import { ProfileFields } from '@/components/ui/ProfileFields';
import { AVATAR_COLORS } from '@/components/ui/AvatarPicker';
import { chooseNickname } from '@/lib/game/nicknames';
import { readProfile, saveProfile } from '@/lib/client/profile';
import { errorMessage } from '@/lib/errors';
export default function CreateRoomPage(){
 const router=useRouter();const submitting=useRef(false);const [nickname,setNickname]=useState('');const [color,setColor]=useState(AVATAR_COLORS[0]);const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
 useEffect(()=>{const frame=requestAnimationFrame(()=>{const saved=readProfile();setNickname(chooseNickname(saved.name));if(saved.color&&AVATAR_COLORS.includes(saved.color))setColor(saved.color);});return()=>cancelAnimationFrame(frame);},[]);
 async function create(event:FormEvent){event.preventDefault();if(submitting.current)return;submitting.current=true;setBusy(true);setError(null);const name=chooseNickname(nickname);saveProfile(name,color);try{const response=await fetch('/api/rooms/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,avatarColor:color})});const data=await response.json();if(!response.ok)throw new Error(errorMessage(data.error,'Could not create the room.'));router.push('/room/'+data.roomCode);}catch(err){setError(errorMessage(err,'Could not reach the table. Please try again.'));submitting.current=false;setBusy(false);}}
 return <div className="site-page min-h-screen text-white p-4 sm:p-6 flex flex-col"><SiteHeader back/><main className="max-w-md w-full mx-auto my-auto py-6"><div className="site-panel space-y-5"><div><h1 className="form-card-title">Make room for your mates.</h1><p className="text-sm text-slate-400 mt-2 leading-relaxed">You’ll host the table. Bring up to nine friends.</p></div>{error&&<p role="alert" id="create-error" className="form-error">{error}</p>}<form noValidate onSubmit={create} className="space-y-5"><ProfileFields prefix="create" nickname={nickname} onNicknameChange={setNickname} color={color} onColorChange={setColor} disabled={busy} descriptionId={error?'create-error':undefined}/><button type="submit" disabled={busy} className="brand-primary w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2"><Play size={18} aria-hidden="true"/>{busy?'Creating your room…':'Create Room'}</button></form></div></main><SiteFooter/></div>;
}
