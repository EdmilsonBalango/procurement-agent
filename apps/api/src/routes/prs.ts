import { FastifyInstance } from 'fastify';
import {
  createCase,
  createCaseItems,
  createCaseEvent,
  createNotification,
  getNextPrNumber,
  listUsersByRole,
} from '../lib/db.js';

export async function prRoutes(app: FastifyInstance) {
  app.post(
    '/prs',
    {
      schema: {
        body: {
          type: 'object',
          required: [
            'is_purchase_request',
            'confidence_score',
            'subject',
            'requester',
            'business_priority',
            'needed_by_date',
            'delivery_location',
            'cost_center',
            'budget_estimate',
            'items',
            'attachments_relevance',
            'missing_information',
            'compliance_flags',
            'summary_for_procurement',
          ],
          properties: {
            is_purchase_request: { type: 'boolean' },
            confidence_score: { type: 'number', minimum: 0, maximum: 1 },
            subject: { type: ['string', 'null'] },
            requester: {
              type: 'object',
              required: ['name', 'email', 'department'],
              properties: {
                name: { type: ['string', 'null'] },
                email: { type: ['string', 'null'] },
                department: { type: ['string', 'null'] },
              },
              additionalProperties: false,
            },
            business_priority: {
              type: ['string', 'null'],
              enum: ['low', 'normal', 'high', 'urgent', null],
            },
            needed_by_date: { type: ['string', 'null'] },
            delivery_location: { type: ['string', 'null'] },
            cost_center: { type: ['string', 'null'] },
            budget_estimate: { type: ['number', 'null'] },
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: [
                  'description',
                  'quantity',
                  'unit_of_measure',
                  'specifications',
                  'preferred_vendor',
                ],
                properties: {
                  description: { type: 'string' },
                  quantity: { type: ['number', 'null'] },
                  unit_of_measure: { type: ['string', 'null'] },
                  specifications: { type: ['string', 'null'] },
                  preferred_vendor: { type: ['string', 'null'] },
                },
                additionalProperties: false,
              },
            },
            attachments_relevance: {
              type: 'string',
              enum: ['specifications', 'quotes', 'approvals', 'unknown'],
            },
            missing_information: { type: 'array', items: { type: 'string' } },
            compliance_flags: {
              type: 'object',
              required: ['requires_minimum_3_quotes', 'approval_required', 'high_value_purchase'],
              properties: {
                requires_minimum_3_quotes: { type: 'boolean' },
                approval_required: { type: 'boolean' },
                high_value_purchase: { type: 'boolean' },
              },
              additionalProperties: false,
            },
            summary_for_procurement: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        is_purchase_request: boolean;
        confidence_score: number;
        subject: string | null;
        requester: {
          name: string | null;
          email: string | null;
          department: string | null;
        };
        business_priority: 'low' | 'normal' | 'high' | 'urgent' | null;
        needed_by_date: string | null;
        delivery_location: string | null;
        cost_center: string | null;
        budget_estimate: number | null;
        items?: Array<{
          description: string;
          quantity: number | null;
          unit_of_measure: string | null;
          specifications: string | null;
          preferred_vendor: string | null;
        }>;
        attachments_relevance: 'specifications' | 'quotes' | 'approvals' | 'unknown';
        missing_information: string[];
        compliance_flags: {
          requires_minimum_3_quotes: boolean;
          approval_required: boolean;
          high_value_purchase: boolean;
        };
        summary_for_procurement: string;
      };

      const priorityMap: Record<
        Exclude<typeof body.business_priority, null>,
        'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
      > = {
        low: 'LOW',
        normal: 'MEDIUM',
        high: 'HIGH',
        urgent: 'URGENT',
      };

      const created = await createCase({
        prNumber: await getNextPrNumber(),
        subject: body.subject ?? 'No Subject',
        requesterName: body.requester.name ?? 'Unknown',
        requesterEmail: body.requester.email ?? 'unknown@local',
        department: body.requester.department ?? 'Unknown',
        priority: body.business_priority ? priorityMap[body.business_priority] : 'MEDIUM',
        neededBy: body.needed_by_date ? new Date(body.needed_by_date) : new Date(),
        costCenter: body.cost_center ?? 'Unspecified',
        deliveryLocation: body.delivery_location ?? 'Unspecified',
        budgetEstimate: body.budget_estimate ?? 0,
        status: 'NEW',
        summaryForProcurement: body.summary_for_procurement ?? 'no summary provided',
      });
      await createCaseEvent({
        caseId: created.id,
        actorUserId: request.user?.id,
        type: 'CREATED',
        detailJson: JSON.stringify({ prNumber: created.prNumber }),
      });

      const [buyers, admins] = await Promise.all([
        listUsersByRole('BUYER'),
        listUsersByRole('ADMIN'),
      ]);
      const recipients = [...buyers, ...admins];
      const notificationBody = `${created.prNumber} submitted for intake review`;
      await Promise.all(
        recipients.map((user) =>
          createNotification({
            userId: user.id,
            type: 'NEW_PR',
            title: 'New PR submitted',
            body: notificationBody,
            caseId: created.id,
            severity: 'INFO',
            isRead: false,
          }),
        ),
      );

      const items = body.items
        ? await createCaseItems(
            created.id,
            body.items.map((item) => ({
              description: item.description,
              qty: item.quantity ?? 0,
              uom: item.unit_of_measure ?? 'N/A',
              specs: item.specifications ?? 'N/A',
            })),
          )
        : [];

      return reply.status(201).send({ ...created, items });

    },
  );
}
