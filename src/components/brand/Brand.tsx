import Image from 'next/image';
import Link from 'next/link';

export function Brand({ size = 'normal', markOnly = false, linked = true }: { size?: 'small' | 'normal' | 'hero'; markOnly?: boolean; linked?: boolean }) {
  const mark = <span className={'brand brand--' + size}>
    <Image className="brand-mark" src="/brand/uno-mates-mark.webp" width={192} height={192} alt={markOnly ? 'UNO Mates' : ''} priority={size === 'hero'} />
    {!markOnly && <span className="brand-name">UNO <span>Mates</span></span>}
  </span>;
  return linked ? <Link href="/" className="brand-link" aria-label="UNO Mates home">{mark}</Link> : mark;
}
