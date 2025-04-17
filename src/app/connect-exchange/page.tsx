"use client";

import React, { useState } from 'react';
import { ChevronRight, AlertCircle, Settings, ExternalLink, Lock, Check } from 'lucide-react';

const ConnectExchangesPage = () => {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);

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

  const handleConnectClick = (exchangeId: string) => {
    const exchange = exchanges.find(e => e.id === exchangeId);
    if (exchange?.status === 'active') {
      setSelectedExchange(exchangeId);
      setShowConnectModal(true);
    }
  };

  const closeModal = () => {
    setShowConnectModal(false);
    setSelectedExchange(null);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Success notification */}
      <div className="bg-green-500 p-3 flex items-center justify-center text-white">
        <Check className="h-4 w-4 mr-2" />
        <span>KYC verification completed successfully! You can now connect your exchanges.</span>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-2">Connect Your Exchanges</h1>
        <p className="text-lg text-gray-400 mb-10">
          Link your exchange accounts to start tracking your portfolio and trades in one place.
        </p>

        {/* Exchange cards */}
        <div className="space-y-4 mb-10">
          {exchanges.map((exchange) => (
            <div
              key={exchange.id}
              className={`bg-gray-900 rounded-xl overflow-hidden border ${
                exchange.status === 'active' ? 'border-blue-500' : 'border-gray-800'
              }`}
            >
              <div className="flex items-center justify-between p-6">
                <div className="flex items-center">
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center font-bold text-xl ${
                    exchange.status === 'active' ? 'bg-blue-600' : 'bg-gray-800'
                  }`}>
                    {exchange.logo}
                  </div>
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

        {/* Help section */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-400 mt-1 flex-shrink-0" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold mb-2">Need help connecting?</h3>
              <p className="text-gray-400 mb-4">
                Follow our step-by-step guide to securely connect your exchange accounts or contact our support team.
              </p>
              <div className="flex flex-wrap gap-3">
                <button className="bg-transparent border border-gray-700 text-gray-300 hover:bg-gray-800 px-4 py-2 rounded-lg flex items-center transition-all duration-300">
                  <Settings className="mr-2 h-4 w-4" /> View setup guide
                </button>
                <button className="bg-transparent border border-gray-700 text-gray-300 hover:bg-gray-800 px-4 py-2 rounded-lg flex items-center transition-all duration-300">
                  <ExternalLink className="mr-2 h-4 w-4" /> Contact support
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connection modal */}
      {showConnectModal && selectedExchange && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-blue-500 shadow-2xl">
            <h3 className="text-xl font-bold mb-6 flex items-center">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-md mr-3">
                {exchanges.find(e => e.id === selectedExchange)?.logo}
              </div>
              Connect to {exchanges.find(e => e.id === selectedExchange)?.name}
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-gray-400 mb-2 text-sm">API Key</label>
                <input 
                  type="text" 
                  placeholder="Enter your API key"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-gray-400 mb-2 text-sm">API Secret</label>
                <input 
                  type="password" 
                  placeholder="Enter your API secret"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="ml-2 text-sm text-gray-300">
                  Make sure to create an API key with read-only access. We never store your API secret.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={closeModal}
                className="flex-1 bg-transparent border border-gray-700 text-gray-300 hover:bg-gray-800 px-4 py-3 rounded-lg transition-colors duration-300"
              >
                Cancel
              </button>
              <button 
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-lg font-medium transition-colors duration-300"
              >
                Connect Exchange
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectExchangesPage;