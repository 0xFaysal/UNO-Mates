'use client';
import { useCallback,useEffect,useRef,type RefObject } from 'react';
import confetti from 'canvas-confetti';

/** Independent, short-lived canvas bursts; no React updates for animation frames. */
export function useCelebrationCanvas(canvas:RefObject<HTMLCanvasElement|null>){
 const cannon=useRef<ReturnType<typeof confetti.create>|null>(null);
 const surface=useRef<HTMLCanvasElement|null>(null);
 const reset=useCallback(()=>cannon.current?.reset(),[]);
 const burst=useCallback((options:confetti.Options)=>{
  if(!canvas.current||document.visibilityState==='hidden'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return false;
  if(surface.current!==canvas.current){
   cannon.current?.reset();surface.current=canvas.current;
   // Separate canvases must remain independent when results enter the native dialog layer.
   cannon.current=confetti.create(canvas.current,{resize:true,disableForReducedMotion:true});
  }
  void cannon.current!({ticks:95,gravity:1,scalar:.85,disableForReducedMotion:true,...options});
  return true;
 },[canvas]);
 useEffect(()=>{
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const stopHidden=()=>{if(document.visibilityState==='hidden')reset();};
  const stopReduced=()=>{if(reduced.matches)reset();};
  document.addEventListener('visibilitychange',stopHidden);reduced.addEventListener('change',stopReduced);
  return()=>{document.removeEventListener('visibilitychange',stopHidden);reduced.removeEventListener('change',stopReduced);reset();};
 },[reset]);
 return {burst,reset};
}
