/**
 * Status color mapping for different case and priority statuses
 */

export const caseStatusColors: Record<string, { bg: string; text: string; border: string }> = {
  NEW: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  MISSING_INFO: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  ASSIGNED: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  WAITING_QUOTES: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  READY_FOR_REVIEW: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  READY_TO_SEND: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  CLOSED_PAID: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  SENT: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  CLOSED: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
};

export const priorityColors: Record<string, { bg: string; text: string; border: string }> = {
  LOW: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  MEDIUM: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  HIGH: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  URGENT: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
};

export const checklistStatusColors: Record<string, { bg: string; text: string; border: string }> = {
  OPEN: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  DONE: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  BLOCKED: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
};

export const notificationSeverityColors: Record<string, { bg: string; text: string; border: string }> = {
  INFO: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  WARN: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  CRITICAL: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
};

export const roleColors: Record<string, { bg: string; text: string; border: string }> = {
  ADMIN: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  BUYER: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
  },
};

/**
 * Get color scheme for a status value
 * @param status - Status value to get colors for
 * @param type - Type of status (case, priority, checklist, severity, role)
 */
export function getStatusColors(
  status: string,
  type: 'case' | 'priority' | 'checklist' | 'severity' | 'role' = 'case',
) {
  switch (type) {
    case 'priority':
      return priorityColors[status] || priorityColors.MEDIUM;
    case 'checklist':
      return checklistStatusColors[status] || checklistStatusColors.OPEN;
    case 'severity':
      return notificationSeverityColors[status] || notificationSeverityColors.INFO;
    case 'role':
      return roleColors[status] || roleColors.BUYER;
    case 'case':
    default:
      return caseStatusColors[status] || caseStatusColors.NEW;
  }
}
