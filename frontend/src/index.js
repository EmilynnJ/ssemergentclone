import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import "./index.css";
import App from "./App";

const PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

console.log("🔮 SoulSeer Loading...", {
  clerkKey: PUBLISHABLE_KEY ? "✅ Found" : "❌ Missing",
  backendUrl: process.env.REACT_APP_BACKEND_URL
});

if (!PUBLISHABLE_KEY) {
  console.error("Missing Clerk Publishable Key");
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </React.StrictMode>,
);
