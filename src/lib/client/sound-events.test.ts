import { describe, expect, it } from 'vitest';
import { startNewGame } from '../game/engine';
import type { Card, GameState } from '../game/types';
import { createGameSoundTracker } from './sound-events';

function base(): GameState {
  const game = startNewGame('sounds', [
    {id:'a',name:'Alice',avatarColor:'#ef4444',isHost:true},
    {id:'b',name:'Bob',avatarColor:'#3b82f6',isHost:false},
    {id:'c',name:'Charlie',avatarColor:'#10b981',isHost:false},
  ]).gameState;
  return {...game,roundId:'round-a',turnIndex:1,finishOrder:[],lastMove:undefined};
}
const play = (game:GameState, value:Card['value']='5', id='request-1'):GameState => ({...game,lastMove:{id,type:'play',playerId:'b',card:{id:'card',color:'red',value,assetFile:'red_5.svg'},draws:[]}});

describe('multiplayer sound events',()=>{
  it('does not replay history on mount, mute changes, or snapshot repeats',()=>{
    const track=createGameSoundTracker(),game=play(base());
    expect(track(game,'a',true,false)).toEqual([]);
    expect(track({...game},'a',true,false)).toEqual([]);
  });
  it('plays the optimistic move immediately and not again on confirmation or rollback',()=>{
    const track=createGameSoundTracker(),game=base();track(game,'a',true,false);
    const next=play(game);
    expect(track(next,'a',false,false)).toEqual(['cardPlay']);
    expect(track(next,'a',true,false)).toEqual([]);
    expect(track(game,'a',true,false)).toEqual([]);
    expect(track(next,'a',true,false)).toEqual([]);
  });
  it.each(['skip','reverse','draw2','draw4','wild'] as const)('gives %s its own cue',value=>{
    const track=createGameSoundTracker(),game=base();track(game,'a',true,false);
    expect(track(play(game,value),'a',true,false)).toEqual([value]);
  });
  it('waits for a confirmed finish and celebrates once',()=>{
    const track=createGameSoundTracker(),game=base();track(game,'a',true,false);
    const done={...game,finishOrder:['b'],players:game.players.map(p=>({...p,cardCount:p.id==='b'?0:7}))};
    expect(track(done,'a',false,false)).toEqual([]);
    expect(track(game,'a',true,false)).toEqual([]);
    expect(track(done,'a',true,false)).toEqual(['finish']);
    expect(track(done,'a',true,false)).toEqual([]);
    expect(track({...done,status:'round_over',finishOrder:['b','a','c']},'a',true,false)).toEqual(['victory']);
  });
  it('does not replay moves or celebrations from a previous round',()=>{
    const track=createGameSoundTracker(),game=base();track(game,'a',true,false);
    track({...game,status:'round_over'},'a',true,false);
    expect(track({...game,roundId:'round-b',lastMove:{id:'start-b',type:'start',playerId:'a',draws:[]}},'a',true,false)).toEqual([]);
    expect(track(play({...game,roundId:'round-b'}),'a',true,false)).toEqual(['cardPlay']);
  });
  it('distinguishes draw, stacked penalty, catch, pass, and a new own turn',()=>{
    const track=createGameSoundTracker(),game=base();track(game,'a',true,false);
    const move=(id:string,type:'draw'|'other',count=0,target='b')=>({...game,lastMove:{id,type,playerId:'b',draws:count?[{playerId:target,count}]:[]}});
    expect(track(move('1','draw',1),'a',true,false)).toEqual(['cardDraw']);
    expect(track(move('2','draw',8),'a',true,false)).toEqual(['penalty']);
    expect(track(move('3','other',2,'c'),'a',true,false)).toEqual(['catch']);
    expect(track({...move('4','other'),turnIndex:0},'a',true,false)).toEqual(['pass','turn']);
  });
  it('keeps intro sounds with the deal animation, then signals the first own turn',()=>{
    const track=createGameSoundTracker(),game={...base(),turnIndex:0};track(game,'a',true,true);
    expect(track(play(game),'a',true,true)).toEqual([]);
    expect(track(play(game),'a',true,false)).toEqual(['turn']);
  });
});
