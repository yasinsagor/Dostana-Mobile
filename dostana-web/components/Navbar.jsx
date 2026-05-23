'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const links = [
  { href: '/',           label: 'Strona Główna' },
  { href: '/menu',       label: 'Menu' },
  { href: '/locations',  label: 'Lokale' },
  { href: '/about',      label: 'O Nas' },
  { href: '/contact',    label: 'Kontakt' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Dostana Kebab" width={40} height={40} className="rounded-full object-cover" />
          <span className="font-bold text-lg text-gray-900">Dostana Kebab</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-gray-600 hover:text-[#2E7D32] transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/menu"
            className="bg-[#2E7D32] text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-[#1B5E20] transition-colors"
          >
            Zamów Teraz
          </Link>
        </div>

        {/* Hamburger */}
        <button
          className="md:hidden p-2 rounded-md text-gray-600 hover:text-[#2E7D32]"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 flex flex-col gap-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-gray-700 hover:text-[#2E7D32] py-1"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/menu"
            className="mt-2 bg-[#2E7D32] text-white text-sm font-semibold px-4 py-2 rounded-full text-center hover:bg-[#1B5E20] transition-colors"
            onClick={() => setOpen(false)}
          >
            Zamów Teraz
          </Link>
        </div>
      )}
    </nav>
  );
}
