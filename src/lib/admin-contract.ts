import {z} from 'zod';
const password=z.string().min(1,'Enter a password.').max(72,'Use at most 72 characters.').refine(value=>new TextEncoder().encode(value).length<=72,'Use at most 72 bytes.');
export const adminLoginSchema=z.object({username:z.string().min(1).max(100),password});
export const adminPasswordSchema=z.object({current:password,next:password.refine(value=>Array.from(value).length>=12,'Use at least 12 characters.'),confirmation:z.string()}).refine(value=>value.next===value.confirmation,{message:'Passwords do not match.',path:['confirmation']});
export interface ActivityDay {day:string;started:number;completed:number;abandoned:number}
export interface LiveTable {code:string;status:string;online:number;bots:number;started:number|null}
export interface AdminStats {
 trackingSince:string;checkedAt:string;
 totals:{started:number;completed:number;abandoned:number;humanSeats:number;botSeats:number;durationSeconds:number;durationCount:number;plays:number;draws:number;timeouts:number};
 series:ActivityDay[];today:{started:number;completed:number;abandoned:number};storage:{rooms:number;waiting:number};
 cleanup:{active:boolean;schedule:string;lastStatus:string|null;lastRun:string|null}|null;
 live:{players:number;games:number;waiting:number;bots:number;checked:number;failed:number;truncated:boolean;tables:LiveTable[]};
}
