import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Brand } from './Brand';

export function SiteHeader({ back = false, rules = false }: { back?: boolean; rules?: boolean }) {
  return <header className="site-header">
    <div>{back && <Link href="/" className="site-nav"><ArrowLeft size={16} aria-hidden="true"/><span>Back</span></Link>}</div>
    <Brand size="small" />
    <div className="site-header-end">{rules && <Link href="/rules" className="site-nav"><BookOpen size={16} aria-hidden="true"/><span>Rules</span></Link>}</div>
  </header>;
}
export function SiteFooter() {
  return <footer className="site-footer">UNO Mates <span aria-hidden="true">·</span> Good cards. Better company.</footer>;
}
