import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import axios from 'axios';
import './index.css';

// The entrypoint for the SoulSeer React application.
// Wraps the App component in a BrowserRouter to enable routing.
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
// Configure Axios default base URL so API calls go to the backend.
axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001';

// Initialize Stripe.js with the public key for payment flows
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <BrowserRouter>
        <Elements stripe={stripePromise}>
          <App />
        </Elements>
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>,
);