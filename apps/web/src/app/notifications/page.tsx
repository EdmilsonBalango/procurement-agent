'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageShell } from '../../components/page-shell';
import { Badge, Card, CardContent, CardHeader } from '@procurement/ui';
import { apiFetch } from '../../lib/api';

type ApiNotification = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  caseId?: string | null;
};

type ApiCaseRecord = {
  id: string;
  prNumber: string;
};

type UiNotification = {
  id: string;
  title: string;
  body: string;
  status: 'READ' | 'UNREAD';
  prId?: string;
  receivedAt: string;
};

const formatReceivedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const datePart = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  return `${datePart} • ${timePart}`;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<UiNotification[]>([]);

  useEffect(() => {
    let active = true;
    const fetchNotifications = async () => {
      try {
        const [notes, cases] = await Promise.all([
          apiFetch<ApiNotification[]>('/notifications'),
          apiFetch<ApiCaseRecord[]>('/cases'),
        ]);
        if (!active) {
          return;
        }
        const caseMap = new Map(cases.map((record) => [record.id, record.prNumber]));
        const mapped = notes.map((note) => ({
          id: note.id,
          title: note.title,
          body: note.body,
          status: note.isRead ? 'READ' : 'UNREAD',
          prId: note.caseId ? caseMap.get(note.caseId) : undefined,
          receivedAt: formatReceivedAt(note.createdAt),
        }));
        setNotifications(mapped);
      } catch {
        // ignore
      }
    };

    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <PageShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold text-heading">Notifications</h2>
          <p className="mt-2 text-sm text-muted">Track in-app alerts for procurement actions.</p>
        </div>
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-heading">Recent alerts</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notifications.map((note) => {
                const cardClassName = `motion-alert block w-full rounded-lg border p-4 text-left transition ${
                  note.status === 'UNREAD'
                    ? 'border-green-200 bg-green-50 hover:border-green-300'
                    : 'border-slate-200 bg-gray-50 hover:border-slate-300'
                } dark:border-slate-800 dark:bg-slate-900`;
                const titleClassName = `font-medium ${
                  note.status === 'UNREAD' ? 'text-green-800' : 'text-slate-800'
                } dark:text-slate-100`;
                const bodyClassName = `mt-2 text-sm ${
                  note.status === 'UNREAD' ? 'text-green-700' : 'text-slate-600'
                } dark:text-slate-300`;

                const content = (
                  <>
                    <div className="flex items-center justify-between">
                      <p className={titleClassName}>{note.title}</p>
                      <Badge
                        variant={note.status === 'UNREAD' ? 'default' : 'secondary'}
                        className={
                          note.status === 'UNREAD'
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-600 bg-slate-600 text-white dark:border-slate-500 dark:bg-slate-500'
                        }
                      >
                        {note.status}
                      </Badge>
                    </div>
                    <p className={bodyClassName}>{note.body}</p>
                    <p className="mt-3 text-xs text-slate-500">{note.receivedAt}</p>
                  </>
                );

                if (!note.prId) {
                  return (
                    <div key={note.id} className={cardClassName}>
                      {content}
                    </div>
                  );
                }

                return (
                  <Link
                    key={note.id}
                    href={`/prs/${note.prId}`}
                    className={cardClassName}
                    onClick={() =>
                      apiFetch(`/notifications/${note.id}/read`, { method: 'PATCH' })
                        .then(() =>
                          setNotifications((prev) =>
                            prev.map((item) =>
                              item.id === note.id ? { ...item, status: 'READ' } : item,
                            ),
                          ),
                        )
                        .catch(() => undefined)
                    }
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
