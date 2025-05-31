import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useElements,
  useStripe
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#ffffff',
      '::placeholder': {
        color: '#9CA3AF',
      },
      backgroundColor: '#1F2937',
    },
    invalid: {
      color: '#EF4444',
    },
  },
  hidePostalCode: true,
};

function AddFundsForm({ onSuccess, onCancel, api }) {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState(20);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Create payment intent
      const { data: paymentIntentData } = await api.post('/api/payment/add-funds', {
        amount: amount
      });

      const { client_secret } = paymentIntentData;

      // Confirm payment
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        client_secret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
          }
        }
      );

      if (stripeError) {
        setError(stripeError.message);
      } else if (paymentIntent.status === 'succeeded') {
        // Confirm payment on backend
        const { data: confirmData } = await api.post('/api/payment/confirm', 
          { payment_intent_id: paymentIntent.id }
        );
        
        onSuccess(confirmData);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30">
      <h3 className="text-xl font-alex-brush text-pink-400 mb-4">Add Funds</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount Selection */}
        <div>
          <label className="block text-white font-playfair mb-2">Amount</label>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[10, 20, 50, 100].map((presetAmount) => (
              <button
                key={presetAmount}
                type="button"
                onClick={() => setAmount(presetAmount)}
                className={`p-2 rounded-lg font-playfair transition-colors ${
                  amount === presetAmount
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ${presetAmount}
              </button>
            ))}
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-white font-playfair">$</span>
            <input
              type="number"
              min="5"
              max="500"
              step="5"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Card Element */}
        <div>
          <label className="block text-white font-playfair mb-2">Card Details</label>
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-600 focus-within:border-pink-500">
            <CardElement options={cardElementOptions} />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-600/20 border border-red-500 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={!stripe || processing || amount < 5}
            className="flex-1 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-playfair transition-colors"
          >
            {processing ? 'Processing...' : `Add $${amount}`}
          </button>
          
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-playfair transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export function AddFundsModal({ isOpen, onClose, onSuccess, api }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Elements stripe={stripePromise}>
          <AddFundsForm 
            onSuccess={(data) => {
              onSuccess(data);
              onClose();
            }}
            onCancel={onClose}
            api={api}
          />
        </Elements>
      </div>
    </div>
  );
}

export function QuickAddFundsButton({ currentBalance, onBalanceUpdate, api }) {
  const [showModal, setShowModal] = useState(false);

  const handleSuccess = (data) => {
    onBalanceUpdate(data.new_balance);
  };

  return (
    <>
      <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30">
        <h3 className="text-xl font-playfair text-white mb-4">Account Balance</h3>
        <div className="flex justify-between items-center">
          <span className="text-3xl font-alex-brush text-pink-400">
            ${currentBalance?.toFixed(2) || '0.00'}
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-playfair transition-colors"
          >
            Add Funds
          </button>
        </div>
        
        {currentBalance < 10 && (
          <div className="mt-4 p-3 bg-yellow-600/20 border border-yellow-500 rounded-lg">
            <p className="text-yellow-400 text-sm">
              Low balance! Add funds to continue using reading services.
            </p>
          </div>
        )}
      </div>

      <AddFundsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        api={api}
      />
    </>
  );
}

export function PaymentSummary({ session, onClose }) {
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const totalMinutes = session.total_minutes || 0;
  const totalAmount = session.total_amount || 0;
  const readerShare = totalAmount * 0.7;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 border border-pink-500/30 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-2xl font-alex-brush text-pink-400 mb-2">Session Complete</h3>
          <p className="text-gray-300 font-playfair">Thank you for using SoulSeer</p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-300">Duration:</span>
            <span className="text-white font-playfair">{formatTime(Math.floor(totalMinutes * 60))}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-300">Rate:</span>
            <span className="text-white font-playfair">${session.rate_per_minute}/min</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-300">Minutes:</span>
            <span className="text-white font-playfair">{totalMinutes.toFixed(2)}</span>
          </div>
          
          <div className="border-t border-gray-600 pt-4">
            <div className="flex justify-between text-lg">
              <span className="text-pink-400 font-playfair">Total:</span>
              <span className="text-pink-400 font-playfair">${totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-pink-600 hover:bg-pink-700 text-white py-3 px-6 rounded-lg font-playfair transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default { AddFundsModal, QuickAddFundsButton, PaymentSummary };
