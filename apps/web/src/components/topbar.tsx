'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [notifications, setNotifications] = useState<
    Array<{ id: string; title: string; body: string; isRead: boolean; createdAt?: string }>
  >([]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const alertsRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!alertsOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (!alertsRef.current?.contains(event.target as Node)) {
        setAlertsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [alertsOpen]);

  useEffect(() => {
    let active = true;
    const fetchNotifications = async () => {
      try {
        const data = await apiFetch<
          Array<{ id: string; title: string; body: string; isRead: boolean; createdAt?: string }>
        >('/notifications');
        if (!active) {
          return;
        }
        setNotifications(data);
      } catch {
        // ignore
      }
    };
    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const unreadNotifications = useMemo(
    () => notifications.filter((note) => !note.isRead),
    [notifications],
  );
  const recentNotifications = useMemo(
    () => notifications.slice(0, 5),
    [notifications],
  );

  const clearUnread = async () => {
    const unread = notifications.filter((note) => !note.isRead);
    if (unread.length === 0) {
      return;
    }
    try {
      await Promise.all(
        unread.map((note) =>
          apiFetch(`/notifications/${note.id}/read`, { method: 'PATCH' }),
        ),
      );
      setNotifications((prev) => prev.filter((note) => note.isRead));
    } catch {
      // ignore
    }
  };

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
        <div className="relative" ref={alertsRef}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAlertsOpen((prev) => !prev)}
          >
            <span className="relative mr-2">
              <Bell className="h-4 w-4" />
              {unreadNotifications.length > 0 ? (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400" />
              ) : null}
            </span>
            Alerts
          </Button>
          {alertsOpen ? (
            <Card className="absolute right-0 mt-3 w-[320px] border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Alerts
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={clearUnread}
                    disabled={unreadNotifications.length === 0}
                  >
                    Clear
                  </Button>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    New Notifications
                  </p>
                  <div className="mt-2 space-y-2">
                    {unreadNotifications.length === 0 ? (
                      <p className="text-xs text-slate-500">No new notifications.</p>
                    ) : (
                      unreadNotifications.slice(0, 5).map((note) => (
                        <div key={note.id} className="rounded-lg border border-amber-100 bg-amber-50 p-2">
                          <p className="text-sm font-semibold text-slate-800">{note.title}</p>
                          <p className="text-xs text-slate-600">{note.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Unread
                  </p>
                  <div className="mt-2 space-y-2">
                    {unreadNotifications.length === 0 ? (
                      <p className="text-xs text-slate-500">All caught up.</p>
                    ) : (
                      unreadNotifications.map((note) => (
                        <div key={note.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <p className="text-sm font-semibold text-slate-800">{note.title}</p>
                          <p className="text-xs text-slate-600">{note.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {/* <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Recent
                  </p>
                  <div className="mt-2 space-y-2">
                    {recentNotifications.length === 0 ? (
                      <p className="text-xs text-slate-500">No notifications yet.</p>
                    ) : (
                      recentNotifications.map((note) => (
                        <div key={note.id} className="rounded-lg border border-slate-200 p-2">
                          <p className="text-sm font-semibold text-slate-800">{note.title}</p>
                          <p className="text-xs text-slate-600">{note.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div> */}
              </CardContent>
            </Card>
          ) : null}
        </div>
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
