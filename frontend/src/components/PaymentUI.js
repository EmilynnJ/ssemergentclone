import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createAuthenticatedAxios } from '../App'; // Adjust if createAuthenticatedAxios is elsewhere
import { useAuth } from '../context/AuthContext'; // To get user info for billing details

const AddFundsForm = ({ onPaymentSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const auth = useAuth();

  const [amount, setAmount] = useState('20.00');
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
      setAmount(value);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setProcessing(true);
    setError(null);
    setSucceeded(false);

    if (!stripe || !elements) {
      setError("Stripe.js has not loaded yet.");
      setProcessing(false);
      return;
    }

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      setError("Card element not found.");
      setProcessing(false);
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError("Please enter a valid amount.");
        setProcessing(false);
        return;
    }

    try {
      const authenticatedAxios = createAuthenticatedAxios();
      const { data: paymentIntentResponse } = await authenticatedAxios.post('/api/payment/add-funds', {
        amount: parsedAmount,
      });

      const clientSecret = paymentIntentResponse.client_secret;

      const paymentResult = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: auth.userId, // Using userId as a placeholder for name, ideally get from userProfile
            email: auth.currentUser?.email, // Assuming email is available in currentUser from useAuth
          },
        },
      });

      if (paymentResult.error) {
        setError(`Payment failed: ${paymentResult.error.message}`);
        setProcessing(false);
      } else {
        if (paymentResult.paymentIntent.status === 'succeeded') {
          setSucceeded(true);
          setProcessing(false);
          await authenticatedAxios.post('/api/payment/confirm', {
            payment_intent_id: paymentResult.paymentIntent.id,
          });
          if (onPaymentSuccess) {
            onPaymentSuccess(parsedAmount);
          }
        } else {
          setError(`Payment status: ${paymentResult.paymentIntent.status}`);
          setProcessing(false);
        }
      }
    } catch (err) {
      console.error("Payment processing error:", err);
      setError(err.response?.data?.detail || "An unexpected error occurred during payment.");
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        color: "#fff",
        fontFamily: '"Playfair Display", serif',
        fontSmoothing: "antialiased",
        fontSize: "16px",
        "::placeholder": {
          color: "#aab7c4"
        },
        iconColor: '#FF69B4',
      },
      invalid: {
        color: "#fa755a",
        iconColor: "#fa755a"
      }
    },
    hidePostalCode: true,
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-gray-800/70 backdrop-blur-sm rounded-lg shadow-xl border border-pink-500/30">
      <h3 className="text-2xl font-alex-brush text-pink-400 mb-4">Add Funds to Wallet</h3>

      <div className="mb-4">
        <label htmlFor="amount" className="block text-sm font-medium text-gray-300 font-playfair mb-1">
          Amount (USD)
        </label>
        <input
          type="text"
          id="amount"
          value={amount}
          onChange={handleAmountChange}
          className="w-full px-3 py-2 bg-gray-900/80 text-white border border-gray-700 rounded-md focus:outline-none focus:ring-pink-500 focus:border-pink-500"
          placeholder="e.g., 20.00"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 font-playfair mb-1">
          Card Details
        </label>
        <div className="p-3 bg-gray-900/80 border border-gray-700 rounded-md">
            <CardElement options={cardElementOptions} />
        </div>
      </div>

      {error && (
        <div className="text-red-400 bg-red-900/30 p-3 rounded-md text-center mb-4 font-playfair">{error}</div>
      )}
      {succeeded && (
        <div className="text-green-400 bg-green-900/30 p-3 rounded-md text-center mb-4 font-playfair">Payment Succeeded! Funds added.</div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing || succeeded}
        className="w-full bg-pink-600 hover:bg-pink-700 disabled:bg-gray-500 text-white font-semibold py-3 px-4 rounded-md font-playfair transition-colors"
      >
        {processing ? 'Processing...' : `Add $${amount || '0.00'}`}
      </button>
    </form>
  );
};

// For compatibility, if QuickAddFundsButton was the expected export name.
// You might want to rename the component itself to QuickAddFundsButton or choose one.
export const QuickAddFundsButton = AddFundsForm;
export default AddFundsForm;
