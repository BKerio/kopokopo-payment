import mongoose, { Document, Schema } from 'mongoose';

export interface IKopoPayment extends Document {
  reference: string;
  location: string;       // Kopokopo status polling URL
  status: string;         // pending | success | failed | reversed
  eventType: string;      // buygoods_transaction_received | etc.
  amount: number;
  currency: string;
  phone: string;
  description: string;
  tillNumber: string;
  transactionReference: string; // M-Pesa receipt / Kopokopo reference
  originationTime?: string;
  rawPayload: object;
  createdAt: Date;
  updatedAt: Date;
}

const KopoPaymentSchema = new Schema<IKopoPayment>(
  {
    reference: { type: String, index: true },
    location: { type: String },
    status: { type: String, default: 'pending' },
    eventType: { type: String, default: 'buygoods_transaction_received' },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'KES' },
    phone: { type: String, default: '' },
    description: { type: String, default: '' },
    tillNumber: { type: String, default: '' },
    transactionReference: { type: String, default: '' },
    originationTime: { type: String },
    rawPayload: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model<IKopoPayment>('KopoPayment', KopoPaymentSchema);
