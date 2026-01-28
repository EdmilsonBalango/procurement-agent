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

export type Supplier = {
  name: string;
  categories: string;
  status: 'Active' | 'Inactive';
  email: string;
  phonePrimary: string;
  phoneSecondary: string;
  location: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  status: 'READ' | 'UNREAD';
  prId?: string;
  receivedAt: string;
};

export type PrRecord = {
  id: string;
  status: CaseStatus;
  summary: string;
  neededBy: string;
  requester: string;
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

export type User = {
  name: string;
  email: string;
  role: 'ADMIN' | 'BUYER';
};

export const prRecords: PrRecord[] = [
  {
    id: 'PR-2024-1001',
    status: 'WAITING_QUOTES',
    summary: 'IT hardware refresh for new hires',
    neededBy: 'May 12',
    requester: 'Alex Johnson',
    buyer: 'Buyer 1',
    priority: 'HIGH',
    quotes: 2,
    updated: '2h ago',
    items: [
      {
        details: 'Laptop computers',
        quantity: '12',
        unit: 'Units',
        preferredVendor: 'Supplier 1',
      },
      {
        details: 'USB-C docking stations',
        quantity: '12',
        unit: 'Units',
        preferredVendor: 'Supplier 2',
      },
    ],
  },
  {
    id: 'PR-2024-1002',
    status: 'MISSING_INFO',
    summary: 'Facilities maintenance contracts',
    neededBy: 'May 18',
    requester: 'Morgan Lee',
    buyer: 'Buyer 2',
    priority: 'MEDIUM',
    quotes: 0,
    updated: '6h ago',
    items: [
      {
        details: 'HVAC quarterly maintenance',
        quantity: '4',
        unit: 'Visits',
        preferredVendor: 'Supplier 2',
      },
    ],
  },
  {
    id: 'PR-2024-1003',
    status: 'READY_FOR_REVIEW',
    summary: 'Field marketing event support',
    neededBy: 'May 30',
    requester: 'Morgan Lee',
    buyer: 'Buyer 2',
    priority: 'MEDIUM',
    quotes: 3,
    updated: '5h ago',
    items: [
      {
        details: 'Event booth rental',
        quantity: '1',
        unit: 'Booth',
        preferredVendor: 'Supplier 3',
      },
      {
        details: 'Swag pack printing',
        quantity: '500',
        unit: 'Units',
        preferredVendor: 'Supplier 1',
      },
    ],
  },
  {
    id: 'PR-2024-1004',
    status: 'ASSIGNED',
    summary: 'Urgent delivery exception',
    neededBy: 'Jun 02',
    requester: 'Morgan Lee',
    buyer: 'Buyer 1',
    priority: 'MEDIUM',
    quotes: 1,
    updated: '1d ago',
    items: [
      {
        details: 'Same-day courier service',
        quantity: '1',
        unit: 'Job',
        preferredVendor: 'Supplier 2',
      },
    ],
  },
  {
    id: 'PR-2024-1005',
    status: 'WAITING_QUOTES',
    summary: 'Marketing campaign launch assets',
    neededBy: 'Jun 28',
    requester: 'Jamie Parker',
    buyer: 'Buyer 2',
    priority: 'MEDIUM',
    quotes: 1,
    updated: '3h ago',
    items: [
      {
        details: 'Creative asset design package',
        quantity: '6',
        unit: 'Assets',
        preferredVendor: 'Supplier 3',
      },
      {
        details: 'Paid social ad placements',
        quantity: '3',
        unit: 'Campaigns',
        preferredVendor: 'Supplier 1',
      },
      {
        details: 'Campaign performance reporting',
        quantity: '1',
        unit: 'Report',
        preferredVendor: 'Supplier 2',
      },
    ],
  },
  {
    id: 'PR-2024-1006',
    status: 'READY_FOR_REVIEW',
    summary: 'Security services renewal',
    neededBy: 'Jul 01',
    requester: 'Morgan Lee',
    buyer: 'Buyer 1',
    priority: 'MEDIUM',
    quotes: 3,
    updated: '1d ago',
    items: [
      {
        details: 'On-site security coverage',
        quantity: '12',
        unit: 'Months',
        preferredVendor: 'Supplier 2',
      },
    ],
  },
  {
    id: 'PR-2024-1007',
    status: 'ASSIGNED',
    summary: 'Design system vendor renewal',
    neededBy: 'Jul 04',
    requester: 'Morgan Lee',
    buyer: 'Buyer 1',
    priority: 'MEDIUM',
    quotes: 0,
    updated: '1d ago',
    items: [
      {
        details: 'Design system platform renewal',
        quantity: '1',
        unit: 'License',
        preferredVendor: 'Supplier 1',
      },
    ],
  },
  {
    id: 'PR-2024-1008',
    status: 'MISSING_INFO',
    summary: 'Office refresh plan',
    neededBy: 'Jul 20',
    requester: 'Morgan Lee',
    buyer: 'Buyer 2',
    priority: 'MEDIUM',
    quotes: 0,
    updated: '2d ago',
    items: [
      {
        details: 'Ergonomic chairs',
        quantity: '25',
        unit: 'Units',
        preferredVendor: 'Supplier 3',
      },
    ],
  },
  {
    id: 'PR-2024-1009',
    status: 'MISSING_INFO',
    summary: 'Agency retainer renewal',
    neededBy: 'Jul 22',
    requester: 'Morgan Lee',
    buyer: 'Buyer 1',
    priority: 'MEDIUM',
    quotes: 0,
    updated: '2d ago',
    items: [
      {
        details: 'Creative agency retainer',
        quantity: '1',
        unit: 'Contract',
        preferredVendor: 'Supplier 3',
      },
    ],
  },
  {
    id: 'PR-2024-1010',
    status: 'MISSING_INFO',
    summary: 'Laptops for new hires',
    neededBy: 'Aug 01',
    requester: 'Morgan Lee',
    buyer: 'Buyer 2',
    priority: 'MEDIUM',
    quotes: 0,
    updated: '3d ago',
    items: [
      {
        details: 'Developer laptops',
        quantity: '8',
        unit: 'Units',
        preferredVendor: 'Supplier 1',
      },
    ],
  },
  {
    id: 'PR-2024-1011',
    status: 'MISSING_INFO',
    summary: 'Training platform subscription',
    neededBy: 'Aug 06',
    requester: 'Morgan Lee',
    buyer: 'Buyer 1',
    priority: 'MEDIUM',
    quotes: 0,
    updated: '4d ago',
    items: [
      {
        details: 'Learning management system',
        quantity: '1',
        unit: 'Subscription',
        preferredVendor: 'Supplier 2',
      },
    ],
  },
  {
    id: 'PR-2024-1012',
    status: 'MISSING_INFO',
    summary: 'Marketing automation updates',
    neededBy: 'Aug 12',
    requester: 'Morgan Lee',
    buyer: 'Buyer 1',
    priority: 'MEDIUM',
    quotes: 0,
    updated: '4d ago',
    items: [
      {
        details: 'Marketing automation add-ons',
        quantity: '2',
        unit: 'Modules',
        preferredVendor: 'Supplier 3',
      },
    ],
  },
];

export const notifications: Notification[] = [
  {
    id: 'note-1',
    title: 'PR-2024-1005 is ready for review',
    body: 'Three quotes have been logged.',
    status: 'UNREAD',
    prId: 'PR-2024-1005',
    receivedAt: 'Jan 24, 2026 • 9:42 AM',
  },
  {
    id: 'note-2',
    title: 'Supplier 2 submitted quote',
    body: 'Quote received for PR-2024-1004.',
    status: 'READ',
    prId: 'PR-2024-1004',
    receivedAt: 'Jan 23, 2026 • 4:18 PM',
  },
];

export const suppliers: Supplier[] = [
  {
    name: 'Supplier 1',
    categories: 'IT, SaaS',
    status: 'Active',
    email: 'ops@supplier1.com',
    phonePrimary: '(415) 555-0123',
    phoneSecondary: '(415) 555-0144',
    location: 'San Francisco, CA',
  },
  {
    name: 'Supplier 2',
    categories: 'Facilities',
    status: 'Active',
    email: 'support@supplier2.com',
    phonePrimary: '(312) 555-0188',
    phoneSecondary: '(312) 555-0199',
    location: 'Chicago, IL',
  },
  {
    name: 'Supplier 3',
    categories: 'Marketing',
    status: 'Inactive',
    email: 'hello@supplier3.com',
    phonePrimary: '(212) 555-0110',
    phoneSecondary: '(212) 555-0166',
    location: 'New York, NY',
  },
];

export const users: User[] = [
  { name: 'Admin User', email: 'admin@local', role: 'ADMIN' },
  { name: 'Buyer One', email: 'buyer1@local', role: 'BUYER' },
  { name: 'Buyer Two', email: 'buyer2@local', role: 'BUYER' },
];

export const stageData = [
  { label: 'New', count: 6 },
  { label: 'Assigned', count: 4 },
  { label: 'Waiting Quotes', count: 3 },
  { label: 'Ready for Review', count: 2 },
  { label: 'Ready to Send', count: 1 },
  { label: 'Closed & Paid', count: 1 },
];
