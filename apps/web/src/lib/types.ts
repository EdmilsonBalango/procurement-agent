export type CaseStatus =
  | 'NEW'
  | 'MISSING_INFO'
  | 'ASSIGNED'
  | 'WAITING_QUOTES'
  | 'READY_FOR_REVIEW'
  | 'READY_TO_SEND'
  | 'CLOSED_PAID'
  | 'SENT'
  | 'CLOSED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type PrRecord = {
  id: string;
  status: CaseStatus;
  summary: string;
  neededBy: string;
  requester: string;
  department?: string;
  buyer: string;
  priority: Priority;
  quotes: number;
  updated: string;
  items: {
    details: string;
    quantity: string;
    unit: string;
    preferredVendor: string;
  }[];
};
