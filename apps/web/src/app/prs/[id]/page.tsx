import { PageShell } from '../../../components/page-shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogTrigger,
  SegmentedControl,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@procurement/ui';

export default function CaseWorkspacePage() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-heading">PR-2024-1005</h2>
              <Badge>WAITING_QUOTES</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">
              Marketing campaign launch assets • Needed by Jun 28.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">Assign buyer</Button>
              </DialogTrigger>
              <DialogContent>
                <h3 className="text-lg font-semibold text-heading">Assign PR to buyer</h3>
                <p className="mt-2 text-sm text-muted">
                  Use round-robin or manually override the buyer assignment.
                </p>
                <div className="mt-4 space-y-3">
                  <SegmentedControl
                    value="round-robin"
                    onChange={() => undefined}
                    options={[
                      { label: 'Round-robin', value: 'round-robin' },
                      { label: 'Manual', value: 'manual' },
                    ]}
                  />
                  <Button full>Assign automatically</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button size="sm">Request quotes</Button>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="quotes">Quotes & Suppliers</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold text-heading">Requester details</h3>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Requester</span>
                    <span className="font-medium text-slate-800">Jamie Parker</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Department</span>
                    <span className="font-medium text-slate-800">Marketing</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Budget</span>
                    <span className="font-medium text-slate-800">$18,500</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold text-heading">Status progression</h3>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-3 text-sm text-slate-600">
                    {['New', 'Assigned', 'Waiting Quotes', 'Ready for Review', 'Ready to Send'].map(
                      (step, index) => (
                        <li key={step} className="flex items-center gap-3">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span>{index < 3 ? step : `${step} (pending)`}</span>
                        </li>
                      ),
                    )}
                  </ol>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="checklist">
            <Card className="mt-6">
              <CardHeader>
                <h3 className="text-lg font-semibold text-heading">Checklist</h3>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Owner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <tbody>
                    {[
                      { item: 'Budget verified', status: 'DONE', owner: 'SYSTEM' },
                      { item: 'Quotes received', status: 'OPEN', owner: 'BUYER' },
                    ].map((row) => (
                      <TableRow key={row.item}>
                        <TableCell>{row.item}</TableCell>
                        <TableCell>
                          <Badge>{row.status}</Badge>
                        </TableCell>
                        <TableCell>{row.owner}</TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="quotes">
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-heading">Supplier quotes</h3>
                  <Button size="sm" variant="secondary">Add quote</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <tbody>
                    {[
                      { supplier: 'Supplier 1', amount: '$9,200', status: 'Received' },
                      { supplier: 'Supplier 2', amount: '$9,850', status: 'Pending' },
                    ].map((row) => (
                      <TableRow key={row.supplier}>
                        <TableCell>{row.supplier}</TableCell>
                        <TableCell>{row.amount}</TableCell>
                        <TableCell>
                          <Badge>{row.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="notes">
            <Card className="mt-6">
              <CardHeader>
                <h3 className="text-lg font-semibold text-heading">Notes</h3>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
                  rows={6}
                  placeholder="Add procurement notes, supplier updates, or approvals."
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="documents">
            <Card className="mt-6">
              <CardHeader>
                <h3 className="text-lg font-semibold text-heading">Documents</h3>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                    <span>RFQ_Supplier1.pdf</span>
                    <Button size="sm" variant="secondary">Download</Button>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                    <span>Final_Response.docx</span>
                    <Button size="sm" variant="secondary">Download</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="audit">
            <Card className="mt-6">
              <CardHeader>
                <h3 className="text-lg font-semibold text-heading">Audit trail</h3>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-sm text-slate-600">
                  <li>Buyer 2 requested quotes from Supplier 1 and Supplier 2.</li>
                  <li>System flagged missing insurance document.</li>
                  <li>Buyer 1 assigned to case.</li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
