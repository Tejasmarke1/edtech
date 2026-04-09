import apiClient from '../../api/client';

const paymentsApi = {
  listTransactions: async ({ skip = 0, limit = 20 } = {}) => {
    const { data } = await apiClient.get('/payments/transactions', {
      params: { skip, limit },
    });
    return data;
  },

  createOrder: async (sessionId) => {
    const { data } = await apiClient.post('/payments/orders', {
      session_id: sessionId,
    });
    return data;
  },

  getTransaction: async (transactionId) => {
    const { data } = await apiClient.get(`/payments/transactions/${transactionId}`);
    return data;
  },

  getTeacherWallet: async () => {
    const { data } = await apiClient.get('/teachers/earnings');
    return data;
  },

  getTeacherMonthlyEarnings: async (year, month) => {
    const { data } = await apiClient.get('/teachers/earnings/monthly', {
      params: { year, month },
    });
    return data;
  },

  requestWithdrawal: async (amount) => {
    const { data } = await apiClient.post('/teachers/withdrawals', { amount });
    return data;
  },

  listWithdrawals: async ({ skip = 0, limit = 20 } = {}) => {
    const { data } = await apiClient.get('/teachers/withdrawals', {
      params: { skip, limit },
    });
    return data;
  },
};

export default paymentsApi;
