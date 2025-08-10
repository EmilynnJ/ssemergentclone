import React from 'react';

/**
 * PoliciesPage
 *
 * Displays the Terms of Service and Privacy Policy for SoulSeer. This
 * page is static and can be updated by editing the content below.
 */
const PoliciesPage = () => {
  return (
    <div className="p-6 text-white max-w-4xl mx-auto">
      <h2 className="font-alex-brush text-5xl text-soul-pink mb-4 text-center">Policies</h2>
      <section className="mb-8">
        <h3 className="font-playfair text-2xl mb-2">Terms of Service</h3>
        <p className="text-gray-300 mb-2">By accessing or using SoulSeer, you agree to be bound by these Terms of Service. SoulSeer provides an online platform where clients can connect with independent spiritual practitioners (readers) for guidance and readings. SoulSeer is not responsible for the content of readings and does not guarantee any particular outcomes. Users must be 18 years or older to use the platform. All payments are non‑refundable except as expressly provided in our refund policy.</p>
        <p className="text-gray-300">You agree not to misuse the service, engage in harassing or inappropriate behavior, or use the platform for any unlawful purpose. We reserve the right to terminate accounts that violate these terms.</p>
      </section>
      <section>
        <h3 className="font-playfair text-2xl mb-2">Privacy Policy</h3>
        <p className="text-gray-300 mb-2">SoulSeer respects your privacy. We collect personal information such as your name, email, and payment details to provide our services. We do not share your personal information with third parties except as necessary to process payments (via Stripe) or comply with legal obligations. All communications on the platform are encrypted and stored securely.</p>
        <p className="text-gray-300">You have the right to access, update, or delete your personal data at any time. For any privacy concerns, please contact privacy@soulseer.app.</p>
      </section>
    </div>
  );
};

export default PoliciesPage;