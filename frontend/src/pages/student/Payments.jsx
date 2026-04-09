  import React, { useEffect, useMemo, useState } from 'react';
  import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Input } from '../../components/ui';
import apiClient from '../../api/client';
import paymentsApi from '../../features/payments/api';
import { toast } from 'react-hot-toast';
import { usePaymentStore } from '../../stores/paymentStore';
  import { useAuthStore } from '../../stores/authStore';

function statusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'captured') return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
  if (s === 'failed') return 'border border-red-200 bg-red-50 text-red-700';
  if (s === 'authorized') return 'border border-blue-200 bg-blue-50 text-blue-700';
  return 'border border-amber-200 bg-amber-50 text-amber-700';
}

export default function Payments() {
  const openPaymentModal = usePaymentStore((state) => state.openPaymentModal);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSessionId = searchParams.get('session_id') || '';

  const [sessionId, setSessionId] = useState(initialSessionId);
  const [payableSessions, setPayableSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pageError, setPageError] = useState('');

  const normalizeStatus = (value) => String(value || '').toLowerCase();

  const formatSessionDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const loadPayableSessions = async (txSource = transactions) => {
    setIsLoadingSessions(true);
    try {
      const { data } = await apiClient.get('/sessions/my?skip=0&limit=200');
      const items = data.items || (Array.isArray(data) ? data : []);

      const normalizedTx = txSource.map((tx) => ({
        session_id: String(tx.session_id || ''),
        status: normalizeStatus(tx.status),
      }));

      const payable = items.filter((s) => {
        const isCompleted = normalizeStatus(s.status) === 'completed';
        if (!isCompleted) return false;

        const txForSession = normalizedTx.find((tx) => tx.session_id === String(s.id));
        const alreadyPaid = Boolean(
          s.is_paid ||
          normalizeStatus(s.payment_status) === 'captured' ||
          txForSession?.status === 'captured'
        );
        return !alreadyPaid;
      });

      setPayableSessions(payable);

      // Keep selected session valid when refreshed data changes.
      if (sessionId && !payable.some((s) => String(s.id) === String(sessionId))) {
        setSessionId(initialSessionId && payable.some((s) => String(s.id) === String(initialSessionId)) ? initialSessionId : '');
      }

      // Keep user-provided query param priority; else preselect first payable session.
      if (!initialSessionId && !sessionId && payable.length > 0) {
        setSessionId(payable[0].id);
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      setPayableSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadTransactions = async (currentPage = page, currentLimit = pageSize) => {
    setLoading(true);
    setPageError('');
    try {
      const res = await paymentsApi.listTransactions({
        skip: currentPage * currentLimit,
        limit: currentLimit,
      });
      const txItems = res.items || [];
      setTransactions(txItems);
      setTotalTransactions(res.total || 0);
      await loadPayableSessions(txItems);
    } catch (err) {
      if (err?.response?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      const message = err?.response?.data?.detail || 'Failed to load payment data. Please log in again.';
      setPageError(typeof message === 'string' ? message : 'Failed to load payment data.');
      toast.error(message);
      setPayableSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions(page, pageSize);
  }, [page, pageSize]);

  const filteredTransactions = useMemo(() => {
    const status = statusFilter.toLowerCase();
    const query = searchQuery.trim().toLowerCase();

    return transactions.filter((tx) => {
      const matchesStatus =
        status === 'all' || String(tx.status || '').toLowerCase() === status;
      const matchesQuery =
        !query ||
        String(tx.transaction_id || '').toLowerCase().includes(query) ||
        String(tx.session_id || '').toLowerCase().includes(query) ||
        String(tx.gateway_order_id || '').toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [transactions, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(totalTransactions / pageSize));
  const capturedCount = transactions.filter((tx) => String(tx.status || '').toLowerCase() === 'captured').length;
  const pendingCount = transactions.filter((tx) => ['created', 'authorized'].includes(String(tx.status || '').toLowerCase())).length;
  const totalPaid = transactions
    .filter((tx) => String(tx.status || '').toLowerCase() === 'captured')
    .reduce((sum, tx) => sum + Number(tx.total_payable || 0), 0);

  const handleCreateOrder = async () => {
    if (!sessionId.trim()) {
      toast.error('Session ID is required');
      return;
    }

    const isValidPayableSelection = payableSessions.some((s) => String(s.id) === String(sessionId).trim());
    if (!isValidPayableSelection) {
      toast.error('Please select a valid unpaid completed session.');
      return;
    }

    setCreating(true);
    try {
      const safeSessionId = sessionId.trim();
      openPaymentModal(
        safeSessionId,
        async () => {
          toast.success('Payment successful');
          setPage(0);
          await loadTransactions(0, pageSize);
        },
        (err) => {
          toast.error(err?.message || 'Payment failed');
        }
      );
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to create order');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/50 p-6 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Payments</h1>
        <p className="mt-2 text-slate-600">Pay for completed sessions and track every transaction in one place.</p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Captured</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{capturedCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{pendingCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Paid</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">Rs. {totalPaid}</p>
          </div>
        </div>
      </div>

      <Card className="border border-slate-200">
        {pageError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {pageError}
          </div>
        )}
        <label className="mb-2 block text-sm font-medium">Choose Completed Session</label>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="w-full md:flex-1">
            <select
              className="h-11 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-slate-700 transition hover:border-slate-300 focus:border-primary-500 focus:outline-none"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              disabled={isLoadingSessions || payableSessions.length === 0}
            >
              {payableSessions.length === 0 ? (
                <option value="">No completed unpaid sessions found</option>
              ) : (
                <>
                  <option value="">Select a session</option>
                  {payableSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                        {`${s.subject_name || s.subject_master_id || 'Session'} • ${formatSessionDate(s.session_date)} • ${s.id.slice(0, 8)}`}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
          <Button
            onClick={handleCreateOrder}
            loading={creating}
            disabled={!sessionId || isLoadingSessions || payableSessions.length === 0}
            className="h-11 w-full md:w-[280px]"
          >
            Pay with Razorpay
          </Button>
        </div>

        <p className="mt-2 text-sm text-slate-500">
          {isLoadingSessions
            ? 'Loading your completed sessions...'
            : 'Select a completed session to open secure Razorpay checkout.'}
        </p>

        {payableSessions.length > 0 && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Tip: You have {payableSessions.length} completed session{payableSessions.length > 1 ? 's' : ''} pending payment.
          </div>
        )}
      </Card>

      <Card className="border border-slate-200">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Transaction History</h2>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {totalTransactions} total
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Input
            placeholder="Search transaction/session/order ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="h-11 rounded-lg border-2 border-slate-200 px-3 py-2 text-slate-700 transition hover:border-slate-300 focus:border-primary-500 focus:outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="created">Created</option>
            <option value="authorized">Authorized</option>
            <option value="captured">Captured</option>
            <option value="failed">Failed</option>
          </select>
          <select
            className="h-11 rounded-lg border-2 border-slate-200 px-3 py-2 text-slate-700 transition hover:border-slate-300 focus:border-primary-500 focus:outline-none"
            value={pageSize}
            onChange={(e) => {
              setPage(0);
              setPageSize(Number(e.target.value));
            }}
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>

        {loading ? (
          <div className="py-8 text-slate-500">Loading transactions...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-slate-500">
            No transactions found for the selected filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((tx) => (
              <div key={tx.transaction_id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">Transaction: {tx.transaction_id}</div>
                    <div className="mt-2 flex flex-col gap-1 text-sm text-slate-600">
                      <div>Session: {tx.session_id}</div>
                      <div>Gateway Order: {tx.gateway_order_id || '-'}</div>
                    </div>
                  </div>
                  <div className="text-right md:min-w-[120px]">
                    <div className="text-lg font-bold text-slate-900">Rs. {tx.total_payable}</div>
                    <span className={`inline-block mt-1 px-2 py-1 rounded-md text-xs font-semibold uppercase ${statusClass(tx.status)}`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-slate-500">
            Showing page {page + 1} of {totalPages} ({totalTransactions} total records)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page === 0 || loading}
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
