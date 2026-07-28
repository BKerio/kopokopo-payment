import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, RefreshCw, Download, CheckCircle2, XCircle, Clock, RotateCcw } from 'lucide-react';

interface KopoTransaction {
  _id: string;
  reference: string;
  transactionReference: string;
  status: string;
  amount: number;
  currency: string;
  phone: string;
  description: string;
  tillNumber: string;
  originationTime?: string;
  createdAt: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  success: {
    label: 'Success',
    color: 'bg-slate-100 text-slate-700 border border-slate-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  pending: {
    label: 'Pending',
    color: 'bg-amber-50 text-amber-600 border border-amber-200',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-50 text-red-500 border border-red-200',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  reversed: {
    label: 'Reversed',
    color: 'bg-slate-50 text-slate-400 border border-slate-200',
    icon: <RotateCcw className="w-3.5 h-3.5" />,
  },
};

const KopokopoTransactions = () => {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;

  const [transactions, setTransactions] = useState<KopoTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get<KopoTransaction[]>(`${API_URL}/kopokopo/transactions`);
        setTransactions(res.data);
      } catch (err: any) {
        setError(err?.response?.data?.error || err.message || 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [API_URL, refreshKey]);

  const totalSuccess = transactions
    .filter((t) => t.status === 'success')
    .reduce((s, t) => s + (t.amount || 0), 0);

  const exportCSV = () => {
    const headers = ['Date', 'Reference', 'M-Pesa Ref', 'Phone', 'Amount (KES)', 'Status', 'Description'];
    const rows = transactions.map((t) => [
      new Date(t.createdAt).toLocaleString('en-KE'),
      t.reference || '-',
      t.transactionReference || '-',
      t.phone || '-',
      t.amount,
      t.status,
      t.description || '-',
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kopokopo-transactions-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white font-sans">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-slate-500 hover:text-slate-800 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-800">Kopokopo Transactions</h1>
              <p className="text-slate-400 text-sm">M-Pesa payments via Kopokopo</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="kopo-refresh-btn"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-all text-sm font-medium shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {transactions.length > 0 && (
              <button
                id="kopo-export-btn"
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-black rounded-xl text-white transition-all text-sm font-medium shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        {!loading && transactions.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Transactions', value: transactions.length },
              { label: 'Successful', value: transactions.filter((t) => t.status === 'success').length },
              { label: 'Total Collected', value: `KES ${totalSuccess.toLocaleString()}` },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white border border-slate-100 rounded-2xl p-4 text-center shadow-sm"
              >
                <p className="text-2xl font-black text-slate-700">{stat.value}</p>
                <p className="text-slate-400 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-14 h-14 border-4 border-slate-100 border-t-slate-400 rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading transactions…</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-500 font-semibold">{error}</p>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="mt-4 px-6 py-2 bg-white border border-red-200 rounded-xl text-red-500 hover:bg-red-50 transition-all text-sm"
            >
              Retry
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-16 text-center shadow-sm">
            <p className="text-slate-400 text-lg font-semibold">No transactions yet</p>
            <p className="text-slate-300 text-sm mt-1">Make your first payment via Kopokopo</p>
            <button
              onClick={() => navigate('/pay/kopokopo')}
              className="mt-6 px-6 py-3 bg-slate-800 hover:bg-black rounded-xl text-white transition-all text-sm font-semibold"
            >
              Make a Payment
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Date', 'Phone', 'Amount', 'M-Pesa Ref', 'Status', 'Description'].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn, i) => {
                    const s = statusConfig[txn.status] ?? statusConfig['pending'];
                    return (
                      <tr
                        key={txn._id}
                        className={`border-b border-slate-50 transition-colors hover:bg-slate-50 ${
                          i % 2 === 0 ? '' : 'bg-slate-50/40'
                        }`}
                      >
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap text-xs">
                          {new Date(txn.createdAt).toLocaleString('en-KE')}
                        </td>
                        <td className="px-5 py-4 text-slate-700 font-mono text-xs">
                          {txn.phone || '—'}
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-800 whitespace-nowrap">
                          {txn.currency || 'KES'} {(txn.amount || 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-slate-500 font-mono text-xs">
                          {txn.transactionReference || txn.reference || '—'}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${s.color}`}
                          >
                            {s.icon}
                            {s.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-400 max-w-[160px] truncate text-xs">
                          {txn.description || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 bg-slate-50">
              Showing {transactions.length} most recent transactions
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KopokopoTransactions;
