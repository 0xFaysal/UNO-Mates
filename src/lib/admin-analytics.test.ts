import {describe,it,expect} from 'vitest';
import {analyticsDay,groupMatchSetups,setupAverages,analyticsCsv} from './admin-analytics';
import type {AdminStats,MatchSetupStats} from './admin-contract';
const setup=(humans:number,bots:number,started:number,sampleCount=0,durationSeconds=0,completedPlays=0):MatchSetupStats=>({humans,bots,started,completed:sampleCount,abandoned:0,plays:completedPlays,draws:0,timeouts:0,durationSeconds,sampleCount,completedPlays});
describe('owner match analytics',()=>{
 it('groups people, table seats and bots independently, including all boundary sizes',()=>{
  const source=[setup(1,1,4),setup(1,9,2),setup(10,0,3)];
  expect(groupMatchSetups(source,'humans').map(row=>row.started)).toEqual([6,0,0,0,0,0,0,0,0,3]);
  expect(groupMatchSetups(source,'seats').find(row=>row.count===10)?.started).toBe(5);
  expect(groupMatchSetups(source,'bots').map(row=>row.started)).toEqual([3,4,0,0,0,0,0,0,0,2]);
 });
 it('weights averages by complete samples, never by starts or untracked historical completions',()=>{
  const rows=groupMatchSetups([setup(2,0,20,2,120,30),setup(2,1,10,1,300,90)],'humans');
  expect(setupAverages(rows[1])).toEqual({seconds:140,plays:40});expect(setupAverages(rows[0])).toBeNull();
 });
 it('exports exact human/bot combinations, averages and daily cohorts without visitor identities',()=>{
  const stats={series:[{day:'2026-11-01',started:3,completed:1,abandoned:0}],detailed:{days:7,since:'2026-11-01',setups:[setup(1,9,3,1,61,23)],visitors:{today:{newPlayers:1,returningPlayers:2},series:[{day:'2026-11-01',newPlayers:1,returningPlayers:2}]}}} as AdminStats;
  const csv=analyticsCsv(stats);expect(csv).toContain('1,9,3,1,0,23,0,0,1,61.00,23.00');expect(csv).toContain('2026-11-01,1,2');expect(csv).not.toMatch(/visitor_hash|session_token/);
 });
 it('keeps exports working during an older dashboard response',()=>{
  expect(analyticsCsv({series:[{day:'2026-11-01',started:0,completed:0,abandoned:0}]} as AdminStats)).toBe('Date (Asia/Dhaka),Started,Completed,Abandoned\n2026-11-01,0,0,0');
 });
 it('uses the Bangladesh calendar boundary and leaves untracked cohort days blank in exports',()=>{
  expect(analyticsDay('2026-10-31T19:00:00Z')).toBe('2026-11-01');
  const stats={series:[],detailed:{since:'2026-10-31T19:00:00Z',days:7,setups:[],visitors:{series:[{day:'2026-10-31',newPlayers:0,returningPlayers:0},{day:'2026-11-01',newPlayers:0,returningPlayers:0}]}}} as unknown as AdminStats;
  const csv=analyticsCsv(stats);expect(csv).toContain('2026-10-31,,');expect(csv).toContain('2026-11-01,0,0');
 });
});
