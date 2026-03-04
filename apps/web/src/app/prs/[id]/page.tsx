'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PageShell } from '../../../components/page-shell';
import { DocumentVisualizer } from '../../../components/document-visualizer';
import { FileDropzone } from '../../../components/file-dropzone';
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
import { apiBaseUrl, apiFetch } from '../../../lib/api';
import { getCaseStatusLabel } from '../../../lib/case-status';
import { useNotifications } from '../../providers';
import type { PrRecord } from '../../../lib/types';

type ApiCaseSummary = {
  id: string;
  prNumber: string;
  status: PrRecord['status'];
  subject: string;
  requesterName: string;
  department?: string;
  neededBy: string;
  priority: PrRecord['priority'];
  assignedBuyer?: { name: string } | null;
};

type ApiCaseDetail = ApiCaseSummary & {
  updatedAt: string;
  items: Array<{
    id: string;
    description: string;
    qty: number;
    uom: string;
    specs: string;
  }>;
  quotes?: Array<{
    id: string;
    amount: number;
    currency: string;
    receivedAt: string;
    supplier?: { id: string; name: string } | null;
    fileId?: string | null;
  }>;
  files?: Array<{
    id: string;
    type: string;
    filename: string;
    mimeType: string;
    storageKey: string;
    uploadedBy: string;
    createdAt: string;
  }>;
  notes?: Array<{
    id: string;
    body: string;
    createdAt: string;
    authorUserId?: string | null;
  }>;
  events?: Array<{
    id: string;
    type: string;
    detailJson: string;
    createdAt: string;
    actorUserId?: string | null;
  }>;
};

type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'BUYER';
};

type ApiSupplier = {
  id: string;
  name: string;
  email: string;
  categories: string;
  isActive: boolean;
};

type UploadedCaseFile = {
  id: string;
  type: string;
  filename: string;
  mimeType: string;
  storageKey: string;
  uploadedBy: string;
  createdAt: string;
};

interface Document {
  name: string;
  type: string;
  url?: string;
}

const PDF_MIME_TYPE = 'application/pdf';
const DEFAULT_QUOTE_REQUEST_TEXT = 'Please provide your best quote for the items below.';
const WORKSPACE_TABS = ['overview', 'quotes', 'notes', 'documents', 'audit', 'close'] as const;
type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

const isWorkspaceTab = (value: string | null): value is WorkspaceTab =>
  !!value && WORKSPACE_TABS.includes(value as WorkspaceTab);

const isPdfFile = (file: File) =>
  file.type.toLowerCase() === PDF_MIME_TYPE || file.name.toLowerCase().endsWith('.pdf');

