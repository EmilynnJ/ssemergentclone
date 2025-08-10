import React from 'react';
import { SignUp } from '@clerk/clerk-react';

/**
 * SignupPage
 *
 * Displays the Clerk SignUp component for user registration. Users can
 * create accounts using email/password or social providers as
 * configured. After sign‑up, Clerk will handle email verification and
 * session creation automatically.
 */
const SignupPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-soul-black text-soul-gray-100">
      <div className="p-8 bg-soul-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <SignUp routing="hash" signInUrl="/login" />
      </div>
    </div>
  );
};

export default SignupPage;