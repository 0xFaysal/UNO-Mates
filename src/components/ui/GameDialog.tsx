'use client';
import { useEffect, useRef, type ReactNode } from 'react';

export function GameDialog({ open, titleId, descriptionId, onClose, drawer = false, children }: { open: boolean; titleId: string; descriptionId?:string; onClose?: () => void; drawer?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open) { element.showModal(); element.focus({ preventScroll: true }); }
    else element.close();
    return () => element.close();
  }, [open]);
  return <dialog ref={ref} tabIndex={-1} aria-labelledby={titleId} aria-describedby={descriptionId} className={'game-dialog ' + (drawer ? 'game-dialog--drawer' : '')} onCancel={event => { event.preventDefault(); onClose?.(); }} onClick={event => { if (event.target === event.currentTarget) onClose?.(); }}>
    {open && children}
  </dialog>;
}
