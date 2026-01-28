'use client';

import { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { SearchResults } from './search-results';

export const PageShell = ({ children }: { children: ReactNode }) => (
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
