import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button } from '../../components/ui';
import WithdrawalModal from '../../components/modals/WithdrawalModal';
import paymentsApi from '../../features/payments/api';
import { toast } from 'react-hot-toast';

function withdrawalBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'success') return 'bg-emerald-100 text-emerald-700';
  if (s === 'failed') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
}

function normalizedWithdrawalStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'pending' ? 'requested' : s;
}

function withdrawalStatusLabel(status) {
  const s = normalizedWithdrawalStatus(status);
  if (s === 'requested') return 'Pending';
  if (s === 'success') return 'Success';
  if (s === 'failed') return 'Failed';
  return 'Unknown';
}

function toErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  return err?.message || fallback;
}

export default function Wallet() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [wallet, setWallet] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalTotal, setWithdrawalTotal] = useState(0);
  const [withdrawalPage, setWithdrawalPage] = useState(0);
  const [withdrawalLimit, setWithdrawalLimit] = useState(10);
  const [withdrawalStatus, setWithdrawalStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  const loadData = async (page = withdrawalPage, limit = withdrawalLimit) => {
    setLoading(true);
    try {
      const [walletRes, monthlyRes, withdrawalsRes] = await Promise.allSettled([
        paymentsApi.getTeacherWallet(),
        paymentsApi.getTeacherMonthlyEarnings(year, month),
        paymentsApi.listWithdrawals({ skip: page * limit, limit }),
      ]);

      if (walletRes.status === 'fulfilled') {
        setWallet(walletRes.value);
      }

      if (monthlyRes.status === 'fulfilled') {
        setMonthly(monthlyRes.value);
      }

      if (withdrawalsRes.status === 'fulfilled') {
        setWithdrawals(withdrawalsRes.value.items || []);
        setWithdrawalTotal(withdrawalsRes.value.total || 0);
      }

      if (walletRes.status === 'rejected' && monthlyRes.status === 'rejected' && withdrawalsRes.status === 'rejected') {
        throw walletRes.reason || monthlyRes.reason || withdrawalsRes.reason;
      }
    } catch (err) {
      toast.error(toErrorMessage(err, 'Failed to load wallet data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(withdrawalPage, withdrawalLimit);
  }, [year, month, withdrawalPage, withdrawalLimit]);

  const handleWithdraw = async (amount) => {
    setWithdrawLoading(true);
    try {
      await paymentsApi.requestWithdrawal(amount);
      toast.success('Withdrawal requested successfully');
      setOpenModal(false);
      setWithdrawalPage(0);
      await loadData(0, withdrawalLimit);
    } catch (err) {
      toast.error(toErrorMessage(err, 'Withdrawal request failed'));
    } finally {
      setWithdrawLoading(false);
    }
  };

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i + 1),
    []
  );

  const filteredWithdrawals = useMemo(() => {
    const status = normalizedWithdrawalStatus(withdrawalStatus);
    return withdrawals.filter((w) => {
      if (status === 'all') return true;
      return normalizedWithdrawalStatus(w.status) === status;
    });
  }, [withdrawals, withdrawalStatus]);

  const withdrawalPages = Math.max(1, Math.ceil(withdrawalTotal / withdrawalLimit));

  if (loading) {
    return <div className="py-8 text-lg text-slate-700 font-medium">Loading wallet...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Wallet & Payouts</h1>
          <p className="text-lg text-slate-700 mt-2">Track earnings, monthly performance, and withdrawal history.</p>
          <p className="text-sm text-slate-500 mt-1">Withdrawal requests are created as Pending and processed later.</p>
        </div>
        <Button onClick={() => setOpenModal(true)}>Request Withdrawal</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-slate-200 shadow-sm">
          <div className="text-base text-slate-700 font-medium">Current Balance</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">Rs. {wallet?.current_balance || 0}</div>
        </Card>
        <Card className="border border-slate-200 shadow-sm">
          <div className="text-base text-slate-700 font-medium">Total Earned</div>
          <div className="text-3xl font-bold text-emerald-700 mt-1">Rs. {wallet?.total_earned || 0}</div>
        </Card>
        <Card className="border border-slate-200 shadow-sm">
          <div className="text-base text-slate-700 font-medium">Total Withdrawn</div>
          <div className="text-3xl font-bold text-blue-700 mt-1">Rs. {wallet?.total_withdraw || 0}</div>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Monthly Earnings</h2>
            <p className="text-base text-slate-600">Captured payments only</p>
          </div>
          <div className="flex gap-2">
            <select
              className="border border-slate-300 rounded-lg px-3 py-2.5 text-base text-slate-900 bg-white"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              type="number"
              className="border border-slate-300 rounded-lg px-3 py-2.5 w-28 text-base text-slate-900 bg-white"
              value={year}
              onChange={(e) => {
                const y = Number(e.target.value);
                if (Number.isFinite(y) && y >= 2020 && y <= 2100) {
                  setYear(y);
                }
              }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-base text-slate-700 font-medium">Sessions Completed</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{monthly?.sessions_completed || 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-base text-slate-700 font-medium">Amount Earned</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">Rs. {monthly?.amount_earned || 0}</div>
          </div>
        </div>
      </Card>

      <Card className="border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Withdrawal History</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <select
            className="border border-slate-300 rounded-lg px-3 py-2.5 text-base text-slate-900 bg-white"
            value={withdrawalStatus}
            onChange={(e) => setWithdrawalStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="requested">Pending</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <select
            className="border border-slate-300 rounded-lg px-3 py-2.5 text-base text-slate-900 bg-white"
            value={withdrawalLimit}
            onChange={(e) => {
              setWithdrawalPage(0);
              setWithdrawalLimit(Number(e.target.value));
            }}
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>

        {filteredWithdrawals.length === 0 ? (
          <div className="py-6 text-base text-slate-700">No withdrawals yet.</div>
        ) : (
          <div className="space-y-3">
            {filteredWithdrawals.map((w) => (
              <div key={w.id} className="rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Rs. {w.amount}</div>
                  <div className="text-base text-slate-600">Requested: {new Date(w.request_at).toLocaleString()}</div>
                </div>
                <span className={`px-2 py-1 rounded-md text-xs font-semibold uppercase ${withdrawalBadge(w.status)}`}>
                  {withdrawalStatusLabel(w.status)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-base text-slate-700 font-medium">
            Showing page {withdrawalPage + 1} of {withdrawalPages} ({withdrawalTotal} total records)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={withdrawalPage === 0 || loading}
              onClick={() => setWithdrawalPage((prev) => Math.max(0, prev - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={withdrawalPage + 1 >= withdrawalPages || loading}
              onClick={() => setWithdrawalPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <WithdrawalModal
        isOpen={openModal}
        onClose={() => setOpenModal(false)}
        onSubmit={handleWithdraw}
        loading={withdrawLoading}
        maxAmount={wallet?.current_balance || 0}
      />
    </div>
  );
}
