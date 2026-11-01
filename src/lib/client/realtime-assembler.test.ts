import {describe,it,expect} from 'vitest';
import {startNewGame} from '../game/engine';
import type {GameSnapshot,GameState} from '../game/types';
import {RealtimeAssembler,type TableFrame,type HandFrame} from './realtime-assembler';

const me='a',other='b';
function fixture(){
 const auth=startNewGame('room',[{id:me,name:'Host',avatarColor:'#ef4444',isHost:true},{id:other,name:'Guest',avatarColor:'#3b82f6',isHost:false}]);
 const snapshot:GameSnapshot={publicState:{...auth.gameState,roundId:'one',roundStartedAt:1000,version:1,turnIndex:0,drawnCardPlayableId:null},myHand:auth.playerHands[me],myPlayerId:me};
 const assembler=new RealtimeAssembler(me);assembler.seed(snapshot);return {assembler,snapshot};
}
function frame(version:number,baseVersion:number,patch:Partial<GameState>={},handVersion=1):TableFrame{
 return {protocol:2,roomId:'room',roundId:'one',version,baseVersion,patch:{version,...patch},handVersions:{a:handVersion},serverNow:1234};
}
function hand(snapshot:GameSnapshot,version:number):HandFrame{
 return {protocol:2,roomId:'room',roundId:'one',playerId:me,version,myHand:snapshot.myHand.slice(1),drawnCardPlayableId:null};
}
const counts=(snapshot:GameSnapshot,count:number)=>snapshot.publicState.players.map(player=>player.id===me?{...player,cardCount:count}:player);
describe('atomic board/private-hand assembly',()=>{
 it('applies public-only changes immediately without resending an unchanged hand',()=>{
  const {assembler,snapshot}=fixture();const result=assembler.public(frame(2,1,{lastActionDescription:'UNO declared'}));
  expect(result?.myHand).toEqual(snapshot.myHand);expect(result?.publicState.version).toBe(2);expect(assembler.pending).toBe(false);
  expect(assembler.public(frame(2,1))).toBeUndefined();
 });
 it('waits for the private hand if the board arrives first',()=>{
  const {assembler,snapshot}=fixture();expect(assembler.public(frame(2,1,{players:counts(snapshot,6)},2))).toBeUndefined();expect(assembler.pending).toBe(true);
  expect(assembler.privateHand(hand(snapshot,2))?.myHand).toHaveLength(6);expect(assembler.pending).toBe(false);
 });
 it('accepts the private hand first without showing it on an older board',()=>{
  const {assembler,snapshot}=fixture();expect(assembler.privateHand(hand(snapshot,2))).toBeUndefined();expect(assembler.pending).toBe(true);
  const result=assembler.public(frame(2,1,{players:counts(snapshot,6)},2));expect(result?.myHand).toHaveLength(6);expect(result?.publicState.version).toBe(2);
 });
 it('does not substitute a future private hand when packets cross between channels',()=>{
  const {assembler,snapshot}=fixture();assembler.privateHand({...hand(snapshot,3),myHand:snapshot.myHand.slice(2)});
  expect(assembler.public(frame(2,1,{players:counts(snapshot,6)},2))).toBeUndefined();
  expect(assembler.privateHand(hand(snapshot,2))?.myHand).toHaveLength(6);
  expect(assembler.public(frame(3,2,{players:counts(snapshot,5)},3))?.myHand).toHaveLength(5);
 });
 it('buffers reversed deltas and applies the latest contiguous result',()=>{
  const {assembler}=fixture();expect(assembler.public(frame(3,2))).toBeUndefined();expect(assembler.pending).toBe(true);
  expect(assembler.public(frame(2,1))?.publicState.version).toBe(3);expect(assembler.pending).toBe(false);
 });
 it('uses full checkpoints to recover a missing delta without inventing cards',()=>{
  const {assembler,snapshot}=fixture();assembler.public(frame(3,2));
  const result=assembler.public({...frame(20,19),patch:undefined,state:{...snapshot.publicState,version:20}});
  expect(result?.publicState.version).toBe(20);expect(result?.myHand).toEqual(snapshot.myHand);expect(assembler.pending).toBe(false);
 });
 it('requires a missing private update even when a full public checkpoint arrives',()=>{
  const {assembler,snapshot}=fixture();expect(assembler.public({...frame(20,19,{},5),state:{...snapshot.publicState,version:20,players:counts(snapshot,6)}})).toBeUndefined();
  expect(assembler.pending).toBe(true);assembler.seed({...snapshot,publicState:{...snapshot.publicState,version:20,players:counts(snapshot,6)},myHand:snapshot.myHand.slice(1)});expect(assembler.pending).toBe(false);
  expect(assembler.privateHand(hand(snapshot,5))).toBeUndefined();
 });
 it('clears removed optional fields and retains private draw hints only for their owner turn',()=>{
  const {assembler,snapshot}=fixture();assembler.seed({...snapshot,publicState:{...snapshot.publicState,drawPenalty:{amount:4,value:'draw4'},drawnCardPlayableId:snapshot.myHand[0].id}});
  const update=frame(2,1);update.removed=['drawPenalty'];const result=assembler.public(update);expect(result?.publicState.drawPenalty).toBeUndefined();expect(result?.publicState.drawnCardPlayableId).toBe(snapshot.myHand[0].id);
  expect(assembler.public(frame(3,2,{turnIndex:1}))?.publicState.drawnCardPlayableId).toBeNull();
 });
 it('resets across lobby/new-round version resets and rejects delayed old rounds',()=>{
  const {assembler,snapshot}=fixture();assembler.public(frame(20,1));
  const next={...snapshot,publicState:{...snapshot.publicState,roundId:'two',roundStartedAt:2000,version:1}};assembler.seed(next);
  assembler.seed({...snapshot,publicState:{...snapshot.publicState,version:99}});expect(assembler.current?.roundId).toBe('two');expect(assembler.current?.version).toBe(1);
  expect(assembler.public(frame(100,99))).toBeUndefined();expect(assembler.privateHand(hand(snapshot,2))).toBeUndefined();
 });
 it('ignores frames for another player/room and supports a deliberately legacy seat',()=>{
  const {assembler,snapshot}=fixture();expect(assembler.privateHand({...hand(snapshot,2),playerId:other})).toBeUndefined();expect(assembler.public({...frame(2,1),roomId:'other-room'})).toBeUndefined();expect(assembler.public({...frame(2,1),handVersions:{b:2}})).toBeUndefined();expect(assembler.pending).toBe(false);
 });
 it('refuses inconsistent card counts rather than displaying a stale hand',()=>{
  const {assembler,snapshot}=fixture();expect(assembler.public(frame(2,1,{players:counts(snapshot,0)}))).toBeUndefined();expect(assembler.pending).toBe(true);
 });
 it('bounds missing-message buffers and lets an authoritative snapshot recover',()=>{
  const {assembler,snapshot}=fixture();for(let i=5;i<80;i++)assembler.public(frame(i,i-1));expect(assembler.pending).toBe(true);
  assembler.seed({...snapshot,publicState:{...snapshot.publicState,version:100}});expect(assembler.pending).toBe(false);
 });
 it('joins compact hand revisions with sparse player changes and removed player flags',()=>{
  const {assembler,snapshot}=fixture();const value=frame(2,1);value.handVersions=[2,1];value.playerChanges={'0':{patch:{cardCount:6,hasCalledUno:true},removed:['offlineMisses']}};
  expect(assembler.public(value)).toBeUndefined();const result=assembler.privateHand(hand(snapshot,2));expect(result?.myHand).toHaveLength(6);expect(result?.publicState.players[0].hasCalledUno).toBe(true);
 });
 it('refuses a sparse update that changes player identity or targets another position',()=>{
  const {assembler}=fixture();const value=frame(2,1);value.playerChanges={'0':{patch:{id:'someone-else'},removed:[]}};expect(assembler.public(value)).toBeUndefined();expect(assembler.pending).toBe(true);
 });
});
