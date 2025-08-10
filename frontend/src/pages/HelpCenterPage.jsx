import React from 'react';

/**
 * HelpCenterPage
 *
 * Provides a set of frequently asked questions and answers to help
 * users navigate the SoulSeer platform. This page is entirely static
 * and can be extended with additional FAQs or support resources.
 */
const HelpCenterPage = () => {
  const faqs = [
    {
      q: 'How do I book a reading?',
      a: 'Navigate to the Readings page, browse available readers and click “Request Reading” on the reader you wish to connect with. You’ll be taken to a secure call interface when the reader accepts.',
    },
    {
      q: 'How do I add funds to my balance?',
      a: 'In your dashboard you can add funds via the “Add Funds” option. Payments are processed securely through Stripe.',
    },
    {
      q: 'What if my call drops or disconnects?',
      a: 'Our system includes disconnection protection. If your session drops unexpectedly, you’ll be able to reconnect within a short grace period without additional charges.',
    },
    {
      q: 'How can I become a reader on SoulSeer?',
      a: 'Readers are invited and added by our administrators. If you feel called to read on SoulSeer, please contact us through the support channel.',
    },
  ];
  return (
    <div className="p-6 text-white max-w-4xl mx-auto">
      <h2 className="font-alex-brush text-5xl text-soul-pink mb-4 text-center">Help Center</h2>
      {faqs.map((item, idx) => (
        <div key={idx} className="mb-4">
          <h3 className="font-playfair text-xl mb-1">{item.q}</h3>
          <p className="text-gray-300">{item.a}</p>
        </div>
      ))}
      <p className="mt-6">For further assistance, please email support@soulseer.app.</p>
    </div>
  );
};

export default HelpCenterPage;