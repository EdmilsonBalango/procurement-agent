'use client';

import { Bell, Moon, Search, Sun } from 'lucide-react';
import { Button, Tooltip } from '@procurement/ui';
import { useSearch, useTheme } from '../app/providers';

export const Topbar = () => {
  const { theme, toggleTheme } = useTheme();
  const { query, setQuery } = useSearch();

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
        <Tooltip content="Admin User • Admin" side="bottom" align="end">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
              AM
            </span>
        </Tooltip>
      </div>
    </header>
  );
};
