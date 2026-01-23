import { Bell, Search } from 'lucide-react';
import { Button } from '@procurement/ui';

export const Topbar = () => (
  <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
    <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
      <Search className="h-4 w-4 text-slate-400" />
      <input
        placeholder="Search PRs, suppliers, or requesters"
        className="w-80 bg-transparent text-sm text-slate-600 outline-none"
      />
    </div>
    <div className="flex items-center gap-4">
      <Button variant="secondary" size="sm">
        <Bell className="mr-2 h-4 w-4" />
        Alerts
      </Button>
      <div className="flex items-center gap-3 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
        <span className="h-8 w-8 rounded-full bg-emerald-100 text-center text-xs font-semibold text-emerald-700">
          AM
        </span>
        <div>
          <p className="text-xs uppercase text-slate-400">Signed in</p>
          <p className="font-medium text-slate-700">Admin</p>
        </div>
      </div>
    </div>
  </header>
);
