'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Moon, Search, Sun, UserCircle } from 'lucide-react';
import { Button, Card, CardContent } from '@procurement/ui';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../lib/api';
import { useSearch, useTheme } from '../app/providers';

export const Topbar = () => {
  const { theme, toggleTheme } = useTheme();
  const { query, setQuery } = useSearch();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ name: string; email: string; role: string }>('/auth/me')
      .then((data) => {
        if (!cancelled) {
          setUser({ name: data.name, email: data.email, role: data.role });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
    }
  };

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
        <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        <input
          placeholder="Search PRs, suppliers, or requesters"
          className="w-80 bg-transparent text-sm text-slate-600 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Toggle dark mode"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="secondary" size="sm">
          <Bell className="mr-2 h-4 w-4" />
          Alerts
        </Button>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {(user?.name ?? 'Admin User')
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </button>
          {menuOpen ? (
            <Card className="absolute right-0 mt-3 w-64 border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <UserCircle className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {user?.name ?? 'Admin User'}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {user?.email ?? 'admin@local'}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                      {user?.role ?? 'ADMIN'}
                    </p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" full onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </header>
  );
};
