'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageShell } from '../../../components/page-shell';
import { DocumentVisualizer } from '../../../components/document-visualizer';
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  SegmentedControl,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  VisuallyHidden,
} from '@procurement/ui';
import { prRecords } from '../../../lib/mock-data';

interface Document {
  name: string;
  type: string;
  url?: string;
}

export default function CaseWorkspacePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const prId = Array.isArray(params.id) ? params.id[0] : params.id;
  const pr = prRecords.find((record) => record.id === prId) ?? {
    id: prId,
    status: 'NEW',
    summary: 'New procurement request',
    neededBy: 'TBD',
    requester: 'Unknown',
    buyer: 'Unassigned',
    priority: 'MEDIUM',
    quotes: 0,
    updated: 'Just now',
    items: [],
  };
  const [assignmentMethod, setAssignmentMethod] = useState('manual');
  const [selectedBuyer, setSelectedBuyer] = useState('buyer-1');
  const [visualizerOpen, setVisualizerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  return (
    <PageShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-4 flex items-center gap-3">
              
            </div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-heading">{pr.id}</h2>
              <Badge variant="case" status={pr.status} />
            </div>
            <p className="mt-2 text-sm text-muted">
              {pr.summary} • Needed by {pr.neededBy}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">Assign buyer</Button>
              </DialogTrigger>
              <DialogContent className="motion-modal">
                <DialogTitle>
                  <VisuallyHidden>Assign PR to buyer</VisuallyHidden>
                </DialogTitle>
                <h3 className="text-lg font-semibold text-heading">Assign PR to buyer</h3>
                <p className="mt-2 text-sm text-muted">
                  Use round-robin or manually override the buyer assignment.
                </p>
                <div className="mt-4 space-y-3">
                  <SegmentedControl
                    value={assignmentMethod}
                    onChange={setAssignmentMethod}
                    options={[
                      { label: 'Manual', value: 'manual' },
                      { label: 'Round-robin', value: 'round-robin' },
                    ]}
                  />
                  {assignmentMethod === 'manual' && (
                    <Select
                      label="Select buyer"
                      value={selectedBuyer}
                      onChange={(e) => setSelectedBuyer(e.target.value)}
                      options={[
                        { value: 'buyer-1', label: 'Buyer 1' },
                        { value: 'buyer-2', label: 'Buyer 2' },
                        { value: 'buyer-3', label: 'Buyer 3' },
                      ]}
                    />
                  )}
                  <div className="mt-4 flex gap-3">
                    {assignmentMethod === 'manual' ? (
                      <>
                        <Button full>Assign</Button>
                        <DialogClose asChild>
                          <Button full variant="secondary">Cancel</Button>
                        </DialogClose>
                      </>
                    ) : (
                      <>
                        <Button full>Assign automatically</Button>
                        <DialogClose asChild>
                          <Button full variant="secondary">Cancel</Button>
                        </DialogClose>
                      </>
                    )}
                  </div>
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
            <TabsTrigger value="close">Close & Pay</TabsTrigger>
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
                  <div className="space-y-4">
                  {['New', 'Assigned', 'Waiting Quotes', 'Ready for Review', 'Ready to Send', 'Closed & Paid'].map(
                    (step, index) => (
                    <div key={step} className="flex gap-4">
                      <div className="flex flex-col items-center">
                      <div className={`h-3 w-3 rounded-full ${index < 3 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {index < 5 && <div className="mt-2 h-8 w-0.5 bg-slate-200" />}
                      </div>
                      <div className="pt-0.5 pb-4">
                      <p className={`text-sm font-medium ${index < 3 ? 'text-slate-800' : 'text-slate-400'}`}>
                        {step}
                      </p>
                      </div>
                    </div>
                    ),
                  )}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="mt-6">
              <CardHeader>
                <h3 className="text-lg font-semibold text-heading">PR items</h3>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Details</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit of measure</TableHead>
                      <TableHead>Preferred vendor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <tbody>
                    {pr.items.map((row) => (
                      <TableRow key={row.details}>
                        <TableCell>{row.details}</TableCell>
                        <TableCell>{row.quantity}</TableCell>
                        <TableCell>{row.unit}</TableCell>
                        <TableCell>{row.preferredVendor}</TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </CardContent>
            </Card>
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
                          <Badge variant="checklist" status={row.status} />
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
              <div className="mt-4 flex justify-end">
                <Button size="sm" variant="primary">Post Note</Button>
              </div>
              <div className="mt-6">
                <h4 className="mb-4 font-semibold text-heading">Previous Notes:</h4>
                <div className="space-y-3">
                {[
                  { note: 'Note 1 from Jamie Parker', date: '2024-06-01', author: 'Jamie Parker', initials: 'JP', bgColor: 'bg-blue-200', textColor: 'text-blue-700', borderColor: 'border-blue-200', noteBgColor: 'bg-blue-50' },
                  { note: 'Note 2 from Buyer 1', date: '2024-06-02', author: 'Buyer 1', initials: 'B1', bgColor: 'bg-purple-200', textColor: 'text-purple-700', borderColor: 'border-purple-200', noteBgColor: 'bg-purple-50' },
                ].map((note, index) => (
                  <div key={index} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${note.bgColor} text-xs font-semibold ${note.textColor} flex-shrink-0`}>
                    {note.initials}
                    </div>
                  </div>
                  <div className={`rounded-lg ${note.noteBgColor} border ${note.borderColor} p-3 flex-1`}>
                    <p className="text-sm font-medium text-slate-800">{note.author}</p>
                    <p className="text-sm text-slate-800">{note.note}</p>
                    <span className="text-xs text-slate-500">{note.date}</span>
                  </div>
                  </div>
                ))}
                </div>
              </div>
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
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span>RFQ_Supplier1.pdf</span>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => {
                      setSelectedDocument({
                        name: 'RFQ_Supplier1.pdf',
                        type: 'pdf',
                        url: '/documents/RFQ_Supplier1.pdf',
                      });
                      setVisualizerOpen(true);
                      }}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </Button>
                    <Button size="sm" variant="secondary">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </Button>
                  </div>
                  </div>
                </div>
                </CardContent>
            </Card>
            <DocumentVisualizer 
              open={visualizerOpen}
              onOpenChange={setVisualizerOpen}
              document={selectedDocument}
            />
          </TabsContent>
          <TabsContent value="audit">
            <Card className="mt-6">
              <CardHeader>
                <h3 className="text-lg font-semibold text-heading">Audit trail</h3>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Event Date</TableHead>
                    <TableHead>Event Type/Action</TableHead>
                    <TableHead>Modification Level</TableHead>
                  </TableRow>
                  </TableHeader>
                  <tbody>
                  {[
                    { user: 'Buyer 2', date: '2024-06-02 14:30', action: 'Requested quotes', level: 'Major' },
                    { user: 'System', date: '2024-06-02 14:35', action: 'Flagged missing insurance document', level: 'Alert' },
                    { user: 'Admin', date: '2024-06-01 10:15', action: 'Assigned Buyer 1 to case', level: 'Major' },
                  ].map((row) => (
                    <TableRow key={row.date}>
                    <TableCell>{row.user}</TableCell>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.action}</TableCell>
                    <TableCell>
                      <Badge variant={row.level === 'Major' ? 'default' : 'secondary'}>{row.level}</Badge>
                    </TableCell>
                    </TableRow>
                  ))}
                  </tbody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="close">
            <Card className="mt-6">
              <CardHeader>
                <h3 className="text-lg font-semibold text-heading">Close & Pay</h3>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-600">
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  Upload proof of payment (POP) to complete the workflow.
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" size="sm">Upload POP</Button>
                  <Button variant="secondary" size="sm">Send to supplier</Button>
                  <Button size="sm">Mark as closed & paid</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
