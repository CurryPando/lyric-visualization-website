'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Artist Predictor' },
  { href: '/umap', label: 'Cluster Explorer' },
  { href: '/similar', label: 'Similar Songs' },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b-2 border-black/15 bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
          Lyric Categorizer
        </Link>
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-black/60 hover:border-black/20 hover:text-black'
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