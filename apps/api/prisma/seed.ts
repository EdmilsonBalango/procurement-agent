import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const priorities: string[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const statuses: string[] = [
  'NEW',
  'ASSIGNED',
  'WAITING_QUOTES',
  'READY_FOR_REVIEW',
  'READY_TO_SEND',
  'SENT',
  'CLOSED',
  'MISSING_INFO',
];

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@local' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@local',
      role: 'ADMIN',
      passwordHash,
    },
  });

  const buyer1 = await prisma.user.upsert({
    where: { email: 'buyer1@local' },
    update: {},
    create: {
      name: 'Buyer One',
      email: 'buyer1@local',
      role: 'BUYER',
      passwordHash,
    },
  });

  const buyer2 = await prisma.user.upsert({
    where: { email: 'buyer2@local' },
    update: {},
    create: {
      name: 'Buyer Two',
      email: 'buyer2@local',
      role: 'BUYER',
      passwordHash,
    },
  });

  await prisma.supplier.deleteMany();
  const suppliers = await Promise.all(
    Array.from({ length: 10 }).map((_, index) =>
      prisma.supplier.create({
        data: {
          name: `Supplier ${index + 1}`,
          email: `supplier${index + 1}@example.com`,
          categories: JSON.stringify(['IT', 'Facilities', 'Marketing'].slice(0, (index % 3) + 1)),
          isActive: true,
        },
      }),
    ),
  );

  await prisma.case.deleteMany();

  for (let i = 0; i < 10; i += 1) {
    const assignedBuyer = i % 2 === 0 ? buyer1 : buyer2;
    const caseRecord = await prisma.case.create({
      data: {
        prNumber: `PR-2024-${1000 + i}`,
        subject: `Procurement request ${i + 1}`,
        requesterName: `Requester ${i + 1}`,
        requesterEmail: `requester${i + 1}@example.com`,
        department: 'Operations',
        priority: priorities[i % priorities.length],
        neededBy: new Date(Date.now() + 1000 * 60 * 60 * 24 * (5 + i)),
        costCenter: `CC-${200 + i}`,
        deliveryLocation: 'HQ Warehouse',
        budgetEstimate: 1000 + i * 250,
        status: statuses[i % statuses.length],
        assignedBuyerId: assignedBuyer.id,
        items: {
          create: [
            {
              description: 'Laptop hardware',
              qty: 2,
              uom: 'units',
              specs: '16GB RAM, 512GB SSD',
            },
          ],
        },
        checklist: {
          create: [
            { title: 'Requester info verified', status: 'DONE', ownerRole: 'SYSTEM' },
            { title: 'Budget approval', status: 'OPEN', ownerRole: 'BUYER' },
          ],
        },
      },
    });

    const quotesToCreate = i % 4; // 0-3
    for (let q = 0; q < quotesToCreate; q += 1) {
      const supplier = suppliers[(i + q) % suppliers.length];
      await prisma.quote.create({
        data: {
          caseId: caseRecord.id,
          supplierId: supplier.id,
          amount: 1200 + q * 150,
          currency: 'USD',
          notes: 'Initial estimate',
        },
      });
    }
  }

  await prisma.notification.deleteMany();
  await prisma.notification.create({
    data: {
      userId: buyer1.id,
      type: 'ASSIGNMENT',
      title: 'New PR assigned',
      body: 'PR-2024-1000 assigned to you',
      severity: 'INFO',
    },
  });

  await prisma.caseEvent.create({
    data: {
      caseId: (await prisma.case.findFirstOrThrow()).id,
      actorUserId: admin.id,
      type: 'STATUS_CHANGE',
      detailJson: JSON.stringify({ from: 'NEW', to: 'ASSIGNED' }),
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
