import {LESSON_IDS,terminalLearning,type LearningProfile,type LearningStatus} from '../learning-contract';
import {readProfile} from './profile';
const key='uno-mates-learning-v1',cookie='uno_learning_v1';
const statuses=new Set<LearningStatus>(['offered','in_progress','completed','skipped','experienced']);
let pending:Promise<LearningProfile>|null=null,cached:LearningProfile|null=null,checked=0;
export function readLearning():LearningProfile|null{
 let stored:string|null=null;try{stored=localStorage.getItem(key);}catch{/* Cookies can still remember an explicit choice. */}
 try{
  const saved=stored||decodeURIComponent(document.cookie.split('; ').find(value=>value.startsWith(cookie+'='))?.split('=').slice(1).join('=')||'null');
  const data=JSON.parse(saved);return data&&statuses.has(data.status)&&Number.isInteger(data.lesson)&&data.lesson>=0&&data.lesson<=LESSON_IDS.length?{...data,showOffer:false}:null;
 }catch{return null;}
}
function save(profile:LearningProfile){
 const previous=readLearning();const value=previous&&terminalLearning(previous.status)&&!terminalLearning(profile.status)?previous:profile;
 try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Optional storage. */}
 try{document.cookie=cookie+'='+encodeURIComponent(JSON.stringify({status:value.status,lesson:value.lesson}))+'; Max-Age=31536000; Path=/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');}catch{/* Server profile remains available. */}
 return value;
}
async function post(operation:string,lesson=0,existing=false):Promise<LearningProfile>{
 const response=await fetch('/api/onboarding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,lesson,existing}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('Progress is saved locally.');return await response.json();
}
export function loadLearning(fresh=false):Promise<LearningProfile>{
 if(pending)return pending;if(!fresh&&cached&&Date.now()-checked<5000)return Promise.resolve({...cached,showOffer:false});
 pending=(async()=>{
  const local=readLearning();
  try{
   let profile=await post('status',0,!local&&Boolean(readProfile().name));
   const latest=readLearning()||local;
   if(latest&&terminalLearning(latest.status)&&!terminalLearning(profile.status))profile=await post(latest.status,latest.lesson);
   else if(latest?.status==='in_progress'&&!terminalLearning(profile.status)&&latest.lesson>profile.lesson)profile=await post('progress',latest.lesson);
   const showOffer=profile.showOffer&&!latest,saved=save(profile);cached={...saved,showOffer:showOffer&&Boolean(readLearning())};checked=Date.now();return cached;
  }catch{return local||{status:'offered',lesson:0,showOffer:false};}
 })().finally(()=>{pending=null;});return pending;
}
export async function saveLearning(operation:'progress'|'completed'|'skipped',lesson:number){
 const local=save({status:operation==='progress'?'in_progress':operation,lesson,showOffer:false});cached=local;checked=Date.now();
 try{const profile=await post(operation,lesson);cached=save(profile);return {profile:cached,synced:true};}catch{return {profile:local,synced:false};}
}
