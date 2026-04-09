import React, { useState } from 'react';
import { Button, Input, Modal } from '../ui';

export default function WithdrawalModal({ isOpen, onClose, onSubmit, loading = false, maxAmount = 0 }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = Number(amount);

    if (!value || value <= 0) {
      setError('Enter a valid amount greater than 0.');
      return;
    }
    if (value > maxAmount) {
      setError('Amount exceeds your current balance.');
      return;
    }
    if (!Number.isInteger(value)) {
      setError('Please enter a whole rupee amount.');
      return;
    }

    setError('');
    await onSubmit(value);
    setAmount('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Withdrawal"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button form="withdrawal-form" type="submit" loading={loading}>
            Submit Request
          </Button>
        </>
      }
    >
      <form id="withdrawal-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="text-sm text-slate-600">
          Available balance: <span className="font-semibold">Rs. {maxAmount}</span>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Amount (Rs.)</label>
          <Input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter withdrawal amount"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
