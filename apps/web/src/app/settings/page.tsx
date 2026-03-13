'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { ConfirmActionDialog } from '../../components/confirm-action-dialog';
import { PageShell } from '../../components/page-shell';
import { TableActionButton } from '../../components/table-action-button';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  Select,
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@procurement/ui';
import { apiFetch } from '../../lib/api';
import { useNotifications } from '../providers';

type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'BUYER';
};

type CreateUserResponse = ApiUser;

const defaultCreateUserForm = {
  name: '',
  email: '',
  role: 'BUYER' as 'ADMIN' | 'BUYER',
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!(error instanceof Error)) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(error.message) as { message?: string };
    if (parsed.message) {
      return parsed.message;
    }
  } catch {
    // Keep the original message when the API returned plain text.
  }

  return error.message || fallback;
};

export default function SettingsPage() {
  const { pushToast } = useNotifications();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [lastCredentialEmail, setLastCredentialEmail] = useState<string | null>(null);
  const [createUserForm, setCreateUserForm] = useState(defaultCreateUserForm);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<ApiUser | null>(null);

  useEffect(() => {
    let active = true;
    const fetchUsers = () =>
      apiFetch<ApiUser[]>('/users')
        .then((data) => {
          if (active) {
            setUsers(data);
          }
        })
        .catch(() => undefined);

    fetchUsers();
    const interval = window.setInterval(fetchUsers, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const handleCreateUserFieldChange = (
    field: keyof typeof defaultCreateUserForm,
    value: string,
  ) => {
    setCreateUserForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const resetCreateUserDialog = () => {
    setCreateUserForm(defaultCreateUserForm);
    setCreateUserError(null);
    setCreateUserLoading(false);
  };

  const handleCreateUserOpenChange = (open: boolean) => {
    setCreateUserOpen(open);
    if (!open) {
      resetCreateUserDialog();
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateUserLoading(true);
    setCreateUserError(null);

    try {
      const created = await apiFetch<CreateUserResponse>('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: createUserForm.name.trim(),
          email: createUserForm.email.trim(),
          role: createUserForm.role,
        }),
      });

      setUsers((current) => [created, ...current]);
      setLastCredentialEmail(created.email);
      setCreateUserOpen(false);
      resetCreateUserDialog();
      pushToast({
        title: 'User created',
        message: `Credentials were emailed to ${created.email}.`,
        tone: 'success',
      });
    } catch (error) {
      setCreateUserError(getErrorMessage(error, 'Failed to create user.'));
    } finally {
      setCreateUserLoading(false);
    }
  };

  const handleResetPassword = async (user: ApiUser) => {
    setResettingUserId(user.id);

    try {
      await apiFetch(`/users/${user.id}/reset-password`, {
        method: 'POST',
      });
      setLastCredentialEmail(user.email);
      pushToast({
        title: 'Password reset',
        message: `A new password was emailed to ${user.email}.`,
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        title: 'Reset password failed',
        message: getErrorMessage(error, 'Failed to reset password.'),
        tone: 'error',
      });
    } finally {
      setResettingUserId(null);
    }
  };

  const handleDeleteUser = async (user: ApiUser) => {
    setDeletingUserId(user.id);

    try {
      await apiFetch(`/users/${user.id}`, {
        method: 'DELETE',
      });
      setUsers((current) => current.filter((item) => item.id !== user.id));
      if (lastCredentialEmail === user.email) {
        setLastCredentialEmail(null);
      }
      pushToast({
        title: 'User deleted',
        message: `${user.email} was removed.`,
        tone: 'success',
      });
      setUserToDelete(null);
    } catch (error) {
      pushToast({
        title: 'Delete user failed',
        message: getErrorMessage(error, 'Failed to delete user.'),
        tone: 'error',
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold text-heading">Settings</h2>
          <p className="mt-2 text-sm text-muted">Admin controls and exception reporting.</p>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-heading">Users</h3>
              <Dialog open={createUserOpen} onOpenChange={handleCreateUserOpenChange}>
                <Button variant="secondary" size="sm" onClick={() => setCreateUserOpen(true)}>
                  Create user
                </Button>
                <DialogContent className="motion-modal w-full max-w-md">
                  <DialogTitle>
                    <h4 className="text-lg font-semibold text-heading">Create user</h4>
                  </DialogTitle>
                  <form className="space-y-4" onSubmit={handleCreateUser}>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700" htmlFor="create-user-name">
                        Full name
                      </label>
                      <input
                        id="create-user-name"
                        value={createUserForm.name}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleCreateUserFieldChange('name', event.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700" htmlFor="create-user-email">
                        Email
                      </label>
                      <input
                        id="create-user-email"
                        type="email"
                        value={createUserForm.email}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleCreateUserFieldChange('email', event.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        placeholder="email@example.com"
                        required
                      />
                    </div>
                    <Select
                      label="Role"
                      value={createUserForm.role}
                      onChange={(event) => handleCreateUserFieldChange('role', event.target.value)}
                      options={[
                        { value: 'BUYER', label: 'Buyer' },
                        { value: 'ADMIN', label: 'Admin' },
                      ]}
                    />
                    {createUserError ? (
                      <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {createUserError}
                      </p>
                    ) : null}
                    <div className="flex justify-end gap-3">
                      <DialogClose asChild>
                        <Button variant="ghost" type="button" disabled={createUserLoading}>
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button type="submit" disabled={createUserLoading}>
                        {createUserLoading ? 'Creating...' : 'Create user'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {lastCredentialEmail ? (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Credentials email sent to <span className="font-semibold">{lastCredentialEmail}</span>.
              </div>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {users.map((user) => (
                  <TableRow key={user.email}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="role" status={user.role} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={resettingUserId === user.id || deletingUserId === user.id}
                          onClick={() => handleResetPassword(user)}
                        >
                          {resettingUserId === user.id ? 'Sending...' : 'Reset password'}
                        </Button>
                        <TableActionButton
                          action="delete"
                          disabled={deletingUserId === user.id || resettingUserId === user.id}
                          className={deletingUserId === user.id ? 'animate-pulse' : ''}
                          onClick={() => setUserToDelete(user)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
        <ConfirmActionDialog
          open={Boolean(userToDelete)}
          onOpenChange={(open) => {
            if (!open) {
              setUserToDelete(null);
            }
          }}
          title="Delete user"
          srTitle="Confirm delete user"
          description={
            <>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-slate-700">
                {userToDelete ? `${userToDelete.name} (${userToDelete.email})` : 'this user'}
              </span>
              ? This action cannot be undone.
            </>
          }
          onConfirm={() => {
            if (userToDelete) {
              void handleDeleteUser(userToDelete);
            }
          }}
          confirmLabel="Delete"
          loading={Boolean(userToDelete && deletingUserId === userToDelete.id)}
          loadingLabel="Deleting..."
        />
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-heading">Exception report</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <span>PR-2024-1009 approved without 3 quotes</span>
                <Badge variant="role" status="ADMIN" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <span>PR-2024-1004 exception for urgent delivery</span>
                <Badge variant="role" status="ADMIN" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
