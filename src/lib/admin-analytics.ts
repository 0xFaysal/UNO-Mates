import type {AdminStats,MatchSetupStats} from './admin-contract';
export type SetupGrouping='humans'|'seats'|'bots';
const dayFormatter=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Dhaka'});
export const analyticsDay=(timestamp:string)=>dayFormatter.format(new Date(timestamp));
const empty=(count:number)=>({count,started:0,completed:0,abandoned:0,plays:0,draws:0,timeouts:0,durationSeconds:0,sampleCount:0,completedPlays:0});
export function groupMatchSetups(setups:MatchSetupStats[],by:SetupGrouping){
 const rows=Array.from({length:10},(_,i)=>empty(by==='bots'?i:i+1));
 for(const setup of setups){
  const count=by==='seats'?setup.humans+setup.bots:setup[by],row=rows.find(row=>row.count===count);if(!row)continue;
  for(const key of ['started','completed','abandoned','plays','draws','timeouts','durationSeconds','sampleCount','completedPlays'] as const)row[key]+=setup[key];
 }
 return rows;
}
export function setupAverages(row:Pick<MatchSetupStats,'durationSeconds'|'sampleCount'|'completedPlays'>){
 return row.sampleCount?{seconds:row.durationSeconds/row.sampleCount,plays:row.completedPlays/row.sampleCount}:null;
}
export function analyticsCsv(stats:AdminStats){
 const activity='Date (Asia/Dhaka),Started,Completed,Abandoned\n'+stats.series.map(day=>[day.day,day.started,day.completed,day.abandoned].join(',')).join('\n');
 if(!stats.detailed)return activity;
 const breakdown=(setups:MatchSetupStats[])=>'Human players,Bots,Matches started,Completed,Everyone left,Card plays,Draws,Timeouts,Fully tracked completions,Avg seconds,Avg card plays\n'+setups.map(row=>{const avg=setupAverages(row);return [row.humans,row.bots,row.started,row.completed,row.abandoned,row.plays,row.draws,row.timeouts,row.sampleCount,avg?.seconds.toFixed(2)??'',avg?.plays.toFixed(2)??''].join(',');}).join('\n');
 const trackingDay=analyticsDay(stats.detailed.since);
 const audience='Date (Asia/Dhaka),New browser players,Returning browser players\n'+stats.detailed.visitors.series.map(day=>[day.day,day.day<trackingDay?'':day.newPlayers,day.day<trackingDay?'':day.returningPlayers].join(',')).join('\n');
 return activity+'\n\nMatch breakdown - last '+stats.detailed.days+' days\n'+breakdown(stats.detailed.setups)+'\n\nMatch breakdown - all recorded\n'+breakdown(stats.detailed.allTimeSetups||stats.detailed.setups)+'\n\nBrowser player activity\n'+audience;
}
