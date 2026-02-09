'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { SearchResults } from './search-results';
import { apiFetch } from '../lib/api';

export const PageShell = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<'checking' | 'authed' | 'guest'>('checking');

  useEffect(() => {
    let cancelled = false;
    apiFetch('/auth/me')
      .then(() => {
        if (!cancelled) {
          setAuthStatus('authed');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthStatus('guest');
          router.replace('/login');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (authStatus !== 'authed') {
    return null;
  }

  return (
    <div className="flex h-screen bg-background dark:bg-slate-950">
      <div className="fixed left-0 top-0 h-screen w-64 overflow-y-auto">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col ml-64">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-10 py-8">{children}</main>
      </div>
      <SearchResults />
    </div>
  );
};
