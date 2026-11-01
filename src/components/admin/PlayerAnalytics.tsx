'use client';
import {useState} from 'react';
import {Bot,Users,Clock3,ArrowUpRight} from 'lucide-react';
import type {DetailedAnalytics,MatchSetupStats} from '@/lib/admin-contract';
import {analyticsDay,groupMatchSetups,setupAverages,type SetupGrouping} from '@/lib/admin-analytics';

const number=(value:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(value);
const dayLabel=(day:string)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'Asia/Dhaka'}).format(new Date(day));
function elapsed(seconds:number){const value=Math.round(seconds);return value<60?value+'s':Math.floor(value/60)+'m '+(value%60)+'s';}
function AverageCells({row}:{row:MatchSetupStats|ReturnType<typeof groupMatchSetups>[number]}){
 const avg=setupAverages(row);return <><td>{avg?elapsed(avg.seconds):<span className="admin-muted">—</span>}</td><td>{avg?number(avg.plays):<span className="admin-muted">—</span>}</td></>;
}
export function PlayerAnalytics({data,loading}:{data:DetailedAnalytics|undefined;loading:boolean}){
 const [group,setGroup]=useState<SetupGrouping>('humans');
 const [allTime,setAllTime]=useState(true);
 if(!data)return <section className="admin-panel admin-detail-placeholder" aria-busy={loading}><h2>Players &amp; match breakdown</h2><p className="admin-small">{loading?'Loading player statistics…':'Detailed tracking is not available yet. Refresh to try again.'}</p></section>;
 const setups=allTime?(data.allTimeSetups||data.setups):data.setups,scope=allTime?'All recorded matches':'Last '+data.days+' days';
 const trackingDay=analyticsDay(data.since);
 const rows=groupMatchSetups(setups,group),visitors=data.visitors.today,total=visitors.newPlayers+visitors.returningPlayers;
 const ceiling=Math.max(1,...data.visitors.series.map(day=>day.newPlayers+day.returningPlayers));
 const sampleCount=setups.reduce((sum,row)=>sum+row.sampleCount,0),starts=setups.reduce((sum,row)=>sum+row.started,0);
 const botStarts=setups.filter(row=>row.bots>0).reduce((sum,row)=>sum+row.started,0);
 const labels={humans:'Human players',seats:'Total seats',bots:'Bots'};
 return <div className="admin-player-analytics" id="player-analytics">
  {Boolean(data.trackingIssues)&&<p className="admin-partial" role="status">{data.trackingIssues} stored rounds have incomplete analytics. Gameplay continues normally; incomplete rounds are excluded from averages.</p>}
  <section className="admin-panel admin-audience" aria-label="New and returning players" aria-busy={loading}>
   <div className="admin-panel-heading"><div><p className="admin-eyebrow">Familiar faces &amp; first games</p><h2>Who’s playing today</h2></div><Users size={21}/></div>
   <div className="admin-audience-today"><article><span><i className="is-new"/>New players</span><strong data-testid="new-players-today">{number(visitors.newPlayers)}</strong><small>First tracked play today</small></article><article><span><i/>Returning players</span><strong data-testid="returning-players-today">{number(visitors.returningPlayers)}</strong><small>Known from an earlier day</small></article><p><strong>{number(total)}</strong> browser players today <ArrowUpRight size={16}/></p></div>
   <div className="admin-cohort-heading"><span>Daily players · last {data.days} days</span><div className="admin-cohort-legend"><span><i className="is-new"/>New</span><span><i/>Returning</span></div></div>
   <div className="admin-cohort-chart" role="img" aria-label={'New and returning browser players over '+data.days+' days. Exact counts are in View player activity.'}>
    {data.visitors.series.map((day,index)=><div className="admin-cohort-column" key={day.day}><div className="admin-cohort-bar" style={{height:(day.newPlayers+day.returningPlayers)/ceiling*100+'%'}}><span className="is-returning" style={{flexGrow:day.returningPlayers}}/><span className="is-new" style={{flexGrow:day.newPlayers}}/></div><span className="admin-cohort-date">{(index===0||index===data.visitors.series.length-1||index%Math.ceil(data.days/4)===0)?dayLabel(day.day):''}</span></div>)}
   </div>
   <details className="admin-data-details"><summary>View player activity</summary><div className="admin-data-scroll"><table><caption className="sr-only">Unique browser players by Bangladesh calendar day</caption><thead><tr><th scope="col">Date</th><th scope="col">New</th><th scope="col">Returning</th><th scope="col">Total</th></tr></thead><tbody>{data.visitors.series.map(day=><tr key={day.day}><th scope="row">{dayLabel(day.day)}</th><td>{day.day<trackingDay?'—':number(day.newPlayers)}</td><td>{day.day<trackingDay?'—':number(day.returningPlayers)}</td><td>{day.day<trackingDay?'—':number(day.newPlayers+day.returningPlayers)}</td></tr>)}</tbody></table></div></details>
   <p className="admin-small admin-detail-note">One count per browser per Bangladesh day, when a match starts or a human makes a move. First play on the same day stays “new”. Another device or cleared cookies can count again. Tracking from {dayLabel(data.since)}; earlier days are untracked (—).</p>
  </section>
  <section className="admin-panel admin-setups" aria-label="Match breakdown" aria-busy={loading}>
   <div className="admin-panel-heading"><div><p className="admin-eyebrow">Every kind of table</p><h2>Match breakdown</h2></div><Bot size={21}/></div>
   <div className="admin-breakdown-controls"><div className="admin-range" aria-label="Group match statistics">{(['humans','seats','bots'] as const).map(value=><button key={value} aria-pressed={group===value} onClick={()=>setGroup(value)}>{labels[value]}</button>)}</div><div className="admin-range" aria-label="Match breakdown period"><button aria-pressed={allTime} onClick={()=>setAllTime(true)}>All recorded</button><button aria-pressed={!allTime} onClick={()=>setAllTime(false)}>Last {data.days} days</button></div></div>
   <div className="admin-setup-summary"><p><strong>{number(starts)}</strong> matches started</p><p><strong>{number(botStarts)}</strong> with bots</p><p><Clock3 size={14}/><strong>{number(sampleCount)}</strong> full samples</p></div>
   {!starts&&!setups.some(row=>row.completed||row.abandoned)&&<p className="admin-small admin-detail-empty">No matches recorded in this range yet. The breakdown fills as matches start.</p>}
   <div className="admin-data-scroll admin-setup-table" tabIndex={0} role="region" aria-label="Match breakdown table, scroll horizontally on small screens"><table><caption className="sr-only">{scope} by {labels[group].toLowerCase()}. Averages include only fully tracked completed matches.</caption><thead><tr><th scope="col">{labels[group]}</th><th scope="col">Started</th><th scope="col">Finished</th><th scope="col">Avg time</th><th scope="col">Avg plays</th></tr></thead><tbody>{rows.map(row=><tr key={row.count} data-testid={'setup-'+group+'-'+row.count}><th scope="row"><span className="admin-setup-number">{row.count}</span>{group==='bots'?(row.count===0?'No bots':row.count===1?'bot':'bots'):group==='seats'?(row.count===1?'seat':'seats'):(row.count===1?'human':'humans')}</th><td>{number(row.started)}</td><td>{number(row.completed)}</td><AverageCells row={row}/></tr>)}</tbody></table></div>
   <p className="admin-small admin-detail-note">Humans excludes permanent bots; total seats includes them. A one-human match needs a bot. Average time and card plays (humans + bots) use finished matches tracked from start to finish. — means no complete sample. Counts include retained older rounds; their averages are unavailable.</p>
   <details className="admin-data-details"><summary>View human + bot combinations</summary><div className="admin-data-scroll" tabIndex={0} role="region" aria-label="Human and bot combinations table"><table><caption className="sr-only">Exact human and bot combinations. {scope}.</caption><thead><tr><th scope="col">Humans</th><th scope="col">Bots</th><th scope="col">Started</th><th scope="col">Finished</th><th scope="col">Everyone left</th><th scope="col">Avg time</th><th scope="col">Avg plays</th><th scope="col">Card plays</th><th scope="col">Draws</th><th scope="col">Timeouts</th><th scope="col">Samples</th></tr></thead><tbody>{setups.map(row=><tr key={row.humans+'-'+row.bots}><th scope="row">{row.humans}</th><td>{row.bots}</td><td>{number(row.started)}</td><td>{number(row.completed)}</td><td>{number(row.abandoned)}</td><AverageCells row={row}/><td>{number(row.plays)}</td><td>{number(row.draws)}</td><td>{number(row.timeouts)}</td><td>{number(row.sampleCount)}</td></tr>)}</tbody></table>{!setups.length&&<p className="admin-small">No combinations recorded yet.</p>}</div></details>
  </section>
 </div>;
}
