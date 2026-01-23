import Link from 'next/link';
import { BadgeCheck, Bell, Briefcase, LayoutGrid, Settings, Truck, Users } from 'lucide-react';
import { cn } from '@procurement/ui';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/prs/inbox', label: 'PR Inbox', icon: Briefcase },
  { href: '/prs/all', label: 'All PRs', icon: BadgeCheck },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar = () => (
  <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white px-6 py-6">
    <div className="mb-10">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Procurement</p>
      <h1 className="mt-2 text-xl font-semibold text-heading">PR Workflow</h1>
    </div>
    <nav className="flex flex-1 flex-col gap-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100',
            )}
          >
            <Icon className="h-4 w-4 text-slate-400" />
            {item.label}
          </Link>
        );
      })}
    </nav>
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
      <p className="font-medium text-slate-600">Buyer workload</p>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span>Buyer 1</span>
          <span className="font-semibold text-slate-700">6</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Buyer 2</span>
          <span className="font-semibold text-slate-700">4</span>
        </div>
      </div>
    </div>
  </aside>
);