export default function CaseWorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useNotifications();
  const params = useParams<{ id: string }>();
  const prId = Array.isArray(params.id) ? params.id[0] : params.id;
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(
    isWorkspaceTab(requestedTab) ? requestedTab : 'overview',
  );
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [pr, setPr] = useState<PrRecord>({
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
  });
  const [assignmentMethod, setAssignmentMethod] = useState('manual');
  const [buyers, setBuyers] = useState<ApiUser[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [caseId, setCaseId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestStep, setRequestStep] = useState(0);
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());
  const [emailBody, setEmailBody] = useState(DEFAULT_QUOTE_REQUEST_TEXT);
  const [emailBodyTouched, setEmailBodyTouched] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [quotes, setQuotes] = useState<
    Array<{
      id: string;
      supplier: string;
      amount: string;
      uploadedAt: string;
      fileId?: string | null;
      documentName?: string;
      deleteQuoteId?: string;
    }>
  >([]);
  const [caseFiles, setCaseFiles] = useState<
    Array<{
      id: string;
      type: string;
      filename: string;
      mimeType: string;
      storageKey: string;
      uploadedBy: string;
      createdAt: string;
    }>
  >([]);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteSupplierId, setQuoteSupplierId] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteCurrency, setQuoteCurrency] = useState('MZN');
  const [quoteFile, setQuoteFile] = useState<{
    id: string;
    filename: string;
  } | null>(null);
  const [quoteFileError, setQuoteFileError] = useState<string | null>(null);
  const [uploadingQuoteFile, setUploadingQuoteFile] = useState(false);
  const [savingQuote, setSavingQuote] = useState(false);
  const [deletingQuoteId, setDeletingQuoteId] = useState<string | null>(null);
  const [quoteToDelete, setQuoteToDelete] = useState<{ id: string; supplier: string } | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [notes, setNotes] = useState<
    Array<{ id: string; body: string; author: string; date: string }>
  >([]);
  const [postingNote, setPostingNote] = useState(false);
  const [auditEvents, setAuditEvents] = useState<
    Array<{
      id: string;
      user: string;
      date: string;
      action: string;
      level: 'Major' | 'Alert';
    }>
  >([]);
  const [usersById, setUsersById] = useState<Map<string, string>>(new Map());
  const [visualizerOpen, setVisualizerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [sendingReview, setSendingReview] = useState(false);
  const [confirmReviewOpen, setConfirmReviewOpen] = useState(false);
  const [hasNewQuoteAfterReview, setHasNewQuoteAfterReview] = useState(false);
  const [requestInvoiceDialogOpen, setRequestInvoiceDialogOpen] = useState(false);
  const [requestingInvoice, setRequestingInvoice] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState('');
  const [selectedInvoiceSupplierId, setSelectedInvoiceSupplierId] = useState('');
  const [poFile, setPoFile] = useState<{ id: string; filename: string } | null>(null);
  const [poFileError, setPoFileError] = useState<string | null>(null);
  const [uploadingPoFile, setUploadingPoFile] = useState(false);
  const [manualInvoiceDialogOpen, setManualInvoiceDialogOpen] = useState(false);
  const [manualInvoiceFile, setManualInvoiceFile] = useState<{ id: string; filename: string } | null>(null);
  const [manualInvoiceFileError, setManualInvoiceFileError] = useState<string | null>(null);
  const [uploadingManualInvoice, setUploadingManualInvoice] = useState(false);
  const [submittingManualInvoice, setSubmittingManualInvoice] = useState(false);
  const statusSteps: Array<{ label: string; status: PrRecord['status'] }> = [
    { label: 'New', status: 'NEW' },
    { label: 'Assigned', status: 'ASSIGNED' },
    { label: 'Waiting Quotes', status: 'WAITING_QUOTES' },
    { label: 'Ready for Review', status: 'READY_FOR_REVIEW' },
    { label: 'In review', status: 'IN_REVIEW' },
    { label: 'Request Invoice', status: 'REQUEST_INVOICE' },
    { label: 'Waiting for Invoice', status: 'WAITING_INVOICE' },
    { label: 'Closed & Paid', status: 'CLOSED_PAID' },
  ];
  const statusIndexMap: Record<PrRecord['status'], number> = {
    NEW: 0,
    MISSING_INFO: 0,
    ASSIGNED: 1,
    WAITING_QUOTES: 2,
    READY_FOR_REVIEW: 3,
    IN_REVIEW: 4,
    REQUEST_INVOICE: 5,
    WAITING_INVOICE: 6,
    SENT: 7,
    CLOSED: 7,
    CLOSED_PAID: 7,
  };
  const hasQuotes = quotes.length > 0;
  const effectiveStatus: PrRecord['status'] = [
    'IN_REVIEW',
    'REQUEST_INVOICE',
    'WAITING_INVOICE',
    'SENT',
    'CLOSED',
    'CLOSED_PAID',
  ].includes(pr.status)
    ? pr.status === 'IN_REVIEW' && requestInvoiceDialogOpen
      ? 'REQUEST_INVOICE'
      : pr.status
    : hasQuotes
      ? 'READY_FOR_REVIEW'
      : pr.status;
  const statusLabelMap: Record<PrRecord['status'], string> = {
    NEW: 'New',
    MISSING_INFO: 'Missing Info',
    ASSIGNED: 'Assigned',
    WAITING_QUOTES: 'Waiting Quotes',
    READY_FOR_REVIEW: 'Ready for Review',
    IN_REVIEW: 'In review',
    REQUEST_INVOICE: 'Request Invoice',
    WAITING_INVOICE: 'Waiting for Invoice',
    SENT: 'Sent',
    CLOSED: 'Closed',
    CLOSED_PAID: 'Closed & Paid',
  };
  const effectiveStatusLabel = statusLabelMap[effectiveStatus] ?? effectiveStatus;

  const activeStepIndex = statusIndexMap[effectiveStatus] ?? 0;
  const showSendForReviewButton = hasQuotes && (effectiveStatus !== 'IN_REVIEW' || hasNewQuoteAfterReview);

  useEffect(() => {
    if (isWorkspaceTab(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);
  const categorySet = new Set<string>();
  suppliers.forEach((supplier) => {
    const raw = supplier.categories;
    try {
      const parsed = JSON.parse(raw) as string[];
      parsed.forEach((entry) => categorySet.add(entry));
    } catch {
      raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((entry) => categorySet.add(entry));
    }
  });
  const categoryTabs = ['All', ...Array.from(categorySet.values()).sort()];

  const buildEmailBody = (record: PrRecord, introText: string) => {
    const escapedIntroText = introText
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
      .replaceAll('\n', '<br/>');
    const rows = record.items
      .map(
        (item) =>
          `<tr><td style="padding:6px 8px;border:1px solid #e2e8f0;">${item.details}</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${item.quantity}</td><td style="padding:6px 8px;border:1px solid #e2e8f0;">${item.unit}</td></tr>`,
      )
      .join('');

    return `<p>${escapedIntroText || DEFAULT_QUOTE_REQUEST_TEXT}</p><br/><table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px;"><thead><tr><th style="text-align:left;padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;">Item</th><th style="text-align:left;padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;">Qty</th><th style="text-align:left;padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;">Unit</th></tr></thead><tbody>${rows || '<tr><td colspan="3" style="padding:6px 8px;border:1px solid #e2e8f0;">No items listed.</td></tr>'}</tbody></table><br/><p style="margin-top:12px;">Note: Please reply to this same email thread with your quotation and any relevant details.</p><br/><p>Kind regards,<br/>Karingani Procurement Team</p>`;
  };

  useEffect(() => {
    let active = true;
    const fetchMe = async () => {
      try {
        const me = await apiFetch<{ id: string; role: string }>('/auth/me');
        if (!active) {
          return;
        }
        setCurrentUser(me);
      } catch {
        // ignore
      }
    };
    const fetchUsers = async () => {
      try {
        const users = await apiFetch<ApiUser[]>('/users');
        if (!active) {
          return;
        }
        setUsersById(new Map(users.map((user) => [user.id, user.name])));
        const assignableUsers = users.filter(
          (user) => user.role === 'BUYER' || user.role === 'ADMIN',
        );
        setBuyers(assignableUsers);
        setSelectedBuyer((current) => current || assignableUsers[0]?.id || '');
      } catch {
        // ignore
      }
    };
    fetchMe();
    fetchUsers();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchSuppliers = async () => {
      try {
        const data = await apiFetch<ApiSupplier[]>('/suppliers');
        if (!active) {
          return;
        }
        setSuppliers(data.filter((supplier) => supplier.isActive));
      } catch {
        // ignore
      }
    };
    fetchSuppliers();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchCase = async () => {
      try {
        const matches = await apiFetch<ApiCaseSummary[]>(
          `/cases?search=${encodeURIComponent(prId)}`,
        );
        if (!active) {
          return;
        }
        const match = matches.find((record) => record.prNumber === prId);
        if (!match) {
          return;
        }
        setCaseId(match.id);
        const detail = await apiFetch<ApiCaseDetail>(`/cases/${match.id}`);
        if (!active) {
          return;
        }
    
        const mappedPr: PrRecord = {
          id: detail.prNumber,
          status: detail.status,
          summary: detail.subject,
          neededBy: new Date(detail.neededBy).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          requester: detail.requesterName,
          department: detail.department ?? 'N/S',
          buyer: detail.assignedBuyer?.name ?? 'Unassigned',
          priority: detail.priority,
          quotes: 0,
          updated: new Date(detail.updatedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          items: detail.items.map((item) => ({
            details: item.description,
            quantity: String(item.qty),
            unit: item.uom,
            preferredVendor: '—',
          })),
        };
        setPr(mappedPr);
        const supplierByFileId = new Map<string, string>();
        (detail.events ?? [])
          .filter((event) => event.type === 'QUOTE_RECEIVED')
          .forEach((event) => {
            try {
              const parsed = JSON.parse(event.detailJson) as {
                supplierName?: string;
                supplierEmail?: string;
                files?: Array<{ fileId?: string }>;
              };
              const supplierDisplay =
                parsed.supplierName?.trim() || parsed.supplierEmail?.trim() || 'Unknown supplier';
              (parsed.files ?? []).forEach((entry) => {
                if (entry.fileId) {
                  supplierByFileId.set(entry.fileId, supplierDisplay);
                }
              });
            } catch {
              // ignore malformed event payloads
            }
          });

        const filesById = new Map((detail.files ?? []).map((file) => [file.id, file]));
        const mappedQuotes =
          detail.quotes?.map((quote) => ({
            id: quote.id,
            supplier: quote.supplier?.name ?? 'Unknown supplier',
            amount: new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: quote.currency || 'USD',
            }).format(quote.amount),
            uploadedAt: quote.receivedAt
              ? new Date(quote.receivedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : '—',
            fileId: quote.fileId ?? null,
            documentName: quote.fileId ? filesById.get(quote.fileId)?.filename : undefined,
            deleteQuoteId: quote.id,
          })) ?? [];
        const linkedFileIds = new Set(
          mappedQuotes
            .map((quote) => quote.fileId)
            .filter((fileId): fileId is string => Boolean(fileId)),
        );
        const receivedUploads = (detail.files ?? [])
          .filter((file) => file.type === 'QUOTE_ATTACHMENT' && !linkedFileIds.has(file.id))
          .map((file) => ({
            id: `file-${file.id}`,
            supplier: supplierByFileId.get(file.id) ?? 'Unknown supplier',
            amount: '—',
            uploadedAt: file.createdAt
              ? new Date(file.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : '—',
            fileId: file.id,
            documentName: file.filename,
          }));
        setQuotes([...mappedQuotes, ...receivedUploads]);
        if (detail.status === 'IN_REVIEW') {
          const lastInReviewAt = (detail.events ?? [])
            .filter((event) => event.type === 'STATUS_CHANGE')
            .map((event) => {
              try {
                const parsed = JSON.parse(event.detailJson) as { to?: string };
                return parsed.to === 'IN_REVIEW' ? new Date(event.createdAt).getTime() : null;
              } catch {
                return null;
              }
            })
            .filter((value): value is number => value !== null)
            .sort((a, b) => b - a)[0];
          const hasQuoteAfterReview =
            typeof lastInReviewAt === 'number'
              ? (detail.quotes ?? []).some((quote) => new Date(quote.receivedAt).getTime() > lastInReviewAt)
              : false;
          setHasNewQuoteAfterReview(hasQuoteAfterReview);
        } else {
          setHasNewQuoteAfterReview(false);
        }
        setCaseFiles(detail.files ?? []);
        const mappedNotes =
          detail.notes?.map((note) => ({
            id: note.id,
            body: note.body,
            author: note.authorUserId
              ? usersById.get(note.authorUserId) ?? note.authorUserId
              : 'System',
            date: new Date(note.createdAt).toLocaleString('en-US'),
          })) ?? [];
        setNotes(mappedNotes);
        const events = detail.events ?? [];
        const mappedEvents = events.map((event) => {
          let action = event.type;
          try {
            const parsed = JSON.parse(event.detailJson) as Record<string, string>;
            if (event.type === 'STATUS_CHANGE') {
              const from = parsed.from ? getCaseStatusLabel(parsed.from) : '';
              const to = parsed.to ? getCaseStatusLabel(parsed.to) : '';
              action = `Status changed from ${from} to ${to}`.trim();
            }
          } catch {
            // ignore
          }
          return {
            id: event.id,
            user: event.actorUserId
              ? usersById.get(event.actorUserId) ?? event.actorUserId
              : 'System',
            date: new Date(event.createdAt).toLocaleString('en-US'),
            action,
            level: event.type === 'STATUS_CHANGE' ? 'Major' : 'Alert',
          } as const;
        });
        setAuditEvents(mappedEvents);
        setEmailBody((current) => (emailBodyTouched ? current : DEFAULT_QUOTE_REQUEST_TEXT));
      } catch {
        // ignore
      }
    };

    fetchCase();
    const interval = window.setInterval(fetchCase, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [prId, usersById, emailBodyTouched]);

  const assignBuyer = async () => {
    if (!caseId || !selectedBuyer || assigning) {
      return;
    }
    const wasAssigned = pr.buyer !== 'Unassigned';
    setAssigning(true);
    try {
      const updated = await apiFetch<ApiCaseDetail>(`/cases/${caseId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ buyerId: selectedBuyer }),
      });
      const buyerName = buyers.find((buyer) => buyer.id === selectedBuyer)?.name ?? 'Unassigned';
      setPr((current) => ({
        ...current,
        status: updated.status,
        buyer: buyerName,
      }));
      setAssignDialogOpen(false);
      if (currentUser?.role === 'BUYER' && wasAssigned) {
        router.push('/prs/inbox');
      }
    } catch {
      // ignore
    } finally {
      setAssigning(false);
    }
  };

  const toggleSupplier = (supplierId: string) => {
    setSelectedSupplierIds((current) => {
      const next = new Set(current);
      if (next.has(supplierId)) {
        next.delete(supplierId);
      } else {
        next.add(supplierId);
      }
      return next;
    });
  };

  const resetRequestDialog = () => {
    setRequestStep(0);
    setSelectedSupplierIds(new Set());
    setEmailBody(DEFAULT_QUOTE_REQUEST_TEXT);
    setEmailBodyTouched(false);
    setSendingRequest(false);
  };

  const sendQuoteRequest = async () => {
    if (!caseId || selectedSupplierIds.size === 0 || sendingRequest) {
      return;
    }
    setSendingRequest(true);
    try {
      await apiFetch(`/cases/${caseId}/request-quotes`, {
        method: 'POST',
        body: JSON.stringify({
          supplierIds: Array.from(selectedSupplierIds),
          messageTemplate: buildEmailBody(pr, emailBody),
        }),
      });
      pushToast({
        title: 'Message sent',
        message: 'Quote request sent successfully.',
        tone: 'success',
      });
      setRequestDialogOpen(false);
      resetRequestDialog();
    } catch {
      pushToast({
        title: 'Failed to send message',
        message: 'Failed to send quote request.',
        tone: 'error',
      });
    } finally {
      setSendingRequest(false);
    }
  };

  const postNote = async () => {
    if (!caseId || postingNote || noteBody.trim().length === 0) {
      return;
    }
    setPostingNote(true);
    try {
      const created = await apiFetch<{
        id: string;
        body: string;
        createdAt: string;
        authorUserId?: string | null;
      }>(`/cases/${caseId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body: noteBody }),
      });
      const author = created.authorUserId
        ? usersById.get(created.authorUserId) ?? created.authorUserId
        : 'System';
      setNotes((prev) => [
        {
          id: created.id,
          body: created.body,
          author,
          date: new Date(created.createdAt).toLocaleString('en-US'),
        },
        ...prev,
      ]);
      setNoteBody('');
    } catch {
      // ignore
    } finally {
      setPostingNote(false);
    }
  };

  const openQuoteDocument = async (fileId: string | null | undefined) => {
    let file = caseFiles.find((entry) => entry.id === fileId);
    if (!file) {
      return;
    }
    setSelectedDocument({
      name: file.filename,
      type: file.mimeType,
      url: `${apiBaseUrl}/uploads/quotes/${file.storageKey}`,
    });
    setVisualizerOpen(true);
  };

  const uploadCasePdf = async (file: File, type: string): Promise<UploadedCaseFile> => {
    if (!caseId) {
      throw new Error('Case not loaded');
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    const response = await fetch(`${apiBaseUrl}/cases/${caseId}/files`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    return response.json() as Promise<UploadedCaseFile>;
  };

  const uploadQuoteAttachment = async (file: File) => {
    if (!caseId || uploadingQuoteFile) {
      return;
    }
    if (!isPdfFile(file)) {
      setQuoteFileError('Only PDF documents can be uploaded.');
      return;
    }
    setQuoteFileError(null);
    setUploadingQuoteFile(true);
    try {
      const uploaded = await uploadCasePdf(file, 'QUOTE_ATTACHMENT');
      
      setQuoteFile({ id: uploaded.id, filename: uploaded.filename });
      setCaseFiles((prev) => [
        {
          id: uploaded.id,
          type: uploaded.type,
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
          storageKey: uploaded.storageKey,
          uploadedBy: uploaded.uploadedBy,
          createdAt: uploaded.createdAt,
        },
        ...prev,
      ]);
    } catch {
      setQuoteFileError('Failed to upload PDF document.');
    } finally {
      setUploadingQuoteFile(false);
    }
  };

  const uploadPoAttachment = async (file: File) => {
    if (!caseId || uploadingPoFile) {
      return;
    }
    if (!isPdfFile(file)) {
      setPoFileError('Only PDF documents can be uploaded.');
      return;
    }
    setPoFileError(null);
    setUploadingPoFile(true);
    try {
      const uploaded = await uploadCasePdf(file, 'PO_ATTACHMENT');
      setPoFile({ id: uploaded.id, filename: uploaded.filename });
      setCaseFiles((prev) => [uploaded, ...prev]);
    } catch {
      setPoFileError('Failed to upload PO document.');
    } finally {
      setUploadingPoFile(false);
    }
  };

  const uploadManualInvoiceAttachment = async (file: File) => {
    if (!caseId || uploadingManualInvoice) {
      return;
    }
    if (!isPdfFile(file)) {
      setManualInvoiceFileError('Only PDF documents can be uploaded.');
      return;
    }
    setManualInvoiceFileError(null);
    setUploadingManualInvoice(true);
    try {
      const uploaded = await uploadCasePdf(file, 'SUPPLIER_INVOICE');
      setManualInvoiceFile({ id: uploaded.id, filename: uploaded.filename });
      setCaseFiles((prev) => [uploaded, ...prev]);
    } catch {
      setManualInvoiceFileError('Failed to upload invoice document.');
    } finally {
      setUploadingManualInvoice(false);
    }
  };

  const saveQuote = async () => {
    if (!caseId || !quoteSupplierId || !quoteAmount || savingQuote) {
      return;
    }
    setSavingQuote(true);
    try {
      const created = await apiFetch<{
        id: string;
        amount: number;
        currency: string;
        supplier?: { name: string } | null;
      }>(`/cases/${caseId}/quotes`, {
        method: 'POST',
        body: JSON.stringify({
          supplierId: quoteSupplierId,
          amount: Number(quoteAmount),
          currency: quoteCurrency,
          fileId: quoteFile?.id,
        }),
      });
      setQuotes((prev) => [
        {
          id: created.id,
          supplier:
            created.supplier?.name ??
            suppliers.find((supplier) => supplier.id === quoteSupplierId)?.name ??
            'Unknown supplier',
          amount: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: created.currency || quoteCurrency,
          }).format(created.amount),
          uploadedAt: new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          fileId: quoteFile?.id ?? null,
          documentName: quoteFile?.filename,
          deleteQuoteId: created.id,
        },
        ...prev,
      ]);
      setQuoteDialogOpen(false);
      setQuoteSupplierId('');
      setQuoteAmount('');
      setQuoteCurrency('USD');
      setQuoteFile(null);
      if (pr.status === 'IN_REVIEW') {
        setHasNewQuoteAfterReview(true);
      }
    } catch {
      // ignore
    } finally {
      setSavingQuote(false);
    }
  };

  const deleteQuote = async (quoteId: string) => {
    if (!caseId || deletingQuoteId) {
      return;
    }
    setDeletingQuoteId(quoteId);
    try {
      await apiFetch<void>(`/cases/${caseId}/quotes/${quoteId}`, {
        method: 'DELETE',
      });
      setQuotes((prev) => prev.filter((quote) => quote.id !== quoteId));
      setQuoteToDelete(null);
    } catch {
      // ignore
    } finally {
      setDeletingQuoteId(null);
    }
  };

  const sendReview = async () => {
    if (!caseId || sendingReview) {
      return;
    }
    setSendingReview(true);
    try {
      await apiFetch(`/cases/${caseId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'IN_REVIEW' }),
      });
      pushToast({
        title: 'Message sent',
        message: 'Review notification sent successfully.',
        tone: 'success',
      });
      setPr((prev) => ({ ...prev, status: 'IN_REVIEW' }));
      setHasNewQuoteAfterReview(false);
    } catch (error) {
      const rawMessage =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to communicate with the review webhook.';
      let message = rawMessage;
      try {
        const parsed = JSON.parse(rawMessage) as { message?: string };
        if (parsed.message) {
          message = parsed.message;
        }
      } catch {
        // keep raw message
      }
      pushToast({
        title: 'Failed to send for review',
        message,
        tone: 'error',
      });
    } finally {
      setSendingReview(false);
    }
  };

  const handleSendReviewClick = () => {
    if (quotes.length < 3) {
      setConfirmReviewOpen(true);
      return;
    }
    void sendReview();
  };

  const requestInvoice = async () => {
    if (!caseId || requestingInvoice || !poFile || !selectedInvoiceSupplierId) {
      return;
    }
    setRequestingInvoice(true);
    try {
      await apiFetch(`/cases/${caseId}/request-invoice`, {
        method: 'POST',
        body: JSON.stringify({
          poFileId: poFile.id,
          supplierId: selectedInvoiceSupplierId || undefined,
          messageTemplate: invoiceMessage.trim() || undefined,
        }),
      });
      setPr((prev) => ({ ...prev, status: 'WAITING_INVOICE' }));
      setRequestInvoiceDialogOpen(false);
      setInvoiceMessage('');
      pushToast({
        title: 'Invoice requested',
        message: 'PO uploaded and invoice request sent to supplier.',
        tone: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to request invoice.';
      pushToast({
        title: 'Failed to request invoice',
        message,
        tone: 'error',
      });
    } finally {
      setRequestingInvoice(false);
    }
  };

  const submitManualInvoice = async () => {
    if (!caseId || !manualInvoiceFile || submittingManualInvoice) {
      return;
    }
    setSubmittingManualInvoice(true);
    try {
      await apiFetch(`/cases/${caseId}/supplier-invoice/manual`, {
        method: 'POST',
        body: JSON.stringify({
          fileId: manualInvoiceFile.id,
          supplierId: selectedInvoiceSupplierId || undefined,
        }),
      });
      setManualInvoiceDialogOpen(false);
      setManualInvoiceFile(null);
      setPr((prev) => ({ ...prev, status: 'WAITING_INVOICE' }));
      pushToast({
        title: 'Invoice received',
        message: 'Supplier invoice was uploaded successfully.',
        tone: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save supplier invoice.';
      pushToast({
        title: 'Failed to save invoice',
        message,
        tone: 'error',
      });
    } finally {
      setSubmittingManualInvoice(false);
    }
  };

  return (
    <PageShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-4 flex items-center gap-3">
              
            </div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-heading">{pr.id}</h2>
              <Badge variant="case" status={effectiveStatus}>{effectiveStatusLabel}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">
              {pr.summary} • assigned to {pr.buyer} • Needed by {pr.neededBy}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant={hasQuotes ? 'secondary' : pr.buyer !== 'Unassigned' ? 'secondary' : 'primary'}
                >
                  {pr.buyer !== 'Unassigned' ? 'Re-assign PR' : 'Assign buyer'}
                </Button>
              </DialogTrigger>
              <DialogContent className="motion-modal">
                <DialogTitle>
                  <VisuallyHidden>Assign PR to buyer</VisuallyHidden>
                </DialogTitle>
                <h3 className="text-lg font-semibold text-heading">Assign PR to buyer</h3>
                <p className="mt-2 text-sm text-muted">
                  Use automatic or manually override the buyer assignment.
                </p>
                <div className="mt-4 space-y-3">
                  <SegmentedControl
                    value={assignmentMethod}
                    onChange={setAssignmentMethod}
                    options={[
                      { label: 'Manual', value: 'manual' },
                      { label: 'Russian roulette', value: 'russian-roulette' },
                    ]}
                  />
                  {assignmentMethod === 'manual' && (
                    <Select
                      label="Select buyer"
                      value={selectedBuyer}
                      onChange={(e) => setSelectedBuyer(e.target.value)}
                      options={buyers.map((buyer) => ({
                        value: buyer.id,
                        label: buyer.name,
                      }))}
                    />
                  )}
                  <div className="mt-4 flex gap-3">
                    {assignmentMethod === 'manual' ? (
                      <>
                        <Button full onClick={assignBuyer} disabled={!selectedBuyer || assigning}>
                          {assigning ? 'Assigning...' : 'Assign'}
                        </Button>
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
            
            {pr.buyer !== 'Unassigned' ? (
              <Dialog
                open={requestDialogOpen}
                onOpenChange={(open) => {
                  setRequestDialogOpen(open);
                  if (!open) {
                    resetRequestDialog();
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant={effectiveStatus === 'READY_FOR_REVIEW' ? 'secondary' : 'primary'}
                  >
                    Request quotes
                  </Button>
                </DialogTrigger>
                <DialogContent className="motion-modal w-full max-w-3xl">
                  <DialogTitle>
                    <VisuallyHidden>Request quotes</VisuallyHidden>
                  </DialogTitle>
                  <h3 className="text-lg font-semibold text-heading">Request quotes</h3>
                  <p className="mt-2 text-sm text-muted">
                    Select suppliers, craft the email, and send your request.
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                    <span className={requestStep === 0 ? 'font-semibold text-slate-700' : ''}>
                      1. Suppliers
                    </span>
                    <span>→</span>
                    <span className={requestStep === 1 ? 'font-semibold text-slate-700' : ''}>
                      2. Email
                    </span>
                    <span>→</span>
                    <span className={requestStep === 2 ? 'font-semibold text-slate-700' : ''}>
                      3. Confirm
                    </span>
                  </div>

                  {requestStep === 0 ? (
                    <Card className="mt-4">
                      <CardHeader>
                        <h4 className="text-sm font-semibold text-heading">Select suppliers</h4>
                      </CardHeader>
                      <CardContent>
                        <Tabs defaultValue={categoryTabs[0]}>
                          <TabsList className="flex flex-wrap">
                            {categoryTabs.map((category) => (
                              <TabsTrigger key={category} value={category}>
                                {category}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                          {categoryTabs.map((category) => {
                            const filtered = category === 'All'
                              ? suppliers
                              : suppliers.filter((supplier) => {
                                  try {
                                    const parsed = JSON.parse(supplier.categories) as string[];
                                    return parsed.includes(category);
                                  } catch {
                                    return supplier.categories.includes(category);
                                  }
                                });
                            return (
                              <TabsContent key={category} value={category}>
                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                  {filtered.map((supplier) => (
                                    <label
                                      key={supplier.id}
                                      className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedSupplierIds.has(supplier.id)}
                                        onChange={() => toggleSupplier(supplier.id)}
                                        className="mt-1"
                                      />
                                      <div>
                                        <p className="font-medium text-slate-800">{supplier.name}</p>
                                        <p className="text-xs text-slate-500">{supplier.email}</p>
                                        
                                      </div>
                                    </label>
                                  ))}
                                  {filtered.length === 0 ? (
                                    <p className="text-sm text-slate-500">No suppliers found.</p>
                                  ) : null}
                                </div>
                              </TabsContent>
                            );
                          })}
                        </Tabs>
                      </CardContent>
                    </Card>
                  ) : null}

                  {requestStep === 1 ? (
                    <Card className="mt-4">
                      <CardHeader>
                        <h4 className="text-sm font-semibold text-heading">Email body</h4>
                      </CardHeader>
                      <CardContent>
                        <textarea
                          value={emailBody}
                          onChange={(event) => {
                            setEmailBodyTouched(true);
                            setEmailBody(event.target.value);
                          }}
                          rows={6}
                          className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </CardContent>
                    </Card>
                  ) : null}

                  {requestStep === 2 ? (
                    <Card className="mt-4">
                      <CardHeader>
                        <h4 className="text-sm font-semibold text-heading">Confirm & send</h4>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm text-slate-600">
                        <p>
                          Suppliers selected: <strong>{selectedSupplierIds.size}</strong>
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                          <div
                            className="text-slate-700 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-100 [&_th]:p-2 [&_th]:text-left"
                            dangerouslySetInnerHTML={{ __html: buildEmailBody(pr, emailBody) }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  <div className="mt-6 flex gap-3">
                    {requestStep > 0 ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setRequestStep((step) => step - 1)}
                      >
                        Back
                      </Button>
                    ) : null}
                    {requestStep < 2 ? (
                      <Button
                        size="sm"
                        onClick={() => setRequestStep((step) => step + 1)}
                        disabled={requestStep === 0 && selectedSupplierIds.size === 0}
                      >
                        Continue
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={sendQuoteRequest}
                        disabled={selectedSupplierIds.size === 0 || sendingRequest}
                      >
                        {sendingRequest ? 'Sending...' : 'Send request'}
                      </Button>
                    )}
                    <DialogClose asChild>
                      <Button variant="secondary" size="sm">Cancel</Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
            {showSendForReviewButton ? (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSendReviewClick}
                  disabled={sendingReview}
                >
                  {sendingReview ? 'Sending...' : 'Send for review'}
                </Button>
                <Dialog open={confirmReviewOpen} onOpenChange={setConfirmReviewOpen}>
                  <DialogContent className="motion-modal">
                    <DialogTitle>
                      <VisuallyHidden>Confirm sending for review</VisuallyHidden>
                    </DialogTitle>
                    <h3 className="text-lg font-semibold text-heading">Send for review?</h3>
                    <p className="mt-2 text-sm text-muted">
                      This PR has {quotes.length} quote{quotes.length === 1 ? '' : 's'}. Are you
                      sure you want to send it for review now?
                    </p>
                    <div className="mt-6 flex gap-3">
                      <Button
                        full
                        onClick={() => {
                          setConfirmReviewOpen(false);
                          void sendReview();
                        }}
                        disabled={sendingReview}
                      >
                        {sendingReview ? 'Sending...' : 'Send anyway'}
                      </Button>
                      <DialogClose asChild>
                        <Button full variant="secondary">Cancel</Button>
                      </DialogClose>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : null}
            {effectiveStatus === 'IN_REVIEW' || effectiveStatus === 'REQUEST_INVOICE' ? (
              <Dialog
                open={requestInvoiceDialogOpen}
                onOpenChange={(open) => {
                  setRequestInvoiceDialogOpen(open);
                  if (!open) {
                    setPoFileError(null);
                    setSelectedInvoiceSupplierId('');
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" variant="primary">Request invoice</Button>
                </DialogTrigger>
                <DialogContent className="motion-modal w-full max-w-2xl">
                  <DialogTitle>
                    <VisuallyHidden>Request supplier invoice</VisuallyHidden>
                  </DialogTitle>
                  <h3 className="text-lg font-semibold text-heading">Request Invoice</h3>
                  <p className="mt-2 text-sm text-muted">
                    Upload the PO and send the invoice request to the supplier.
                  </p>
                  <div className="mt-4 space-y-4">
                    <FileDropzone
                      label="Drag and drop PO PDF here, or click to upload"
                      onFileSelected={uploadPoAttachment}
                      disabled={uploadingPoFile || requestingInvoice}
                      accept="application/pdf,.pdf"
                    />
                    {poFile ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        Uploaded PO: {poFile.filename}
                      </div>
                    ) : uploadingPoFile ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                        Uploading PO...
                      </div>
                    ) : null}
                    {poFileError ? (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {poFileError}
                      </div>
                    ) : null}
                    <Select
                      label="Supplier"
                      value={selectedInvoiceSupplierId}
                      onChange={(event) => setSelectedInvoiceSupplierId(event.target.value)}
                      options={[
                        { value: '', label: 'Select supplier' },
                        ...suppliers.map((supplier) => ({
                          value: supplier.id,
                          label: supplier.name,
                        })),
                      ]}
                    />
                    <label className="block text-sm font-medium text-slate-700">
                      Message (optional)
                      <textarea
                        value={invoiceMessage}
                        onChange={(event) => setInvoiceMessage(event.target.value)}
                        rows={4}
                        className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        placeholder="Please send your invoice and tax details."
                      />
                    </label>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <Button
                      full
                      onClick={requestInvoice}
                      disabled={!poFile || !selectedInvoiceSupplierId || requestingInvoice}
                    >
                      {requestingInvoice ? 'Sending...' : 'Send request'}
                    </Button>
                    <DialogClose asChild>
                      <Button full variant="secondary">Cancel</Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
            {effectiveStatus === 'WAITING_INVOICE' ? (
              <Dialog
                open={manualInvoiceDialogOpen}
                onOpenChange={(open) => {
                  setManualInvoiceDialogOpen(open);
                  if (!open) {
                    setManualInvoiceFileError(null);
                    setManualInvoiceFile(null);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary">Upload invoice</Button>
                </DialogTrigger>
                <DialogContent className="motion-modal w-full max-w-xl">
                  <DialogTitle>
                    <VisuallyHidden>Upload supplier invoice</VisuallyHidden>
                  </DialogTitle>
                  <h3 className="text-lg font-semibold text-heading">Waiting for Invoice</h3>
                  <p className="mt-2 text-sm text-muted">
                    Upload invoice manually if it was received outside the supplier webhook.
                  </p>
                  <div className="mt-4 space-y-3">
                    <FileDropzone
                      label="Drag and drop supplier invoice PDF here"
                      onFileSelected={uploadManualInvoiceAttachment}
                      disabled={uploadingManualInvoice || submittingManualInvoice}
                      accept="application/pdf,.pdf"
                    />
                    {manualInvoiceFile ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        Uploaded invoice: {manualInvoiceFile.filename}
                      </div>
                    ) : uploadingManualInvoice ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                        Uploading invoice...
                      </div>
                    ) : null}
                    {manualInvoiceFileError ? (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {manualInvoiceFileError}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-6 flex gap-3">
                    <Button full onClick={submitManualInvoice} disabled={!manualInvoiceFile || submittingManualInvoice}>
                      {submittingManualInvoice ? 'Saving...' : 'Confirm invoice received'}
                    </Button>
                    <DialogClose asChild>
                      <Button full variant="secondary">Cancel</Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkspaceTab)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {/* <TabsTrigger value="checklist">Checklist</TabsTrigger> */}
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
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
                    <span className="font-medium text-slate-800">{pr.requester}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Department</span>
                    <span className="font-medium text-slate-800">{pr.department} Department</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Budget</span>
                    <span className="font-medium text-slate-800">N/S</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold text-heading">Status progression</h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                  {statusSteps.map((step, index) => {
                    const isActive = index <= activeStepIndex;
                    return (
                      <div key={step.status} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`h-3 w-3 rounded-full ${
                              isActive ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          />
                          {index < statusSteps.length - 1 && (
                            <div className="mt-2 h-8 w-0.5 bg-slate-200" />
                          )}
                        </div>
                        <div className="pt-0.5 pb-4">
                          <p
                            className={`text-sm font-medium ${
                              isActive ? 'text-slate-800' : 'text-slate-400'
                            }`}
                          >
                            {step.label}
                          </p>
                        </div>
                      </div>
                    );
                  })}
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
                      <TableHead>Uploaded</TableHead>
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
                  <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="secondary" disabled={!caseId}>
                        Add quote
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="motion-modal w-full max-w-2xl">
                      <DialogTitle>
                        <VisuallyHidden>Add supplier quote</VisuallyHidden>
                      </DialogTitle>
                      <h3 className="text-lg font-semibold text-heading">Add supplier quote</h3>
                      <p className="mt-2 text-sm text-muted">
                        Upload the supplier quote and capture the pricing details.
                      </p>
                      <div className="mt-4 space-y-4">
                        <FileDropzone
                          label="Drag and drop the quote PDF here, or click to upload"
                          onFileSelected={uploadQuoteAttachment}
                          disabled={uploadingQuoteFile}
                          accept="application/pdf,.pdf"
                        />
                        {quoteFile ? (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            Uploaded: {quoteFile.filename}
                          </div>
                        ) : uploadingQuoteFile ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                            Uploading file...
                          </div>
                        ) : quoteFileError ? (
                          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            {quoteFileError}
                          </div>
                        ) : null}
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="text-sm font-medium text-slate-700">
                            Supplier name
                            <select
                              value={quoteSupplierId}
                              onChange={(event) => setQuoteSupplierId(event.target.value)}
                              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            >
                              <option value="">Select supplier</option>
                              {suppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                  {supplier.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm font-medium text-slate-700">
                            Amount
                            <input
                              value={quoteAmount}
                              onChange={(event) => setQuoteAmount(event.target.value)}
                              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                              placeholder="0.00"
                            />
                          </label>
                          <label className="text-sm font-medium text-slate-700">
                            Currency
                            <select
                              value={quoteCurrency}
                              onChange={(event) => setQuoteCurrency(event.target.value)}
                              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            >
                              <option value="MZN">MZN</option>
                              <option value="ZAR">ZAR</option>
                              <option value="USD">USD</option>
                            </select>
                          </label>
                        </div>
                      </div>
                      <div className="mt-6 flex gap-3">
                        <Button
                          full
                          onClick={saveQuote}
                          disabled={
                            savingQuote ||
                            !quoteSupplierId ||
                            !quoteAmount ||
                            !quoteFile
                          }
                        >
                          {savingQuote ? 'Saving...' : 'Save quote'}
                        </Button>
                        <DialogClose asChild>
                          <Button full variant="secondary">Cancel</Button>
                        </DialogClose>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Received from</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Uploaded date</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <tbody>
                    {quotes.map((row) => (
                      <TableRow
                        key={row.id}
                        className={row.fileId ? 'cursor-pointer hover:bg-slate-50' : undefined}
                        onClick={() => openQuoteDocument(row.fileId)}
                      >
                        <TableCell>{row.supplier}</TableCell>
                        <TableCell>{row.amount}</TableCell>
                        <TableCell>{row.uploadedAt}</TableCell>
                        <TableCell>
                          {row.fileId ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                openQuoteDocument(row.fileId);
                              }}
                            >
                              {row.documentName ?? 'View document'}
                            </Button>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {row.deleteQuoteId ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (!row.deleteQuoteId) {
                                  return;
                                }
                                setQuoteToDelete({ id: row.deleteQuoteId, supplier: row.supplier });
                              }}
                              disabled={deletingQuoteId === row.deleteQuoteId}
                            >
                              {deletingQuoteId === row.deleteQuoteId ? 'Deleting...' : 'Delete'}
                            </Button>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
                <Dialog
                  open={Boolean(quoteToDelete)}
                  onOpenChange={(open) => {
                    if (!open && !deletingQuoteId) {
                      setQuoteToDelete(null);
                    }
                  }}
                >
                  <DialogContent className="motion-modal">
                    <DialogTitle>
                      <VisuallyHidden>Confirm quote deletion</VisuallyHidden>
                    </DialogTitle>
                    <h3 className="text-lg font-semibold text-heading">Delete quote file?</h3>
                    <p className="mt-2 text-sm text-muted">
                      This will remove the quote from <strong>{quoteToDelete?.supplier ?? 'supplier'}</strong>.
                      This action cannot be undone.
                    </p>
                    <div className="mt-6 flex gap-3">
                      <Button
                        full
                        onClick={() => {
                          if (quoteToDelete) {
                            void deleteQuote(quoteToDelete.id);
                          }
                        }}
                        disabled={!quoteToDelete || Boolean(deletingQuoteId)}
                      >
                        {deletingQuoteId ? 'Deleting...' : 'Delete'}
                      </Button>
                      <DialogClose asChild>
                        <Button full variant="secondary" disabled={Boolean(deletingQuoteId)}>
                          Cancel
                        </Button>
                      </DialogClose>
                    </div>
                  </DialogContent>
                </Dialog>
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
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
              />
              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={postNote}
                  disabled={postingNote || noteBody.trim().length === 0}
                >
                  {postingNote ? 'Posting...' : 'Post Note'}
                </Button>
              </div>
              <div className="mt-6">
                <h4 className="mb-4 font-semibold text-heading">Previous Notes:</h4>
                <div className="space-y-3">
                {notes.map((note) => {
                  const initials = note.author
                    .split(' ')
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                  return (
                    <div key={note.id} className="flex gap-3 items-start">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 flex-shrink-0">
                          {initials || '—'}
                        </div>
                      </div>
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex-1">
                        <p className="text-sm font-medium text-slate-800">{note.author}</p>
                        <p className="text-sm text-slate-800">{note.body}</p>
                        <span className="text-xs text-slate-500">{note.date}</span>
                      </div>
                    </div>
                  );
                })}
                {notes.length === 0 ? (
                  <p className="text-sm text-slate-500">No notes yet.</p>
                ) : null}
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
                  {caseFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>{file.filename}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedDocument({
                              name: file.filename,
                              type: file.mimeType,
                              url: `${apiBaseUrl}/uploads/quotes/${file.storageKey}`,
                            });
                            setVisualizerOpen(true);
                          }}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Button>
                        <a href={`${apiBaseUrl}/uploads/quotes/${file.storageKey}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="secondary">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </Button>
                        </a>
                      </div>
                    </div>
                  ))}
                  {caseFiles.length === 0 ? (
                    <p className="text-sm text-slate-500">No documents uploaded yet.</p>
                  ) : null}
                </div>
                </CardContent>
            </Card>
          </TabsContent>
          <DocumentVisualizer 
            open={visualizerOpen}
            onOpenChange={setVisualizerOpen}
            document={selectedDocument}
          />
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
                  {auditEvents.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.user}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell>
                        <Badge variant="default">
                          {row.level}
                        </Badge>
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
