import React, { useState } from 'react';

export function PoliciesPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-alex-brush text-pink-400 mb-4">
          Terms & Policies
        </h1>
        <p className="text-gray-300 font-playfair">
          Understanding our terms and community guidelines
        </p>
      </div>

      <div className="space-y-6">
        {/* Terms of Service */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30 p-6">
          <h2 className="text-2xl font-alex-brush text-pink-400 mb-4">Terms of Service</h2>
          <div className="text-gray-300 font-playfair space-y-4">
            <p>
              Welcome to SoulSeer, a premium spiritual reading platform. By using our services, 
              you agree to these terms and conditions.
            </p>
            
            <h3 className="text-white font-bold">1. Service Description</h3>
            <p>
              SoulSeer connects clients with professional psychic readers for spiritual guidance 
              through chat, phone, and video sessions. All readings are for entertainment purposes only.
            </p>
            
            <h3 className="text-white font-bold">2. Payment Terms</h3>
            <p>
              Readings are billed either per-minute or at fixed rates. All payments are processed 
              securely through Stripe. Clients must maintain sufficient account balance for sessions.
            </p>
            
            <h3 className="text-white font-bold">3. Reader Requirements</h3>
            <p>
              Readers must be approved by our team and maintain professional standards. 
              Revenue is split 70% to readers, 30% to platform for operational costs.
            </p>
            
            <h3 className="text-white font-bold">4. Community Guidelines</h3>
            <p>
              Respectful communication is required. Harassment, inappropriate content, 
              or fraudulent activity will result in account termination.
            </p>
          </div>
        </div>

        {/* Privacy Policy */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30 p-6">
          <h2 className="text-2xl font-alex-brush text-pink-400 mb-4">Privacy Policy</h2>
          <div className="text-gray-300 font-playfair space-y-4">
            <h3 className="text-white font-bold">Data Collection</h3>
            <p>
              We collect account information, payment details, and session data to provide 
              our services. Personal information is protected and never shared with third parties.
            </p>
            
            <h3 className="text-white font-bold">Session Privacy</h3>
            <p>
              All reading sessions are private and confidential. Chat logs and recordings 
              are encrypted and only accessible to participants.
            </p>
            
            <h3 className="text-white font-bold">Cookies & Analytics</h3>
            <p>
              We use cookies for authentication and analytics to improve user experience. 
              You can manage cookie preferences in your browser settings.
            </p>
          </div>
        </div>

        {/* End User Agreement */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30 p-6">
          <h2 className="text-2xl font-alex-brush text-pink-400 mb-4">End User Agreement</h2>
          <div className="text-gray-300 font-playfair space-y-4">
            <h3 className="text-white font-bold">Age Requirements</h3>
            <p>
              Users must be 18 years or older to use SoulSeer services. Parental consent 
              is required for users under 18.
            </p>
            
            <h3 className="text-white font-bold">Disclaimer</h3>
            <p>
              Psychic readings are for entertainment and spiritual guidance purposes only. 
              SoulSeer does not guarantee specific outcomes or predict future events.
            </p>
            
            <h3 className="text-white font-bold">Refund Policy</h3>
            <p>
              Refunds may be issued for technical issues or unsatisfactory sessions at our discretion. 
              Contact support within 24 hours of your session for refund requests.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HelpCenter() {
  const [activeSection, setActiveSection] = useState('getting-started');

  const sections = [
    { id: 'getting-started', title: 'Getting Started', icon: '🚀' },
    { id: 'payments', title: 'Payments & Billing', icon: '💳' },
    { id: 'readings', title: 'Reading Sessions', icon: '🔮' },
    { id: 'technical', title: 'Technical Support', icon: '⚙️' },
    { id: 'account', title: 'Account Management', icon: '👤' }
  ];

  const faqs = {
    'getting-started': [
      {
        q: 'How do I book my first reading?',
        a: 'Browse available readers, select one that resonates with you, and click "Request Reading". You can choose between per-minute billing or fixed-duration sessions.'
      },
      {
        q: 'What types of readings are available?',
        a: 'We offer chat readings (text-based), phone readings (voice-only), and video readings (face-to-face). Each reader sets their own rates for different session types.'
      },
      {
        q: 'How do I add funds to my account?',
        a: 'Click "Add Funds" in your dashboard, enter the amount, and complete payment through our secure Stripe integration. Funds are added instantly to your account.'
      }
    ],
    'payments': [
      {
        q: 'How does per-minute billing work?',
        a: 'For per-minute sessions, you\'re charged every minute during an active reading. Billing stops when either party ends the session. You need sufficient balance to continue.'
      },
      {
        q: 'What are fixed-duration readings?',
        a: 'These are pre-paid sessions for 15, 30, or 60 minutes at a fixed price. You pay upfront and get guaranteed time with your reader.'
      },
      {
        q: 'Are my payments secure?',
        a: 'Yes, all payments are processed through Stripe, a leading secure payment processor. We never store your payment information on our servers.'
      }
    ],
    'readings': [
      {
        q: 'What if my reader doesn\'t accept my request?',
        a: 'Readers may decline requests if they\'re busy or feel they\'re not the right fit. You can try another reader or wait and try again later.'
      },
      {
        q: 'Can I schedule a reading for later?',
        a: 'Yes! When requesting a reading, you can set a future date and time. The reader will be notified and can accept the scheduled session.'
      },
      {
        q: 'What happens if I run out of balance during a session?',
        a: 'The session will automatically end when your balance is insufficient. You can add funds and request to continue if the reader is available.'
      }
    ],
    'technical': [
      {
        q: 'Video/audio not working during calls?',
        a: 'Check your browser permissions for camera and microphone access. Refresh the page and try again. Use Chrome or Safari for best compatibility.'
      },
      {
        q: 'Chat messages not sending?',
        a: 'Check your internet connection. If the issue persists, refresh the page. Contact support if problems continue.'
      },
      {
        q: 'Live streams not loading?',
        a: 'Ensure you have a stable internet connection. Try refreshing the page or switching to a different browser.'
      }
    ],
    'account': [
      {
        q: 'How do I change my account settings?',
        a: 'Click on your profile picture in the top right corner and select "Account Settings" to update your information.'
      },
      {
        q: 'Can I delete my account?',
        a: 'Yes, contact our support team to request account deletion. Note that this action is permanent and cannot be undone.'
      },
      {
        q: 'How do I become a reader?',
        a: 'Use the "Apply to be a Reader" link to submit an application. Our team will review your credentials and spiritual background.'
      }
    ]
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-alex-brush text-pink-400 mb-4">
          Help Center
        </h1>
        <p className="text-gray-300 font-playfair">
          Find answers to common questions and get support
        </p>
      </div>

      <div className="flex gap-6">
        {/* Categories Sidebar */}
        <div className="w-64">
          <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30 p-4">
            <h3 className="font-playfair text-white mb-4">Categories</h3>
            <div className="space-y-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    activeSection === section.id
                      ? 'bg-pink-600/20 text-pink-400'
                      : 'text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  <span className="mr-2">{section.icon}</span>
                  {section.title}
                </button>
              ))}
            </div>
            
            {/* Contact Support */}
            <div className="mt-6 p-4 bg-purple-600/20 border border-purple-500 rounded-lg">
              <h4 className="text-white font-playfair mb-2">Need More Help?</h4>
              <p className="text-purple-300 text-sm mb-3">
                Can't find what you're looking for?
              </p>
              <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg text-sm font-playfair transition-colors">
                Contact Support
              </button>
            </div>
          </div>
        </div>

        {/* FAQ Content */}
        <div className="flex-1">
          <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30 p-6">
            <h2 className="text-2xl font-alex-brush text-pink-400 mb-6">
              {sections.find(s => s.id === activeSection)?.title}
            </h2>
            
            <div className="space-y-6">
              {faqs[activeSection]?.map((faq, index) => (
                <div key={index} className="border-b border-gray-700 pb-6 last:border-b-0">
                  <h3 className="text-white font-playfair font-bold mb-3">
                    {faq.q}
                  </h3>
                  <p className="text-gray-300 font-playfair">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ApplyReaderPage({ api }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    experience: '',
    specialties: [],
    bio: '',
    certifications: '',
    availableHours: '',
    portfolio: '',
    references: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const specialtyOptions = [
    'Tarot Reading', 'Astrology', 'Numerology', 'Palm Reading',
    'Crystal Reading', 'Aura Reading', 'Dream Interpretation',
    'Spiritual Guidance', 'Love & Relationships', 'Career Guidance',
    'Pet Psychic', 'Medium/Spirit Communication', 'Energy Healing'
  ];

  const handleSpecialtyChange = (specialty) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty]
    }));
  };

  const submitApplication = async () => {
    setSubmitting(true);
    try {
      // In a real implementation, this would send the application to the backend
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting application:', error);
      alert('Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30 p-8">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-alex-brush text-pink-400 mb-4">
            Application Submitted!
          </h2>
          
          <p className="text-gray-300 font-playfair mb-6">
            Thank you for your interest in becoming a SoulSeer reader. Our team will review 
            your application and contact you within 5-7 business days.
          </p>
          
          <div className="bg-purple-600/20 border border-purple-500 rounded-lg p-4">
            <h3 className="text-white font-playfair font-bold mb-2">What's Next?</h3>
            <ul className="text-purple-300 text-sm space-y-1 text-left">
              <li>• Application review by our team</li>
              <li>• Background verification process</li>
              <li>• Skills assessment interview</li>
              <li>• Platform training and onboarding</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-alex-brush text-pink-400 mb-4">
          Apply to be a Reader
        </h1>
        <p className="text-gray-300 font-playfair">
          Join our community of gifted psychics and share your spiritual gifts
        </p>
      </div>

      <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30 p-6">
        <form className="space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-alex-brush text-pink-400 mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-playfair mb-2">First Name *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-white font-playfair mb-2">Last Name *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-white font-playfair mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-white font-playfair mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Experience & Specialties */}
          <div>
            <h3 className="text-lg font-alex-brush text-pink-400 mb-4">Professional Background</h3>
            
            <div className="mb-4">
              <label className="block text-white font-playfair mb-2">Years of Experience *</label>
              <select
                value={formData.experience}
                onChange={(e) => setFormData({...formData, experience: e.target.value})}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none"
                required
              >
                <option value="">Select experience level</option>
                <option value="1-2">1-2 years</option>
                <option value="3-5">3-5 years</option>
                <option value="6-10">6-10 years</option>
                <option value="10+">10+ years</option>
              </select>
            </div>

            <div>
              <label className="block text-white font-playfair mb-2">Specialties (select all that apply) *</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {specialtyOptions.map((specialty) => (
                  <label key={specialty} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.specialties.includes(specialty)}
                      onChange={() => handleSpecialtyChange(specialty)}
                      className="text-pink-500 focus:ring-pink-500"
                    />
                    <span className="text-gray-300 text-sm">{specialty}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Bio & Additional Info */}
          <div>
            <h3 className="text-lg font-alex-brush text-pink-400 mb-4">Additional Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white font-playfair mb-2">Bio/About You *</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  placeholder="Tell us about your spiritual journey, approach to readings, and what makes you unique..."
                  rows={4}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-white font-playfair mb-2">Certifications & Training</label>
                <textarea
                  value={formData.certifications}
                  onChange={(e) => setFormData({...formData, certifications: e.target.value})}
                  placeholder="List any relevant certifications, training, or credentials..."
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-white font-playfair mb-2">Available Hours</label>
                <textarea
                  value={formData.availableHours}
                  onChange={(e) => setFormData({...formData, availableHours: e.target.value})}
                  placeholder="When are you typically available for readings? Include time zone..."
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-6">
            <button
              type="button"
              onClick={submitApplication}
              disabled={submitting || !formData.firstName || !formData.lastName || !formData.email || !formData.experience || formData.specialties.length === 0 || !formData.bio}
              className="w-full bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-playfair transition-colors"
            >
              {submitting ? 'Submitting Application...' : 'Submit Application'}
            </button>
            
            <p className="text-gray-400 text-sm text-center mt-4">
              By submitting this application, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminDashboard({ api }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [readerApplications, setReaderApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);

  const tabs = [
    { id: 'overview', title: 'Overview', icon: '📊' },
    { id: 'users', title: 'Users', icon: '👥' },
    { id: 'readers', title: 'Reader Applications', icon: '🔮' },
    { id: 'sessions', title: 'Sessions', icon: '📱' },
    { id: 'payments', title: 'Payments', icon: '💳' },
    { id: 'support', title: 'Support', icon: '🎧' }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-alex-brush text-pink-400 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-300 font-playfair">
          Platform management and oversight
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30 p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-playfair transition-colors ${
                activeTab === tab.id
                  ? 'bg-pink-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.title}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-pink-500/30 p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-alex-brush text-pink-400">Platform Overview</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-white font-playfair mb-2">Total Users</h3>
                <div className="text-2xl font-alex-brush text-pink-400">1,234</div>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-white font-playfair mb-2">Active Readers</h3>
                <div className="text-2xl font-alex-brush text-green-400">56</div>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-white font-playfair mb-2">Today's Sessions</h3>
                <div className="text-2xl font-alex-brush text-blue-400">89</div>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-white font-playfair mb-2">Revenue (24h)</h3>
                <div className="text-2xl font-alex-brush text-yellow-400">$2,456</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'readers' && (
          <div>
            <h2 className="text-2xl font-alex-brush text-pink-400 mb-6">Reader Applications</h2>
            <div className="text-center text-gray-400 py-8">
              <p className="font-playfair">Reader application management interface would be here</p>
              <p className="text-sm">Features: Approve/reject applications, view credentials, set up reader profiles</p>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h2 className="text-2xl font-alex-brush text-pink-400 mb-6">User Management</h2>
            <div className="text-center text-gray-400 py-8">
              <p className="font-playfair">User management interface would be here</p>
              <p className="text-sm">Features: View user accounts, manage suspensions, handle disputes</p>
            </div>
          </div>
        )}

        {/* Add more tab content as needed */}
      </div>
    </div>
  );
}

export default { PoliciesPage, HelpCenter, ApplyReaderPage, AdminDashboard };
