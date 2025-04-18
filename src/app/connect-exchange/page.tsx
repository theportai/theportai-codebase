"use client";

import React, { useState, useEffect } from 'react';
import { ChevronRight, AlertCircle, Settings, ExternalLink, Lock, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

const ConnectExchangesPage = () => {
  const router = useRouter();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    apiKey?: string;
    apiSecret?: string;
  }>({});

  const exchanges = [
    {
      id: 'binance',
      name: 'Binance',
      logo: 'B',
      status: 'active',
      description: 'Connect your Binance account to automatically track your portfolio and trades.',
      features: ['Real-time portfolio tracking', 'Automated trade history', 'Market alerts'],
    },
    {
      id: 'wazirx',
      name: 'WazirX',
      logo: 'W',
      status: 'coming-soon',
      description: 'Integration with WazirX is coming soon.',
    },
    {
      id: 'coindcx',
      name: 'CoinDCX',
      logo: 'C',
      status: 'coming-soon',
      description: 'Integration with CoinDCX is coming soon.',
    },
  ];

  // Reset error messages when inputs change
  useEffect(() => {
    setErrorMessage(null);
    setValidationErrors({});
  }, [apiKey, apiSecret]);

  const handleConnectClick = (exchangeId: string) => {
    const exchange = exchanges.find(e => e.id === exchangeId);
    if (exchange?.status === 'active') {
      setSelectedExchange(exchangeId);
      setShowConnectModal(true);
      // Reset form state
      setApiKey('');
      setApiSecret('');
      setErrorMessage(null);
      setValidationErrors({});
    }
  };

  const closeModal = () => {
    setShowConnectModal(false);
    setSelectedExchange(null);
    setApiKey('');
    setApiSecret('');
    setLoading(false);
    setErrorMessage(null);
    setValidationErrors({});
  };

  // Handle clicks outside the modal
  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !loading) {
      closeModal();
    }
  };

  const validateForm = () => {
    const errors: {apiKey?: string; apiSecret?: string} = {};
    let isValid = true;

    // API Key validation
    if (!apiKey.trim()) {
      errors.apiKey = 'API Key is required';
      isValid = false;
    } else if (apiKey.length < 10) {
      errors.apiKey = 'API Key appears to be too short';
      isValid = false;
    }

    // API Secret validation
    if (!apiSecret.trim()) {
      errors.apiSecret = 'API Secret is required';
      isValid = false;
    } else if (apiSecret.length < 20) {
      errors.apiSecret = 'API Secret appears to be too short';
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleConnectExchange = async () => {
    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/connect-binance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          apiKey, 
          apiSecret,
          exchangeId: selectedExchange
        }),
        credentials: 'include' // Ensure cookies are sent with the request
      });

      const data = await res.json();
      
      if (res.ok) {
        // Show success notification through toast or other means
        router.push('/dashboard');
      } else {
        // Handle specific error codes
        let errorMsg = 'Failed to connect to exchange';
        
        switch (res.status) {
          case 400:
            errorMsg = data?.error || 'Invalid request. Please check your inputs.';
            break;
          case 401:
            errorMsg = 'Authentication error. Please log in again.';
            break;
          case 403:
            errorMsg = 'Access denied. Your API keys may be invalid or lack proper permissions.';
            break;
          case 429:
            errorMsg = 'Too many requests. Please try again later.';
            break;
          case 500:
            errorMsg = 'Server error. Our team has been notified.';
            break;
          default:
            errorMsg = data?.error || 'An unexpected error occurred. Please try again.';
        }
        
        setErrorMessage(errorMsg);
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Connect Error:', err);
      setErrorMessage('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  };

  // Keyboard accessibility for modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showConnectModal && !loading) {
        closeModal();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showConnectModal, loading]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-green-500 p-3 flex items-center justify-center text-white">
        <Check className="h-4 w-4 mr-2" />
        <span>KYC verification completed successfully! You can now connect your exchanges.</span>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-2">Connect Your Exchanges</h1>
        <p className="text-lg text-gray-400 mb-10">
          Link your exchange accounts to start tracking your portfolio and trades in one place.
        </p>

        <div className="space-y-4 mb-10">
          {exchanges.map((exchange) => (
            <div key={exchange.id} className={`bg-gray-900 rounded-xl overflow-hidden border ${exchange.status === 'active' ? 'border-blue-500' : 'border-gray-800'}`}>
              <div className="flex items-center justify-between p-6">
                <div className="flex items-center">
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center font-bold text-xl ${exchange.status === 'active' ? 'bg-blue-600' : 'bg-gray-800'}`}>{exchange.logo}</div>
                  <div className="ml-4">
                    <h2 className="text-xl font-bold">{exchange.name}</h2>
                    <p className="text-gray-400">{exchange.description}</p>
                  </div>
                </div>
                <div>
                  {exchange.status === 'active' ? (
                    <button 
                      onClick={() => handleConnectClick(exchange.id)} 
                      className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium flex items-center transition-colors duration-300"
                      aria-label={`Connect to ${exchange.name}`}
                    >
                      Connect <ChevronRight className="ml-1 h-4 w-4" />
                    </button>
                  ) : (
                    <div className="flex items-center px-4 py-2 border border-gray-700 rounded-lg text-gray-400">
                      <Lock className="mr-1 h-4 w-4" /> Coming Soon
                    </div>
                  )}
                </div>
              </div>
              {exchange.status === 'active' && exchange.features && (
                <div className="px-6 pb-5 border-t border-gray-800 bg-gray-900 pt-4">
                  <div className="flex flex-wrap gap-6">
                    {exchange.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center text-gray-300">
                        <Check className="text-green-400 h-4 w-4 mr-2" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-400 mt-1 flex-shrink-0" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold mb-2">Need help connecting?</h3>
              <p className="text-gray-400 mb-4">Follow our step-by-step guide to securely connect your exchange accounts or contact our support team.</p>
              <div className="flex flex-wrap gap-3">
                <button 
                  className="bg-transparent border border-gray-700 text-gray-300 hover:bg-gray-800 px-4 py-2 rounded-lg flex items-center transition-all duration-300"
                  aria-label="View setup guide"
                >
                  <Settings className="mr-2 h-4 w-4" /> View setup guide
                </button>
                <button 
                  className="bg-transparent border border-gray-700 text-gray-300 hover:bg-gray-800 px-4 py-2 rounded-lg flex items-center transition-all duration-300"
                  aria-label="Contact support"
                >
                  <ExternalLink className="mr-2 h-4 w-4" /> Contact support
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showConnectModal && selectedExchange && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
          onClick={handleOutsideClick}
          aria-modal="true"
          role="dialog"
          aria-labelledby="modal-title"
        >
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-blue-500 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 id="modal-title" className="text-xl font-bold flex items-center">
                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-md mr-3">
                  {exchanges.find(e => e.id === selectedExchange)?.logo}
                </div>
                Connect to {exchanges.find(e => e.id === selectedExchange)?.name}
              </h3>
              <button 
                onClick={closeModal}
                disabled={loading}
                className="text-gray-400 hover:text-white"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
            
            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="apiKey" className="block text-gray-400 mb-2 text-sm font-medium">API Key</label>
                <input 
                  id="apiKey"
                  type="text" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)} 
                  placeholder="Enter your API key" 
                  className={`w-full bg-gray-800 border ${validationErrors.apiKey ? 'border-red-500' : 'border-gray-700'} rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  disabled={loading}
                  aria-invalid={!!validationErrors.apiKey}
                  aria-describedby={validationErrors.apiKey ? "apiKey-error" : undefined}
                />
                {validationErrors.apiKey && (
                  <p id="apiKey-error" className="text-red-400 text-sm mt-1">{validationErrors.apiKey}</p>
                )}
              </div>
              <div>
                <label htmlFor="apiSecret" className="block text-gray-400 mb-2 text-sm font-medium">API Secret</label>
                <input 
                  id="apiSecret"
                  type="password" 
                  value={apiSecret} 
                  onChange={(e) => setApiSecret(e.target.value)} 
                  placeholder="Enter your API secret" 
                  className={`w-full bg-gray-800 border ${validationErrors.apiSecret ? 'border-red-500' : 'border-gray-700'} rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  disabled={loading}
                  aria-invalid={!!validationErrors.apiSecret}
                  aria-describedby={validationErrors.apiSecret ? "apiSecret-error" : undefined}
                />
                {validationErrors.apiSecret && (
                  <p id="apiSecret-error" className="text-red-400 text-sm mt-1">{validationErrors.apiSecret}</p>
                )}
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="ml-2 text-sm text-gray-300">
                  <p className="mb-1">Make sure to create an API key with read-only access. We never store your API secret.</p>
                  <p>Learn how to <a href="#" className="text-blue-400 hover:underline">create a secure API key</a>.</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={closeModal} 
                disabled={loading} 
                className={`flex-1 bg-transparent border border-gray-700 text-gray-300 hover:bg-gray-800 px-4 py-3 rounded-lg transition-colors duration-300 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Cancel
              </button>
              <button 
                onClick={handleConnectExchange} 
                disabled={loading} 
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors duration-300 ${loading ? 'bg-blue-600/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'} text-white`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Connecting...
                  </span>
                ) : 'Connect Exchange'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectExchangesPage;