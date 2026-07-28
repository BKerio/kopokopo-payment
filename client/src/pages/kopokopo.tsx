import { useState, useRef, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Loader2, Smartphone, DollarSign, ArrowLeft } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

const MySwal = withReactContent(Swal);

const PayWithKopokopo = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ phone?: string; amount?: string }>({});
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success'>('idle');
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL;
  const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || '').toString();
  const socketRef = useRef<Socket | null>(null);
  const hardTimeoutRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const validateInputs = (): boolean => {
    const errors: { phone?: string; amount?: string } = {};
    if (!/^(01|07)\d{8}$/.test(phone)) {
      errors.phone = 'Enter a valid 10-digit phone number (e.g. 0712345678)';
    }
    const n = Number(amount);
    if (isNaN(n) || n <= 0) {
      errors.amount = 'Enter a valid amount greater than 0';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const connectSocket = () => {
    if (socketRef.current?.connected) return socketRef.current;
    const url = SOCKET_URL || (API_URL ? API_URL.replace(/\/?api\/?$/, '') : '');
    socketRef.current = io(url, {
      transports: ['polling', 'websocket'],
    });
    return socketRef.current;
  };

  const clearTimers = () => {
    if (hardTimeoutRef.current) {
      window.clearTimeout(hardTimeoutRef.current);
      hardTimeoutRef.current = null;
    }
    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimers();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationErrors({});
    if (!validateInputs()) return;

    setLoading(true);
    setAwaitingConfirmation(false);

    try {
      const numericAmount = Number(amount);

      MySwal.fire({
        title: 'Processing Payment...',
        text: 'Please wait while we initiate the STK push.',
        icon: 'info',
        allowOutsideClick: false,
        didOpen: () => {
          const modalContent = document.querySelector('.swal2-html-container');
          if (modalContent) {
            const bubblesContainer = document.createElement('div');
            bubblesContainer.className = 'flex items-center justify-center mt-4';
            bubblesContainer.innerHTML = `
              <div class="flex items-end space-x-3">
                <span class="w-5 h-5 rounded-full bg-green-500 animate-bounce" style="animation-delay: 0ms"></span>
                <span class="w-5 h-5 rounded-full bg-blue-500 animate-bounce" style="animation-delay: 100ms"></span>
                <span class="w-5 h-5 rounded-full bg-yellow-500 animate-bounce" style="animation-delay: 200ms"></span>
                <span class="w-5 h-5 rounded-full bg-red-500 animate-bounce" style="animation-delay: 300ms"></span>
                <span class="w-5 h-5 rounded-full bg-purple-500 animate-bounce" style="animation-delay: 400ms"></span>
              </div>
            `;
            modalContent.appendChild(bubblesContainer);
          }
        },
      });

      const response = await axios.post(`${API_URL}/kopokopo/stkpush`, {
        phone,
        amount: numericAmount,
        description: description || 'SmartPOS Payment',
      });

      const { location } = response.data || {};
      Swal.close();

      if (!location) throw new Error('No location returned from Kopokopo');

      setAwaitingConfirmation(true);
      setLoading(false);

      // ── Real-time via Socket.IO ──────────────────────────────────────
      const socket = connectSocket();
      socket.off('kopokopo_update');
      socket.emit('join_kopokopo', { location });

      socket.on('kopokopo_update', (data: any) => {
        clearTimers();
        setAwaitingConfirmation(false);
        handlePaymentResult(data, numericAmount);
      });

      // ── Polling fallback (every 5s for up to 3 mins) ─────────────────
      pollIntervalRef.current = window.setInterval(async () => {
        try {
          const statusRes = await axios.get(`${API_URL}/kopokopo/status`, {
            params: { location },
          });
          const { status } = statusRes.data as { status: string };
          if (status && status !== 'pending' && status !== 'Pending') {
            clearTimers();
            socket.off('kopokopo_update');
            setAwaitingConfirmation(false);
            handlePaymentResult(statusRes.data, numericAmount);
          }
        } catch {
          // silent poll failures
        }
      }, 5000);

      // ── Hard timeout ──────────────────────────────────────────────────
      hardTimeoutRef.current = window.setTimeout(() => {
        clearTimers();
        setAwaitingConfirmation(false);
        socket.off('kopokopo_update');
        MySwal.fire({
          title: 'Payment Timeout',
          text: 'We did not receive a response in time. Please check your M-Pesa messages and try again.',
          icon: 'warning',
          confirmButtonText: 'OK',
        });
      }, 180_000);

      setPhone('');
      setAmount('');
      setDescription('');
    } catch (err: any) {
      Swal.close();
      setLoading(false);
      setAwaitingConfirmation(false);
      const details = err?.response?.data?.details || err?.message || 'Unknown error';
      const message = err?.response?.data?.error || 'Payment initiation failed.';
      MySwal.fire({
        title: 'Payment Failed',
        html: `${message}<br/><small>${details}</small>`,
        icon: 'error',
        confirmButtonText: 'Try Again',
      });
    }
  };

  const handlePaymentResult = (data: any, fallbackAmount: number) => {
    const status: string = (data?.status || '').toLowerCase();

    if (status === 'success' || status === 'received' || status === 'complete') {
      setLastReceipt({
        amount: data?.amount || fallbackAmount,
        currency: data?.currency || 'KES',
        reference: data?.transactionReference || data?.reference || 'N/A',
        phone: data?.phone || phone,
        originationTime: data?.originationTime || new Date().toISOString(),
      });
      setPaymentStatus('success');
      MySwal.fire({
        title: 'Payment Successful!',
        text: `KES ${data?.amount || fallbackAmount} received via M-Pesa.`,
        icon: 'success',
        timer: 2500,
        showConfirmButton: false,
      });
    } else if (status === 'failed' || status === 'error') {
      MySwal.fire({
        title: 'Payment Failed',
        text: 'The payment could not be completed. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK',
      });
    } else if (status === 'reversed') {
      MySwal.fire({
        title: 'Payment Reversed',
        text: 'The payment was reversed by M-Pesa.',
        icon: 'warning',
        confirmButtonText: 'OK',
      });
    } else {
      MySwal.fire({
        title: 'Payment Status Unknown',
        text: `Status: ${status || 'No response received'}`,
        icon: 'info',
        confirmButtonText: 'OK',
      });
    }
  };

  // ── Success Screen ───────────────────────────────────────────────────────
  if (paymentStatus === 'success') {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-white min-h-screen flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-[400px] bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-100 p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-400 to-transparent" />

          <div className="mb-8">
            <h1 className="text-5xl font-black text-slate-800 mb-3">Success!</h1>
            <div className="inline-block px-3 py-1 bg-slate-100 rounded-full">
              <p className="text-slate-600 font-bold tracking-wider uppercase text-[10px]">Payment Confirmed · Kopokopo</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-3xl p-8 mb-8 border border-slate-100 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm font-medium">Amount</span>
              <span className="text-2xl font-black text-slate-700">
                {lastReceipt?.currency} {lastReceipt?.amount?.toLocaleString()}
              </span>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm font-medium">Reference</span>
              <span className="font-bold text-slate-700 font-mono tracking-tight text-sm">{lastReceipt?.reference}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm font-medium">Phone</span>
              <span className="font-semibold text-slate-600">{lastReceipt?.phone}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm font-medium">Time</span>
              <span className="text-xs text-slate-500">
                {new Date(lastReceipt?.originationTime).toLocaleString('en-KE')}
              </span>
            </div>
          </div>

          <button
            onClick={() => setPaymentStatus('idle')}
            className="w-full py-4 px-4 text-base font-black text-white bg-slate-900 hover:bg-black rounded-2xl transition-all duration-300 shadow-xl active:scale-[0.98]"
          >
            Make Another Payment
          </button>
          <button
            onClick={() => navigate('/transactions/kopokopo')}
            className="mt-3 w-full py-3 text-sm font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-2xl transition-all duration-300"
          >
            View All Transactions
          </button>
        </div>
      </div>
    );
  }

  // ── Payment Form ─────────────────────────────────────────────────────────
  return (
    <div className="bg-gradient-to-br from-slate-50 to-white min-h-screen flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[400px] bg-white rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.08)] border border-slate-100 p-10 relative overflow-hidden">

        <button
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 text-slate-500 hover:text-slate-800 transition-colors z-10"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <div className="text-center mb-10 mt-4">
          <h1 className="text-4xl font-black text-slate-800 mb-3 hover:scale-105 transition-transform cursor-default">
            Pay with Kopokopo
          </h1>
          <p className="text-slate-400 font-medium text-sm px-4">Fast &amp; secure payment via STK Push</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-8">
          {/* Phone */}
          <div className="space-y-2">
            <label htmlFor="kopo-phone" className="block text-xs font-bold text-slate-400 normal-case tracking-widest pl-1">
              Phone Number
            </label>
            <div className="relative group">
              <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-slate-500 transition-colors" />
              <input
                id="kopo-phone"
                type="tel"
                placeholder="0712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading || awaitingConfirmation}
                className={`w-full pl-12 pr-4 py-4 rounded-2xl border bg-slate-50/50 shadow-inner transition-all duration-300 focus:bg-white focus:ring-4 focus:outline-none ${
                  validationErrors.phone
                    ? 'border-red-400 focus:ring-red-100'
                    : 'border-slate-100 focus:ring-slate-100'
                }`}
              />
            </div>
            {validationErrors.phone && (
              <p className="mt-2 text-[10px] font-bold text-red-500 pl-1">{validationErrors.phone}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label htmlFor="kopo-amount" className="block text-xs font-bold text-slate-400 normal-case tracking-widest pl-1">
              Amount (KES)
            </label>
            <div className="relative group">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-slate-500 transition-colors" />
              <input
                id="kopo-amount"
                type="number"
                placeholder="0.00"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading || awaitingConfirmation}
                className={`w-full pl-12 pr-4 py-4 rounded-2xl border bg-slate-50/50 shadow-inner transition-all duration-300 focus:bg-white focus:ring-4 focus:outline-none ${
                  validationErrors.amount
                    ? 'border-red-400 focus:ring-red-100'
                    : 'border-slate-100 focus:ring-slate-100'
                }`}
              />
            </div>
            {validationErrors.amount && (
              <p className="mt-2 text-[10px] font-bold text-red-500 pl-1">{validationErrors.amount}</p>
            )}
          </div>

          {/* Description (optional) */}
          <div className="space-y-2">
            <label htmlFor="kopo-desc" className="block text-xs font-bold text-slate-400 normal-case tracking-widest pl-1">
              Description <span className="text-slate-300 font-normal">(optional)</span>
            </label>
            <input
              id="kopo-desc"
              type="text"
              placeholder="e.g. Order #1234"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading || awaitingConfirmation}
              className="w-full px-4 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 shadow-inner transition-all duration-300 focus:bg-white focus:ring-4 focus:ring-slate-100 focus:outline-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button
              id="kopo-pay-btn"
              type="submit"
              disabled={loading || awaitingConfirmation}
              className="w-full flex items-center justify-center py-5 px-4 text-base font-black text-white bg-gray-600 hover:bg-gray-700 rounded-[1.25rem] transition-all duration-300 shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {loading || awaitingConfirmation ? (
                <>
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  {loading ? 'Processing...' : 'Awaiting Confirmation…'}
                </>
              ) : (
                <>Pay KES {Number(amount) || 0}</>
              )}
            </button>
          </div>
        </form>

        {/* Awaiting prompt animation */}
        {awaitingConfirmation && (
          <div className="mt-8 flex items-center justify-center">
            <div className="flex items-end space-x-3" aria-label="Payment prompt sent, awaiting your confirmation">
              <span className="w-5 h-5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-5 h-5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '100ms' }} />
              <span className="w-5 h-5 rounded-full bg-slate-600 animate-bounce" style={{ animationDelay: '200ms' }} />
              <span className="w-5 h-5 rounded-full bg-slate-700 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="w-5 h-5 rounded-full bg-slate-800 animate-bounce" style={{ animationDelay: '400ms' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayWithKopokopo;
