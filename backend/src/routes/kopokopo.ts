import express, { Request, Response } from 'express';
import { initiateSTKPush, getPaymentStatus, subscribeWebhook, validateWebhookSignature } from '@/services/kopokopo.service';
import KopoPayment from '@/models/KopoPayment';
import 'dotenv/config';

const router = express.Router();

// ---------------------------------------------------------------------------
// POST /api/kopokopo/stkpush
// Body: { phone: string, amount: number, description?: string }
// ---------------------------------------------------------------------------
router.post('/stkpush', async (req: Request, res: Response) => {
  const { phone, amount, description } = req.body as {
    phone: string;
    amount: number;
    description?: string;
  };

  if (!phone || !amount) {
    res.status(400).json({ error: 'phone and amount are required' });
    return;
  }

  try {
    console.log('[Kopokopo] Initiating STK Push →', { phone, amount });

    const { location } = await initiateSTKPush({ phone, amount, description });

    // Create a pending record in the DB so we can track it
    const payment = new KopoPayment({
      location,
      status: 'pending',
      amount,
      phone,
      description: description || 'SmartPOS Payment',
    });
    await payment.save();

    console.log('[Kopokopo] STK Push queued. Location:', location);
    res.status(201).json({ location, paymentId: payment._id });
  } catch (err: any) {
    console.error('[Kopokopo] STK Push Error:', err?.response?.data || err.message);
    res.status(500).json({
      error: 'Kopokopo STK Push failed',
      details: err?.response?.data || err.message,
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/kopokopo/status
// Query: ?location=<kopokopo_location_url>
// Also accepts: GET /api/kopokopo/status/:encodedLocation
// ---------------------------------------------------------------------------
router.get('/status', async (req: Request, res: Response) => {
  const location = req.query.location as string;

  if (!location) {
    res.status(400).json({ error: 'location query param is required' });
    return;
  }

  try {
    const statusData = await getPaymentStatus(location);
    res.json(statusData);
  } catch (err: any) {
    console.error('[Kopokopo] Status Check Error:', err?.response?.data || err.message);
    res.status(500).json({
      error: 'Failed to fetch Kopokopo payment status',
      details: err?.response?.data || err.message,
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/kopokopo/payment/callback
// Kopokopo sends this when a payment result is ready (incoming payment)
// ---------------------------------------------------------------------------
router.post('/payment/callback', async (req: Request, res: Response) => {
  // Validate signature
  const signature = req.headers['x-kopokopo-signature'] as string;
  const rawBody = (req as any).rawBody as Buffer;

  if (signature && rawBody) {
    const valid = validateWebhookSignature(rawBody, signature);
    if (!valid) {
      console.warn('[Kopokopo] Invalid webhook signature!');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  }

  const payload = req.body;
  console.log('[Kopokopo] Payment Callback received:', JSON.stringify(payload, null, 2));

  try {
    const data = payload?.data ?? payload;
    const attrs = data?.attributes ?? {};
    const links = data?.links ?? data?._links ?? {};

    const status = (attrs.status ?? '').toLowerCase();
    const amount = attrs.amount?.value ?? attrs.amount ?? 0;
    const currency = attrs.amount?.currency ?? 'KES';
    const phone = attrs.sender_phone_number ?? attrs.phone_number ?? '';
    const reference = data?.id ?? attrs.id ?? '';
    const transactionReference = attrs.reference ?? attrs.mpesa_receipt_number ?? '';
    const originationTime = attrs.origination_time ?? '';
    const tillNumber = attrs.till_number ?? process.env.KOPOKOPO_TILL_NUMBER ?? '';
    const location = links.self ?? '';

    // Map Kopokopo status to our internal status
    const mappedStatus = mapStatus(status);

    // Upsert payment record — find by location or reference
    const filter = location ? { location } : reference ? { reference } : { _id: null };
    const updated = await KopoPayment.findOneAndUpdate(
      filter,
      {
        $set: {
          reference,
          location: location || undefined,
          status: mappedStatus,
          amount,
          currency,
          phone,
          tillNumber,
          transactionReference,
          originationTime,
          rawPayload: payload,
        },
      },
      { new: true, upsert: true }
    );

    // Emit Socket.IO event to all connected clients
    const io = req.app.get('io');
    if (io) {
      const eventPayload = {
        paymentId: updated?._id,
        reference,
        status: mappedStatus,
        amount,
        currency,
        phone,
        transactionReference,
        originationTime,
      };

      // Broadcast globally (clients listening on 'kopokopo_update')
      io.emit('kopokopo_update', eventPayload);

      // Also emit to a room keyed by location URL (for per-request subscriptions)
      if (location) {
        io.to(location).emit('kopokopo_update', eventPayload);
      }
    }

    res.status(200).json({ message: 'Callback processed successfully' });
  } catch (err: any) {
    console.error('[Kopokopo] Callback processing error:', err.message);
    res.status(500).json({ error: 'Callback processing failed' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/kopokopo/webhooks
// Generic webhook handler for all Kopokopo event types
// ---------------------------------------------------------------------------
router.post('/webhooks', async (req: Request, res: Response) => {
  const signature = req.headers['x-kopokopo-signature'] as string;
  const rawBody = (req as any).rawBody as Buffer;

  if (signature && rawBody) {
    const valid = validateWebhookSignature(rawBody, signature);
    if (!valid) {
      console.warn('[Kopokopo] Invalid webhook signature on /webhooks');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  }

  const payload = req.body;
  const eventType: string = payload?.topic ?? payload?.event?.type ?? 'unknown';
  console.log(`[Kopokopo] Webhook event: ${eventType}`, JSON.stringify(payload, null, 2));

  try {
    const io = req.app.get('io');
    if (io) {
      io.emit('kopokopo_webhook', { eventType, payload });
    }

    // Handle specific event types
    if (
      eventType === 'buygoods_transaction_received' ||
      eventType === 'b2b_transaction_received'
    ) {
      const data = payload?.data ?? payload;
      const attrs = data?.attributes ?? {};
      const reference = data?.id ?? '';
      const amount = attrs.amount?.value ?? attrs.amount ?? 0;
      const currency = attrs.amount?.currency ?? 'KES';
      const phone = attrs.sender_phone_number ?? '';
      const status = 'success';

      await KopoPayment.findOneAndUpdate(
        { reference: { $exists: true, $eq: reference } },
        {
          $set: {
            reference,
            status,
            amount,
            currency,
            phone,
            eventType,
            rawPayload: payload,
          },
        },
        { upsert: true, new: true }
      );
    }

    res.status(200).json({ message: 'Webhook received' });
  } catch (err: any) {
    console.error('[Kopokopo] Webhook handling error:', err.message);
    res.status(500).json({ error: 'Webhook handling failed' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/kopokopo/subscribe-webhooks
// One-time setup: register webhook subscriptions with Kopokopo
// ---------------------------------------------------------------------------
router.post('/subscribe-webhooks', async (_req: Request, res: Response) => {
  const webhookUrl = process.env.KOPOKOPO_WEBHOOK_URL;
  if (!webhookUrl) {
    res.status(400).json({ error: 'KOPOKOPO_WEBHOOK_URL is not configured' });
    return;
  }

  const eventTypes = [
    'buygoods_transaction_received',
    'buygoods_transaction_reversed',
    'settlement_transfer_completed',
    'customer_created',
  ];

  const results: Record<string, string> = {};

  for (const eventType of eventTypes) {
    try {
      const location = await subscribeWebhook(eventType, webhookUrl);
      results[eventType] = location || 'subscribed';
      console.log(`[Kopokopo] Subscribed to ${eventType}:`, location);
    } catch (err: any) {
      results[eventType] = `error: ${err?.response?.data?.message || err.message}`;
      console.error(`[Kopokopo] Failed to subscribe to ${eventType}:`, err?.response?.data || err.message);
    }
  }

  res.json({ message: 'Webhook subscription complete', results });
});

// ---------------------------------------------------------------------------
// GET /api/kopokopo/transactions
// Fetch recent Kopokopo transactions from MongoDB
// ---------------------------------------------------------------------------
router.get('/transactions', async (_req: Request, res: Response) => {
  try {
    const transactions = await KopoPayment.find()
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Kopokopo transactions' });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mapStatus = (kopoStatus: string): string => {
  switch (kopoStatus.toLowerCase()) {
    case 'received':
    case 'success':
    case 'complete':
      return 'success';
    case 'failed':
    case 'error':
      return 'failed';
    case 'reversed':
      return 'reversed';
    case 'pending':
    default:
      return 'pending';
  }
};

export default router;
