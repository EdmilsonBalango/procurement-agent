'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiBaseUrl, queryClient } from '../lib/api';

type ThemeMode = 'light' | 'dark';

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type SearchContextValue = {
  query: string;
  setQuery: (value: string) => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

type Toast = {
  id: string;
  title: string;
  message?: string;
  tone?: 'info' | 'success' | 'warning';
};

type ApiNotification = {
  id: string;
  title: string;
  body: string;
  severity: string;
  isRead: boolean;
  createdAt: string;
  caseId?: string | null;
  type: string;
};

type NotificationContextValue = {
  notifyNewPr: (prNumber: string) => void;
  pushToast: (toast: Omit<Toast, 'id'> & { durationMs?: number }) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const getPreferredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within Providers');
  }
  return context;
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within Providers');
  }
  return context;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within Providers');
  }
  return context;
};

const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    const initialTheme = getPreferredTheme();
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const Providers = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <SearchProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </SearchProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

const SearchProvider = ({ children }: { children: ReactNode }) => {
  const [query, setQuery] = useState('');
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
};

const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeouts = useRef<Map<string, number>>(new Map());
  const seenNotifications = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const reconnectTimer = useRef<number | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      timeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeouts.current.clear();
      if (reconnectTimer.current !== null) {
        window.clearTimeout(reconnectTimer.current);
      }
      if (sourceRef.current) {
        sourceRef.current.close();
      }
    };
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timeoutId = timeouts.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeouts.current.delete(id);
    }
  };

  const pushToast = (toast: Omit<Toast, 'id'> & { durationMs?: number }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const durationMs = toast.durationMs ?? 4500;
    setToasts((prev) => [...prev, { ...toast, id }]);
    const timeoutId = window.setTimeout(() => dismissToast(id), durationMs);
    timeouts.current.set(id, timeoutId);
  };

  const notifyNewPr = (prNumber: string) => {
    pushToast({
      title: 'New PR sent',
      message: `${prNumber} has been submitted for intake review.`,
      tone: 'success',
    });
  };

  const value = useMemo(
    () => ({
      notifyNewPr,
      pushToast,
    }),
    [],
  );

  useEffect(() => {
    let closed = false;

    const connect = () => {
      if (closed) {
        return;
      }
      const source = new EventSource(`${apiBaseUrl}/notifications/stream`, {
        withCredentials: true,
      });
      sourceRef.current = source;

      source.addEventListener('init', (event) => {
        const ids = JSON.parse((event as MessageEvent).data) as string[];
        ids.forEach((id) => seenNotifications.current.add(id));
        initialized.current = true;
      });

      source.addEventListener('notification', (event) => {
        const note = JSON.parse((event as MessageEvent).data) as ApiNotification;
        if (!initialized.current) {
          seenNotifications.current.add(note.id);
          return;
        }
        if (seenNotifications.current.has(note.id)) {
          return;
        }
        seenNotifications.current.add(note.id);
        if (note.type !== 'NEW_PR') {
          return;
        }
        pushToast({
          title: note.title || 'Notification',
          message: note.body,
          tone: note.severity === 'INFO' ? 'info' : 'success',
        });
        fetch(`${apiBaseUrl}/notifications/${note.id}/read`, {
          method: 'PATCH',
          credentials: 'include',
        }).catch(() => undefined);
      });

      source.onerror = () => {
        source.close();
        if (reconnectTimer.current !== null) {
          window.clearTimeout(reconnectTimer.current);
        }
        if (!closed) {
          reconnectTimer.current = window.setTimeout(connect, 3000);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer.current !== null) {
        window.clearTimeout(reconnectTimer.current);
      }
      if (sourceRef.current) {
        sourceRef.current.close();
      }
    };
  }, []);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  );
};

const ToastViewport = ({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) => (
  <div className="pointer-events-none fixed right-6 top-6 z-50 flex w-[320px] flex-col gap-3">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        role="status"
        aria-live="polite"
        className="motion-alert pointer-events-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {toast.title}
            </p>
            {toast.message ? (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {toast.message}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="rounded-full p-1 text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      </div>
    ))}
  </div>
);
