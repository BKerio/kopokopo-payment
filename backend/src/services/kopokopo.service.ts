import axios from 'axios';
import crypto from 'crypto';
import 'dotenv/config';

const {
  KOPOKOPO_CLIENT_ID,
  KOPOKOPO_CLIENT_SECRET,
  KOPOKOPO_API_KEY,
  KOPOKOPO_BASE_URL,
  KOPOKOPO_TILL_NUMBER,
  KOPOKOPO_CALLBACK_URL,
} = process.env;

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------
interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let tokenCache: TokenCache | null = null;

export const getAccessToken = async (): Promise<string> => {
  const now = Date.now();

  // Return cached token if still valid (with 60s buffer)
  if (tokenCache && tokenCache.expiresAt - 60_000 > now) {
    return tokenCache.accessToken;
  }

  const params = new URLSearchParams({
    client_id: KOPOKOPO_CLIENT_ID!,
    client_secret: KOPOKOPO_CLIENT_SECRET!,
    grant_type: 'client_credentials',
  });

  const response = await axios.post(
    `${KOPOKOPO_BASE_URL}/oauth/token`,
    params.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SmartPOS/1.0',
      },
    }
  );

  const { access_token, expires_in } = response.data as {
    access_token: string;
    expires_in: number;
  };

  tokenCache = {
    accessToken: access_token,
    expiresAt: now + expires_in * 1000,
  };

  console.log('[Kopokopo] Access token refreshed, expires in', expires_in, 's');
  return access_token;
};

// ---------------------------------------------------------------------------
// STK Push — Receive M-PESA via Kopokopo
// ---------------------------------------------------------------------------
export interface StkPushOptions {
  phone: string;    // E.164 e.g. +254712345678
  amount: number;
  description?: string;
  callbackUrl?: string;
}

export interface StkPushResult {
  location: string; // URL to poll for status
}

export const initiateSTKPush = async (opts: StkPushOptions): Promise<StkPushResult> => {
  const accessToken = await getAccessToken();

  const phone = formatKopoPhone(opts.phone);

  const payload = {
    payment_channel: 'M-PESA STK Push',
    till_number: KOPOKOPO_TILL_NUMBER,
    subscriber: {
      phone_number: phone,
    },
    amount: {
      currency: 'KES',
      value: opts.amount,
    },
    metadata: {
      description: opts.description || 'SmartPOS Payment',
    },
    _links: {
      callback_url: opts.callbackUrl || KOPOKOPO_CALLBACK_URL,
    },
  };

  const response = await axios.post(
    `${KOPOKOPO_BASE_URL}/api/v1/incoming_payments`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SmartPOS/1.0',
      },
    }
  );

  // Kopokopo returns 201 with a Location header
  const location: string =
    response.headers['location'] ||
    response.data?._links?.self ||
    '';

  if (!location) {
    throw new Error('Kopokopo did not return a payment location URL');
  }

  return { location };
};

// ---------------------------------------------------------------------------
// Query incoming payment status
// ---------------------------------------------------------------------------
export interface PaymentStatus {
  status: string;       // 'Pending' | 'Received' | 'Failed' | etc.
  amount?: number;
  currency?: string;
  reference?: string;
  originationTime?: string;
  raw?: object;
}

export const getPaymentStatus = async (location: string): Promise<PaymentStatus> => {
  const accessToken = await getAccessToken();

  const response = await axios.get(location, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'SmartPOS/1.0',
    },
  });

  const data = response.data as any;
  const attrs = data?.data?.attributes ?? data?.attributes ?? data ?? {};

  return {
    status: attrs.status ?? 'Unknown',
    amount: attrs.amount?.value ?? attrs.amount,
    currency: attrs.amount?.currency ?? 'KES',
    reference: attrs.reference ?? attrs.id,
    originationTime: attrs.origination_time,
    raw: data,
  };
};

// ---------------------------------------------------------------------------
// Webhook subscription
// ---------------------------------------------------------------------------
export const subscribeWebhook = async (
  eventType: string,
  url: string
): Promise<string> => {
  const accessToken = await getAccessToken();

  const payload = {
    event_type: eventType,
    url,
    scope: 'Till',
    scope_reference: KOPOKOPO_TILL_NUMBER,
  };

  const response = await axios.post(
    `${KOPOKOPO_BASE_URL}/api/v1/webhook_subscriptions`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SmartPOS/1.0',
      },
    }
  );

  const location: string =
    response.headers['location'] ||
    response.data?._links?.self ||
    '';

  return location;
};

// ---------------------------------------------------------------------------
// Webhook signature validation
// Uses HMAC-SHA256 with API_KEY as secret over the raw request body
// ---------------------------------------------------------------------------
export const validateWebhookSignature = (
  rawBody: string | Buffer,
  signature: string
): boolean => {
  if (!KOPOKOPO_API_KEY) return false;
  const expected = crypto
    .createHmac('sha256', KOPOKOPO_API_KEY)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatKopoPhone = (phone: string): string => {
  // Ensure E.164 format: +254XXXXXXXXX
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('254')) return '+' + phone;
  if (phone.startsWith('0')) return '+254' + phone.substring(1);
  return '+254' + phone;
};
