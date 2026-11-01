export const LEARNING_VERSION=1;
export const LESSON_IDS=['welcome','color','number','skip','reverse','reverse-two','draw','draw-play','draw-pass','wild','stack-two','escalate','four-only','take-stack','uno','late-uno','catch','forgot','final-power','finish','timer','offline','empty','chat','reactions','settings','rules','lobby'] as const;
export type LessonId=typeof LESSON_IDS[number];
export type LearningStatus='offered'|'in_progress'|'completed'|'skipped'|'experienced';
export interface LearningProfile {status:LearningStatus;lesson:number;showOffer:boolean}
export const terminalLearning=(status:LearningStatus)=>['completed','skipped','experienced'].includes(status);
export function safeLearningReturn(value:string|null|undefined){
 if(!value)return '/';
 if(['/','/create','/join','/rules','/settings'].includes(value))return value;
 if(/^\/join\?code=[A-Z0-9]{6}$/.test(value))return value;
 if(/^\/room\/[A-Z0-9]{6}$/.test(value))return value;
 return '/';
}
