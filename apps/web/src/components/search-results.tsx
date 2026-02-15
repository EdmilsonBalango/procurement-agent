'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@procurement/ui';
import { useSearch } from '../app/providers';
import { apiFetch } from '../lib/api';
import type { PrRecord } from '../lib/types';

type ApiCaseRecord = {
  id: string;
  prNumber: string;
  status: PrRecord['status'];
  subject: string;
  requesterName: string;
  priority: PrRecord['priority'];
  updatedAt: string;
  assignedBuyer?: { name: string } | null;
};

type ApiSupplier = {
  id: string;
  name: string;
  email: string;
  categories: string;
};

type ApiNotification = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  caseId?: string | null;
};

type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'BUYER';
};

type UiSupplier = {
  name: string;
  categories: string;
  email: string;
  location: string;
};

type UiNotification = {
  id: string;
  title: string;
  body: string;
  status: 'READ' | 'UNREAD';
  prId?: string;
};

type UiUser = {
  name: string;
  email: string;
  role: 'ADMIN' | 'BUYER';
};

const normalize = (value: string) => value.toLowerCase();

export const SearchResults = () => {
  const { query, setQuery } = useSearch();
  const [prRecords, setPrRecords] = useState<PrRecord[]>([]);
  const [suppliers, setSuppliers] = useState<UiSupplier[]>([]);
  const [notifications, setNotifications] = useState<UiNotification[]>([]);
  const [users, setUsers] = useState<UiUser[]>([]);
  const term = query.trim();

  useEffect(() => {
    let active = true;
    const fetchAll = async () => {
      try {
        const [cases, suppliersData, notificationsData, usersData] = await Promise.all([
          apiFetch<ApiCaseRecord[]>('/cases'),
          apiFetch<ApiSupplier[]>('/suppliers'),
          apiFetch<ApiNotification[]>('/notifications'),
          apiFetch<ApiUser[]>('/users'),
        ]);
        if (!active) {
          return;
        }
        const caseMap = new Map(cases.map((record) => [record.id, record.prNumber]));
        setPrRecords(
          cases.map((record) => ({
            id: record.prNumber,
            status: record.status,
            summary: record.subject,
            neededBy: 'TBD',
            requester: record.requesterName,
            buyer: record.assignedBuyer?.name ?? 'Unassigned',
            priority: record.priority,
            quotes: 0,
            updated: new Date(record.updatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            }),
            items: [],
          })),
        );
        setSuppliers(
          suppliersData.map((supplier) => ({
            name: supplier.name,
            categories: supplier.categories,
            email: supplier.email,
            location: '—',
          })),
        );
        setNotifications(
          notificationsData.map((note) => ({
            id: note.id,
            title: note.title,
            body: note.body,
            status: note.isRead ? 'READ' : 'UNREAD',
            prId: note.caseId ? caseMap.get(note.caseId) : undefined,
          })),
        );
        setUsers(
          usersData.map((user) => ({
            name: user.name,
            email: user.email,
            role: user.role,
          })),
        );
      } catch {
        // ignore
      }
    };

    fetchAll();
    const interval = window.setInterval(fetchAll, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const needle = normalize(term);

  const prMatches = term
    ? prRecords.filter((pr) =>
        [pr.id, pr.summary, pr.requester, pr.buyer].some((field) =>
          normalize(field).includes(needle),
        ),
      )
    : [];

  const supplierMatches = term
    ? suppliers.filter((supplier) =>
        [supplier.name, supplier.categories, supplier.email, supplier.location].some((field) =>
          normalize(field).includes(needle),
        ),
      )
    : [];

  const notificationMatches = term
    ? notifications.filter((note) =>
        [note.title, note.body, note.prId ?? ''].some((field) =>
          normalize(field).includes(needle),
        ),
      )
    : [];

  const userMatches = term
    ? users.filter((user) =>
        [user.name, user.email, user.role].some((field) =>
          normalize(field).includes(needle),
        ),
      )
    : [];

  const sections = useMemo(
    () => [
      { key: 'prs', label: `PRs (${prMatches.length})`, count: prMatches.length },
      { key: 'suppliers', label: `Suppliers (${supplierMatches.length})`, count: supplierMatches.length },
      { key: 'notifications', label: `Notifications (${notificationMatches.length})`, count: notificationMatches.length },
      { key: 'users', label: `Users (${userMatches.length})`, count: userMatches.length },
    ],
    [notificationMatches.length, prMatches.length, supplierMatches.length, userMatches.length],
  );

  const defaultTab = sections.find((section) => section.count > 0)?.key ?? 'prs';
  const [tab, setTab] = useState(defaultTab);

  const hasResults =
    prMatches.length || supplierMatches.length || notificationMatches.length || userMatches.length;
  const closeResults = () => setQuery('');

  if (!term) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close search"
        onClick={closeResults}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/60"
      />
      <div className="absolute inset-y-0 left-64 right-0 flex items-center justify-center">
        <Card className="motion-alert flex max-h-[85vh] w-[min(900px,92vw)] flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-heading">Search results</h3>
              <p className="mt-1 text-sm text-muted">Matches for “{term}”.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close search"
              onClick={closeResults}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          <div className="mb-5 flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
            <input
              placeholder="Search PRs, suppliers, or requesters"
              className="w-full bg-transparent text-sm text-slate-600 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </div>
          {!hasResults ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">No results found.</p>
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                {sections.map((section) => (
                  <TabsTrigger key={section.key} value={section.key}>
                    {section.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="prs">
                <div className="mt-4 space-y-3">
                  {prMatches.map((pr) => (
                    <Link
                      key={pr.id}
                      href={`/prs/${pr.id}`}
                      onClick={closeResults}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                    >
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{pr.id}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {pr.summary} • {pr.requester}
                        </p>
                      </div>
                      <Badge variant="case" status={pr.status} />
                    </Link>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="suppliers">
                <div className="mt-4 space-y-3">
                  {supplierMatches.map((supplier) => (
                    <Link
                      key={supplier.name}
                      href="/suppliers"
                      onClick={closeResults}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200"
                    >
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">
                          {supplier.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {supplier.categories} • {supplier.location}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {supplier.email}
                      </span>
                    </Link>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="notifications">
                <div className="mt-4 space-y-3">
                  {notificationMatches.map((note) => {
                    if (!note.prId) {
                      return (
                        <div
                          key={note.id}
                          className="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-slate-800 dark:text-slate-100">
                              {note.title}
                            </p>
                            <Badge variant="default">
                              {note.status}
                            </Badge>
                          </div>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {note.body}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <Link
                      key={note.id}
                      href={`/prs/${note.prId}`}
                      onClick={closeResults}
                      className="block rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                    >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-slate-800 dark:text-slate-100">
                            {note.title}
                          </p>
                          <Badge variant="default">
                            {note.status}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {note.body}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="users">
                <div className="mt-4 space-y-3">
                  {userMatches.map((user) => (
                    <div
                      key={user.email}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200"
                    >
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">
                          {user.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {user.email}
                        </p>
                      </div>
                      <Badge variant="role" status={user.role} />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
        </Card>
      </div>
    </div>
  );
};
