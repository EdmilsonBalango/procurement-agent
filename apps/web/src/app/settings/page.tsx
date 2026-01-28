import { PageShell } from '../../components/page-shell';
import { Badge, Button, Card, CardContent, CardHeader, Table, TableCell, TableHead, TableHeader, TableRow } from '@procurement/ui';
import { users } from '../../lib/mock-data';

export default function SettingsPage() {
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
              <Button variant="secondary" size="sm">Create user</Button>
            </div>
          </CardHeader>
          <CardContent>
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
                      <Button variant="secondary" size="sm">Reset password</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
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
