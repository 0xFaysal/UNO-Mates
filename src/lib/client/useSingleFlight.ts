import {useCallback,useState} from 'react';
import {createReadGate} from './network';
/** Coalesce resume reads, but do not drop committed updates arriving during a read. */
export function useSingleFlight<T>(task:()=>Promise<T>){
 const [read]=useState(()=>createReadGate<T>());
 return useCallback((invalidate=false)=>read(task,invalidate),[read,task]);
}
