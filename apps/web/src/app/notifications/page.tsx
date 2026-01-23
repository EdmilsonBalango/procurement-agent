import { PageShell } from '../../components/page-shell';
import { Badge, Card, CardContent, CardHeader } from '@procurement/ui';

const notifications = [
  { title: 'PR-2024-1005 is ready for review', body: 'Three quotes have been logged.', status: 'UNREAD' },
  { title: 'Supplier 2 submitted quote', body: 'Quote received for PR-2024-1004.', status: 'READ' },
];

export default function NotificationsPage() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
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
              {notifications.map((note) => (
                <div key={note.title} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-800">{note.title}</p>
                    <Badge>{note.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{note.body}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
