'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Artist Predictor' },
  { href: '/umap', label: 'Lyrics Map' },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/30">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-[0.24em] uppercase">
          Lyric Categorizer
        </Link>
        <div className="flex items-center gap-2 rounded-full border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5">
          {links.map((link) => {
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'text-black/70 hover:bg-black/8 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}