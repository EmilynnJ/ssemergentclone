import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import SimpleApp from "./SimpleApp";

console.log("Environment check:", {
  backend: process.env.REACT_APP_BACKEND_URL,
  clerk: process.env.REACT_APP_CLERK_PUBLISHABLE_KEY ? "Found" : "Missing",
  stripe: process.env.REACT_APP_STRIPE_PUBLIC_KEY ? "Found" : "Missing"
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <SimpleApp />
  </React.StrictMode>
);
