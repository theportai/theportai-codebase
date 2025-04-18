"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function StripeSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing payment...');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleSuccessRedirect = async () => {
      try {
        // Get parameters from URL
        const phone = searchParams.get('phone');
        const sessionId = searchParams.get('session_id');
        
        if (!phone || !sessionId) {
          setError('Missing required information. Please try again.');
          return;
        }

        // Call our API endpoint to verify payment and set auth cookie
        const response = await fetch(`/api/stripe-success?phone=${encodeURIComponent(phone)}&session_id=${sessionId}`);
        
        if (!response.ok) {
          const data = await response.json();
          setError(data.error || 'Failed to process your subscription');
          return;
        }

        // Successfully processed, redirect to dashboard
        setStatus('Success! Redirecting to your dashboard...');
        router.push('/dashboard');
        
      } catch (error) {
        console.error('Error processing subscription:', error);
        setError('Something went wrong. Please contact support.');
      }
    };

    handleSuccessRedirect();
  }, [searchParams, router]);

  // Allow manual redirect if automatic one fails
  const handleManualRedirect = () => {
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
      <div className={`mb-6 ${!error ? 'animate-pulse' : ''}`}>
        {!error ? (
          <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        ) : (
          <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        )}
      </div>
      
      <h1 className="text-3xl font-bold mb-4 text-center">
        {error ? 'Payment Processing Issue' : 'Finalizing Your Subscription'}
      </h1>
      
      {error ? (
        <>
          <p className="text-red-400 text-lg mb-6 text-center">{error}</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={handleManualRedirect}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Continue to Dashboard
            </button>
            <button 
              onClick={() => router.push('/pricing')}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-800 rounded-md transition-colors"
            >
              Return to Pricing
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-gray-400 text-lg mb-2 text-center">{status}</p>
          <p className="text-gray-500 text-sm text-center">
            You'll be automatically redirected when your payment is confirmed.
          </p>
        </>
      )}
    </div>
  );
}