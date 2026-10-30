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
  return (
    <footer className="site-footer">
      <p>UNO Mates <span aria-hidden="true">·</span> Good cards. Better company.</p>
      <div className="site-footer-author">
        <span>Developed by <strong>Faysal Ahmed Fahim</strong></span>
        <div className="site-footer-socials">
          <a
            href="https://bd.linkedin.com/in/faysal-ahmed-fahim01"
            target="_blank"
            rel="noopener noreferrer"
            className="site-footer-link"
            aria-label="Faysal Ahmed Fahim on LinkedIn"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-3.5 h-3.5">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.77v8.37H6.46V10.9M7.85 6.25a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24Z"/>
            </svg>
            <span>LinkedIn</span>
          </a>
          <span className="site-footer-sep" aria-hidden="true">·</span>
          <a
            href="https://www.facebook.com/FaysalAhmedFAHlM/"
            target="_blank"
            rel="noopener noreferrer"
            className="site-footer-link"
            aria-label="Faysal Ahmed Fahim on Facebook"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-3.5 h-3.5">
              <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/>
            </svg>
            <span>Facebook</span>
          </a>
          <span className="site-footer-sep" aria-hidden="true">·</span>
          <a
            href="https://github.com/0xFaysal"
            target="_blank"
            rel="noopener noreferrer"
            className="site-footer-link"
            aria-label="Faysal Ahmed Fahim on GitHub"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-3.5 h-3.5">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            <span>GitHub</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
