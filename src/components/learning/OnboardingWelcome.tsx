'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Bot,ArrowRight,BookOpen,Check} from 'lucide-react';
import Link from 'next/link';
import {GameDialog} from '@/components/ui/GameDialog';
import {loadLearning,readLearning,saveLearning} from '@/lib/client/learning';
import {safeLearningReturn,terminalLearning,type LearningProfile} from '@/lib/learning-contract';
import {playInteraction} from '@/lib/client/sound';
import './learning.css';
export function OnboardingWelcome(){
 const [profile,setProfile]=useState<LearningProfile|null>(null),[open,setOpen]=useState(false);const router=useRouter();
 useEffect(()=>{let cancelled=false;void loadLearning(true).then(value=>{if(!cancelled){const local=readLearning();setProfile(local&&terminalLearning(local.status)?local:value);setOpen(value.showOffer&&!(local&&terminalLearning(local.status)));}});
  const sync=()=>{const local=readLearning();if(local&&terminalLearning(local.status)){setProfile(local);setOpen(false);}};
  window.addEventListener('storage',sync);document.addEventListener('visibilitychange',sync);return()=>{cancelled=true;window.removeEventListener('storage',sync);document.removeEventListener('visibilitychange',sync);};},[]);
 const path=()=>safeLearningReturn(location.pathname+(location.pathname==='/join'?location.search:''));
 const skip=()=>{setOpen(false);setProfile({status:'skipped',lesson:profile?.lesson||0,showOffer:false});void saveLearning('skipped',profile?.lesson||0);};
 const learn=()=>{playInteraction('join');setOpen(false);void saveLearning('progress',profile?.lesson||0);router.push('/learn?returnTo='+encodeURIComponent(path()));};
 return <>{profile?.status==='in_progress'&&!open&&<div className="learning-resume"><Bot size={22}/><div><strong>তোমার practice বাকি আছে</strong><span>নিজের গতিতে শিখে নাও।</span></div><button onClick={learn}>Continue <ArrowRight size={15}/></button><button className="learning-resume-skip" onClick={skip} aria-label="Dismiss learning reminder">Skip</button></div>}
  <GameDialog open={open} titleId="learning-welcome-title" onClose={skip}><section className="dialog-panel learning-welcome" lang="bn"><div className="learning-coach-avatar"><Bot size={30}/></div><p className="learning-eyebrow">তোমার প্রথম টেবিল</p><h2 id="learning-welcome-title">খেলতে খেলতেই শিখে নাও।</h2><p>Mango Bot তোমাকে একবারে একটি নিয়ম শেখাবে। ভুল করলে সমস্যা নেই—এটা শুধু practice।</p><ul><li><Check size={17}/>কার্ড মিলিয়ে চাল দেওয়া</li><li><Check size={17}/>+2 / +4, UNO ও Catch</li><li><Check size={17}/>Timer, bot, chat ও বন্ধুদের lobby</li></ul><button className="learning-primary" onClick={learn}>শেখা শুরু করি <ArrowRight size={18}/></button><button className="learning-skip" onClick={skip}>আমি খেলতে চাই · Skip guide</button><small>একবার শেষ বা skip করলে নিজে থেকে আবার দেখাবে না।</small></section></GameDialog>
 </>;
}
export function LearningLink({returnTo='/'}:{returnTo?:string}){return <Link className="learning-entry-link" href={'/learn?returnTo='+encodeURIComponent(safeLearningReturn(returnTo))}><BookOpen size={17}/>Robot-এর সঙ্গে খেলা শিখি <ArrowRight size={15}/></Link>;}
