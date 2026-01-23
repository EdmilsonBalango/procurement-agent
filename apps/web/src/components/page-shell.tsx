import { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export const PageShell = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-screen bg-background">
    <Sidebar />
    <div className="flex flex-1 flex-col">
      <Topbar />
      <main className="flex-1 px-10 py-8">{children}</main>
    </div>
  </div>
);
