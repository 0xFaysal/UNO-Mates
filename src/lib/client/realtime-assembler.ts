import type {Card,GameSnapshot,GameState} from '../game/types';
import {acceptsSnapshot} from '../game/presentation';

export interface TableFrame {
 protocol:2;roomId:string;roundId:string;version:number;serverNow:number;handVersions:Record<string,number>|(number|null)[];
 state?:GameState;baseVersion?:number;patch?:Partial<GameState>;removed?:string[];
 playerChanges?:Record<string,{patch:Record<string,unknown>;removed:string[]}>;
}
export interface HandFrame {protocol:2;roomId:string;roundId:string;playerId:string;version:number;myHand:Card[];drawnCardPlayableId:string|null}
interface KnownHand {version:number;myHand:Card[];hint:string|null}
const validVersion=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>=0;
const LIMIT=24;

/** Joins two private transports without ever showing a future hand on an older board.
 * REST/legacy snapshots are authoritative baselines; deltas are never predictions. */
export class RealtimeAssembler {
 private board:GameState|null=null;
 private versions:TableFrame['handVersions']={};
 private hands:KnownHand[]=[];
 private frames=new Map<number,TableFrame>();
 private delivered=-1;
 private serverNow:number|undefined;
 private broken=false;
 constructor(readonly playerId:string){}
 get current(){return this.board;}
 get pending(){
  if(this.broken||this.frames.size)return true;
  if(!this.board)return false;
  if(this.hands.some(hand=>hand.version>this.board!.version))return true;
  const expected=this.expected(this.versions,this.board);
  if(expected===undefined)return false; // This seat deliberately uses the legacy path.
  return this.board.version>this.delivered&&!this.matchingHand(expected);
 }
 seed(snapshot:GameSnapshot):GameSnapshot|undefined{
  const state=snapshot.publicState;
  if((snapshot.myPlayerId&&snapshot.myPlayerId!==this.playerId)||!validVersion(state.version)||!Array.isArray(snapshot.myHand)||(this.board&&!acceptsSnapshot(this.board,state)))return;
  const changed=this.board?.roomId!==state.roomId||this.board?.roundId!==state.roundId;
  if(changed){this.frames.clear();this.hands=[];}
  this.board={...state,drawnCardPlayableId:null};this.serverNow=snapshot.serverNow;
  this.delivered=state.version;this.broken=false;
  this.versions={[this.playerId]:state.version};
  this.hands=[{version:state.version,myHand:snapshot.myHand,hint:state.drawnCardPlayableId},...this.hands.filter(hand=>hand.version>state.version)].slice(0,LIMIT);
  for(const version of this.frames.keys())if(version<=state.version)this.frames.delete(version);
  return this.drain();
 }
 public(frame:TableFrame):GameSnapshot|undefined{
  if(!this.belongs(frame)||!validVersion(frame.version)||frame.version<=this.board!.version||frame.protocol!==2)return;
  if(!frame.handVersions||typeof frame.handVersions!=='object')return;
  const expected=this.expected(frame.handVersions,frame.state||{...this.board!,...frame.patch});
  if(expected===undefined)return; // Mixed old/new tabs are kept on full atomic updates.
  if(!validVersion(expected)||expected>frame.version){this.broken=true;return;}
  this.frames.set(frame.version,frame);
  if(this.frames.size>LIMIT){this.frames.delete(Math.min(...this.frames.keys()));this.broken=true;}
  return this.drain();
 }
 privateHand(frame:HandFrame):GameSnapshot|undefined{
  if(!this.belongs(frame)||frame.protocol!==2||frame.playerId!==this.playerId||!validVersion(frame.version)||!Array.isArray(frame.myHand))return;
  // Baselines already include every private change through their own version.
  if(this.hands.some(hand=>hand.version===frame.version)||frame.version<=this.delivered)return;
  this.hands.push({version:frame.version,myHand:frame.myHand,hint:frame.drawnCardPlayableId});
  this.hands.sort((a,b)=>b.version-a.version);
  if(this.hands.length>LIMIT){this.hands.length=LIMIT;this.broken=true;}
  return this.emit();
 }
 private belongs(frame:{roomId:string;roundId:string}){
  return Boolean(this.board&&frame.roomId===this.board.roomId&&frame.roundId===this.board.roundId);
 }
 private matchingHand(expected:number){
  return this.hands.find(hand=>hand.version>=expected&&hand.version<=this.board!.version);
 }
 private expected(versions:TableFrame['handVersions'],state:GameState){
  const value=Array.isArray(versions)?versions[state.players.findIndex(player=>player.id===this.playerId)]:versions[this.playerId];
  return value===null?undefined:value;
 }
 private drain():GameSnapshot|undefined{
  if(!this.board)return;
  let advanced=true;
  while(advanced){
   advanced=false;
   for(const [version,frame] of [...this.frames].sort((a,b)=>a[0]-b[0])){
    if(version<=this.board.version){this.frames.delete(version);continue;}
    let next:GameState;
    if(frame.state)next=frame.state;
    else if(frame.patch&&frame.baseVersion===this.board.version){
     next={...this.board,...frame.patch};
     for(const key of frame.removed||[])delete (next as unknown as Record<string,unknown>)[key];
     if(frame.playerChanges){
      const players=[...next.players];let valid=true;
      for(const [index,change] of Object.entries(frame.playerChanges)){
       const position=Number(index);if(!Number.isInteger(position)||!players[position]){valid=false;break;}
       const player={...players[position],...change.patch};
       for(const key of change.removed||[])delete (player as unknown as Record<string,unknown>)[key];
       if(player.id!==players[position].id){valid=false;break;}players[position]=player;
      }
      if(!valid){this.frames.delete(version);this.broken=true;continue;}next={...next,players};
     }
    }else continue;
    if(next.roomId!==this.board.roomId||next.roundId!==this.board.roundId||next.version!==version||!Array.isArray(next.players)){
     this.frames.delete(version);this.broken=true;continue;
    }
    this.board={...next,drawnCardPlayableId:null};this.versions=frame.handVersions;this.serverNow=frame.serverNow;
    this.frames.delete(version);advanced=true;
   }
  }
  return this.emit();
 }
 private emit():GameSnapshot|undefined{
  if(!this.board||this.board.version<=this.delivered)return;
  const expected=this.expected(this.versions,this.board);if(expected===undefined)return;
  const hand=this.matchingHand(expected);if(!hand)return;
  const own=this.board.players.find(player=>player.id===this.playerId);
  if(!own||own.cardCount!==hand.myHand.length){this.broken=true;return;}
  this.delivered=this.board.version;
  // Keep the selected baseline and bounded future hands for cross-channel reordering.
  this.hands=this.hands.filter(item=>item.version>=hand.version);
  return {publicState:{...this.board,drawnCardPlayableId:this.board.players[this.board.turnIndex]?.id===this.playerId?hand.hint:null},myHand:hand.myHand,myPlayerId:this.playerId,serverNow:this.serverNow};
 }
}
