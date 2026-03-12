import type { CaseStatus } from './types';

const caseStatusLabelMap: Record<CaseStatus, string> = {
  NEW: 'New',
  MISSING_INFO: 'Missing Info',
  ASSIGNED: 'Assigned',
  WAITING_QUOTES: 'Waiting Quotes',
  READY_FOR_REVIEW: 'Ready for Review',
  IN_REVIEW: 'In review',
  REQUEST_INVOICE: 'Request Invoice',
  WAITING_INVOICE: 'Waiting for Invoice',
  REQUEST_RECEIPT: 'Request Receipt',
  WAITING_RECEIPT: 'Waiting for Receipt',
  CLOSED_PAID: 'Closed & Paid',
  SENT: 'Sent',
  CLOSED: 'Closed',
  QUARANTINE: 'Quarantine',
};

export function getCaseStatusLabel(status: string) {
  return caseStatusLabelMap[status as CaseStatus] ?? status.replace(/_/g, ' ');
}
