import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import "./index.css";
import App from "./App";

const PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

console.log("Clerk Key:", PUBLISHABLE_KEY ? "Found" : "Missing");
console.log("Backend URL:", process.env.REACT_APP_BACKEND_URL);

if (!PUBLISHABLE_KEY) {
  console.error("Missing Clerk Publishable Key");
  // Render error instead of throwing
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(
    <div style={{ padding: '20px', fontFamily: 'Arial', color: 'red' }}>
      <h1>Configuration Error</h1>
      <p>Missing Clerk Publishable Key. Please check your environment variables.</p>
      <p>Expected: REACT_APP_CLERK_PUBLISHABLE_KEY</p>
    </div>
  );
} else {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(
    <React.StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    </React.StrictMode>,
  );
}
