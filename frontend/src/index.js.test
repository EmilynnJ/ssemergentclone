import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

// Simple test component to debug environment variables
function TestApp() {
  console.log("Environment variables:", {
    REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL,
    REACT_APP_CLERK_PUBLISHABLE_KEY: process.env.REACT_APP_CLERK_PUBLISHABLE_KEY,
    REACT_APP_STRIPE_PUBLIC_KEY: process.env.REACT_APP_STRIPE_PUBLIC_KEY
  });

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>SoulSeer - Environment Test</h1>
      <div>
        <p><strong>Backend URL:</strong> {process.env.REACT_APP_BACKEND_URL || 'NOT FOUND'}</p>
        <p><strong>Clerk Key:</strong> {process.env.REACT_APP_CLERK_PUBLISHABLE_KEY ? 'FOUND' : 'NOT FOUND'}</p>
        <p><strong>Stripe Key:</strong> {process.env.REACT_APP_STRIPE_PUBLIC_KEY ? 'FOUND' : 'NOT FOUND'}</p>
      </div>
      <p>If you see this page, the basic React app is working!</p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<TestApp />);