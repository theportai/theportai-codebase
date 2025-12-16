"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();
  const [username, setUsername] = useState('Trader');
  // Animation states
  const [animateCard, setAnimateCard] = useState(false);
  // Pre-generate chart data on the client side only to avoid hydration mismatch
  const [chartData, setChartData] = useState([]);
  // Add loading state to track navigation
  const [isNavigating, setIsNavigating] = useState(false);
  
  useEffect(() => {
    // Generate chart data only on the client side
    const generatedData = Array(30).fill(0).map(() => ({
      height: 20 + Math.floor(Math.random() * 70),
      isPositive: Math.random() > 0.4
    }));
    setChartData(generatedData);
    
    // Start animation when component mounts
    setAnimateCard(true);
    
    // Optional: Simulate loading user data
    const timer = setTimeout(() => {
      setUsername('Trader');
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const handleStartKYC = async () => {
    try {
      // Set navigating state to prevent multiple clicks
      setIsNavigating(true);
      
      // Use a more robust navigation approach
      await router.push('/kyc');
      
      // Fallback mechanism in case the router doesn't navigate
      setTimeout(() => {
        if (window.location.pathname === '/welcome') {
          // If still on welcome page after timeout, try direct navigation
          window.location.href = '/kyc';
        }
      }, 300);
    } catch (error) {
      console.error("Navigation error:", error);
      // Force hard navigation as last resort
      window.location.href = '/kyc';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white flex flex-col">
      {/* Navbar */}
      <nav className="px-8 py-5 flex items-center justify-between border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 font-bold text-2xl">PortAI</span>
        </div>
        <div className="flex items-center space-x-8">
          <Link href="/features" className="text-gray-300 hover:text-white transition-all hover:scale-105">
            Features
          </Link>
          <Link href="/how-it-works" className="text-gray-300 hover:text-white transition-all hover:scale-105">
            How It Works
          </Link>
          <Link href="/pricing" className="text-gray-300 hover:text-white transition-all hover:scale-105">
            Pricing
          </Link>
          <Link href="/support" className="text-gray-300 hover:text-white transition-all hover:scale-105">
            Support
          </Link>
          <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md font-medium transition-all transform hover:scale-105">
            Sign In
          </button>
        </div>
      </nav>

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Section */}
        <div className="w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center">
          <div className={`transition-all duration-700 transform ${animateCard ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="mb-6">
              <div className="inline-block bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-medium mb-4">
                Welcome
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3 leading-tight">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">PortAI</span>, {username}!
            </h1>
            <p className="text-xl text-purple-400 mb-6">Your AI-powered trading journey begins here</p>
            <p className="text-gray-400 mb-8 text-lg max-w-lg">
              You're just one step away from revolutionizing your trading strategy with the power of artificial intelligence.
            </p>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-8 backdrop-filter backdrop-blur-sm hover:border-gray-600 transition-all shadow-lg">
              <h3 className="text-xl font-medium mb-4 flex items-center">
                <svg className="w-6 h-6 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Complete Your KYC
              </h3>
              <p className="text-gray-400 mb-6">
                To comply with regulations and ensure secure trading, we need to verify your identity. This simple verification process will only take a few minutes of your time.
              </p>
              <button
                onClick={handleStartKYC}
                disabled={isNavigating}
                className={`w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center shadow-md hover:shadow-blue-900/30 transform hover:translate-y-px ${isNavigating ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                {isNavigating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    Start KYC Verification
                    <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center text-sm text-gray-500 group">
              <svg className="w-5 h-5 mr-2 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="group-hover:text-gray-400 transition-colors">Your information is encrypted and secure</span>
            </div>
          </div>
        </div>

        {/* Right Section - Trading Dashboard Preview */}
        <div className="w-full md:w-1/2 p-8 md:p-16 flex items-center justify-center">
          <div className={`transition-all duration-1000 delay-300 transform ${animateCard ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="bg-gray-800/80 rounded-2xl overflow-hidden shadow-2xl border border-gray-700 hover:shadow-blue-900/20 transition-all">
              {/* Window Controls */}
              <div className="flex items-center bg-gray-900 px-4 py-3">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="mx-auto text-sm text-gray-400 font-medium">Trading Dashboard</div>
              </div>

              {/* Dashboard Preview */}
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-900/70 p-4 rounded-lg hover:bg-gray-800/90 transition-colors">
                    <div className="text-sm text-gray-400 mb-1">Portfolio Value</div>
                    <div className="text-xl font-bold">₹27,439.65</div>
                    <div className="text-green-500 text-sm flex items-center">
                      +5.26%
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                  <div className="bg-gray-900/70 p-4 rounded-lg hover:bg-gray-800/90 transition-colors">
                    <div className="text-sm text-gray-400 mb-1">Today's P/L</div>
                    <div className="text-xl font-bold">+₹843.21</div>
                    <div className="text-green-500 text-sm flex items-center">
                      +3.17%
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900/70 p-4 rounded-lg mb-4 hover:bg-gray-800/90 transition-colors">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-400">Performance (Last 30 Days)</div>
                  </div>
                  <div className="h-32 flex items-end space-x-1">
                    {/* Client-side rendered chart bars to avoid hydration errors */}
                    {chartData.map((bar, i) => (
                      <div
                        key={i}
                        className={`w-full rounded-t ${bar.isPositive ? 'bg-green-500/90' : 'bg-red-400/90'} transition-all duration-300 hover:opacity-80`}
                        style={{ height: `${bar.height}%` }}
                      ></div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>1</span>
                    <span>15</span>
                    <span>30</span>
                  </div>
                </div>

                <div className="bg-gray-900/70 p-4 rounded-lg hover:bg-gray-800/90 transition-colors">
                  <div className="text-sm text-gray-400 mb-3 flex items-center justify-between">
                    <span>Recent Trades</span>
                    <span className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">View All</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-2 rounded hover:bg-gray-800 transition-colors">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                        <span>AAPL</span>
                      </div>
                      <span className="text-green-500 font-medium">+₹124.50</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded hover:bg-gray-800 transition-colors">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                        <span>TSLA</span>
                      </div>
                      <span className="text-red-500 font-medium">-₹73.20</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded hover:bg-gray-800 transition-colors">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                        <span>MSFT</span>
                      </div>
                      <span className="text-green-500 font-medium">+₹215.75</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="p-6 border-t border-gray-800 text-center text-gray-500 text-sm bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <p>© 2025 PortAI. All rights reserved.</p>
          <div className="flex space-x-4 mt-2 md:mt-0">
            <a href="#" className="hover:text-gray-300 transition-colors">Terms</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}