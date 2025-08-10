import React from 'react';
import { SignIn } from '@clerk/clerk-react';

/**
 * LoginPage
 *
 * Renders the Clerk SignIn component to allow users to authenticate with
 * email, social accounts, or other configured providers. After a
 * successful login, Clerk will redirect back to the application. The
 * appearance of the SignIn form can be customized via Clerk’s
 * appearance API if desired.
 */
const LoginPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-soul-black text-soul-gray-100">
      <div className="p-8 bg-soul-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <SignIn routing="hash" signUpUrl="/signup" />
      </div>
    </div>
  );
};

export default LoginPage;