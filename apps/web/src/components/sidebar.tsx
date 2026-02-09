'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Bell, Briefcase, LayoutGrid, Settings, Truck, Users } from 'lucide-react';
import { cn } from '@procurement/ui';
import { apiFetch } from '../lib/api';

type ApiCaseRecord = {
  status: string;
  assignedBuyer?: { name: string } | null;
};

const navItems = [
  { href: '/dashboard' as const, label: 'Dashboard', icon: LayoutGrid },
  { href: '/prs/inbox' as const, label: 'PR Inbox', icon: Briefcase },
  { href: '/prs/all' as const, label: 'All PRs', icon: BadgeCheck },
  { href: '/notifications' as const, label: 'Notifications', icon: Bell },
  { href: '/suppliers' as const, label: 'Suppliers', icon: Truck },
  { href: '/settings' as const, label: 'Settings', icon: Settings },
] as const;

export const Sidebar = () => {
  const [role, setRole] = useState<string | null>(null);
  const [cases, setCases] = useState<ApiCaseRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ role: string }>('/auth/me')
      .then((user) => {
        if (!cancelled) {
          setRole(user.role);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRole(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchCases = () =>
      apiFetch<ApiCaseRecord[]>('/cases')
        .then((records) => {
          if (active) {
            setCases(records);
          }
        })
        .catch(() => undefined);

    fetchCases();
    const interval = window.setInterval(fetchCases, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const workloads = useMemo(() => {
    const counts = new Map<string, number>();
    for (const pr of cases) {
      if (['CLOSED', 'CLOSED_PAID', 'SENT'].includes(pr.status)) {
        continue;
      }
      const buyer = pr.assignedBuyer?.name ?? 'Unassigned';
      counts.set(buyer, (counts.get(buyer) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([buyer, count]) => ({ buyer, count }))
      .sort((a, b) => b.count - a.count);
  }, []);

  return (
    <aside className="flex h-full w-full flex-col border-r border-slate-200 bg-white px-6 py-6 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Procurement</p>
        <h1 className="mt-2 text-xl font-semibold text-heading dark:text-slate-100">PR Workflow</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
              )}
            >
              <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {role === 'ADMIN' ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <p className="font-medium text-slate-600 dark:text-slate-200">Buyer workload</p>
          <div className="mt-3 space-y-2">
            {workloads.map((workload) => (
              <div key={workload.buyer} className="flex items-center justify-between">
                <span>{workload.buyer}</span>
                <span className="font-semibold text-slate-700 dark:text-slate-100">
                  {workload.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
};
