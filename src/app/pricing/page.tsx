"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, ArrowRight, Shield, Zap, ChartBar, MessageSquare } from "lucide-react";
import { jwtDecode } from "jwt-decode";

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    // Check if we are being redirected post-payment
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    
    if (paymentStatus === 'success') {
      // Redirect to dashboard if we're on the pricing page with payment=success
      window.location.href = '/dashboard';
      return;
    }
    
    checkSubscriptionStatus();
    
    // Add animation delay on first render
    setTimeout(() => setAnimateIn(true), 100);
  }, []);

  // Function to check subscription status from token or API
  const checkSubscriptionStatus = async () => {
    setIsCheckingStatus(true);
    
    try {
      // First refresh the token to ensure we have latest data
      const phone = localStorage.getItem("userPhone");
      if (!phone) {
        console.error("No user phone found in localStorage");
        setIsCheckingStatus(false);
        return;
      }
      
      // Call the refresh-token API
      const refreshResponse = await fetch(`/api/auth/refresh-token?phone=${encodeURIComponent(phone)}`);
      if (!refreshResponse.ok) {
        throw new Error("Failed to refresh token");
      }
      
      // Now read the updated token
      const token = document.cookie
        .split(";")
        .find((c) => c.trim().startsWith("userToken="))
        ?.split("=")[1];

      if (token) {
        try {
          const decoded = jwtDecode(token);
          console.log("Decoded token:", decoded);
          
          // Ensure we're checking for exactly true (not truthy values)
          setIsSubscribed(decoded.subscriptionActive === true);
          
          // If subscribed, redirect to dashboard after a brief delay
          if (decoded.subscriptionActive === true) {
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 1000);
          }
        } catch (err) {
          console.error("Failed to decode JWT:", err);
          // Clear potential corrupted token
          document.cookie = "userToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        }
      }
    } catch (error) {
      console.error("Error checking subscription status:", error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    setError("");
    try {
      const phone = localStorage.getItem("userPhone");
      
      if (!phone) {
        setError("User information not found. Please log in again.");
        setIsLoading(false);
        return;
      }
      
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Server error");
      }

      const data = await res.json();
      
      // If user is already subscribed, redirect to dashboard
      if (data.redirectToDashboard) {
        window.location.href = '/dashboard';
        return;
      }
      
      if (data.url) {
        // Store a timestamp to check for stale sessions when returning
        localStorage.setItem("stripeSessionStarted", String(Date.now()));
        window.location.href = data.url;
      } else {
        setError("Checkout session creation failed. Please try again.");
      }
    } catch (err) {
      setError(err.message || "Payment processing failed. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: <Zap className="h-5 w-5 text-blue-400" />,
      title: "Live AI Trading",
      description: "Real-time Binance trading with advanced AI signals"
    },
    {
      icon: <ChartBar className="h-5 w-5 text-green-400" />,
      title: "Portfolio Dashboard",
      description: "Track your assets and PnL in real-time"
    },
    {
      icon: <Shield className="h-5 w-5 text-purple-400" />,
      title: "Sentiment Engine",
      description: "Advanced market sentiment analysis and predictions"
    },
    {
      icon: <MessageSquare className="h-5 w-5 text-yellow-400" />,
      title: "Priority Support",
      description: "24/7 priority support and early feature access"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white flex flex-col items-center justify-center px-4 py-16">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-20 blur-3xl">
          <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-0 -right-1/4 w-1/2 h-1/2 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-1/4 left-1/4 w-1/2 h-1/2 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
      </div>

      <div 
        className={`relative max-w-3xl w-full transition-all duration-700 ease-out transform ${
          animateIn ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-4">
            PortAI Pro
          </h1>
          <p className="text-gray-300 text-lg max-w-xl mx-auto">
            Unlock full access to live AI trading, portfolio tracking, and priority support.
          </p>
        </div>

        {/* Main card */}
        <div className="bg-gray-900/60 backdrop-blur-lg border border-gray-800/50 p-8 md:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
          {/* Subtle corner sparkle */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
          
          {/* Pricing header */}
          <div className="flex flex-col md:flex-row items-center justify-between mb-8 border-b border-gray-800/50 pb-8">
            <div>
              <div className="text-sm text-blue-400 font-medium mb-1">Premium Tier</div>
              <h2 className="text-2xl font-bold">Monthly Subscription</h2>
            </div>
            <div className="mt-4 md:mt-0 text-right">
              <div className="text-sm text-gray-400 line-through">$19.99</div>
              <div className="flex items-end">
                <span className="text-5xl font-extrabold">$12</span>
                <span className="text-gray-400 ml-1 mb-1">/month</span>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="flex items-start space-x-4 p-4 rounded-xl bg-gray-800/30 border border-gray-700/30 hover:border-gray-700/60 transition duration-300"
              >
                <div className="flex-shrink-0 p-2 rounded-lg bg-gray-800">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-medium mb-1">{feature.title}</h3>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Button section */}
          <div className="space-y-4">
            {isCheckingStatus ? (
              <button
                disabled
                className="w-full bg-gray-800/80 border border-gray-700/50 text-white font-medium py-4 rounded-xl flex items-center justify-center transition duration-300"
              >
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> 
                <span>Checking subscription...</span>
              </button>
            ) : isSubscribed ? (
              <div className="space-y-4">
                <button
                  disabled
                  className="w-full bg-green-600/80 text-white font-medium py-4 rounded-xl flex items-center justify-center transition duration-300"
                >
                  <Check className="h-5 w-5 mr-2" /> 
                  <span>You're already subscribed</span>
                </button>
                <a 
                  href="/dashboard" 
                  className="w-full bg-gray-800/40 hover:bg-gray-700/60 border border-gray-700/50 text-white font-medium py-4 rounded-xl flex items-center justify-center transition duration-300"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="h-5 w-5 ml-2" />
                </a>
              </div>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium py-4 rounded-xl flex items-center justify-center transition duration-300 shadow-lg shadow-blue-900/20 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> 
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Subscribe Now</span>
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </button>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-800/40 text-red-300 p-4 rounded-xl text-sm text-center">
                {error}
              </div>
            )}
          </div>

          {/* Security note */}
          <div className="mt-8 pt-6 border-t border-gray-800/50 flex items-center justify-center text-xs text-gray-500">
            <Shield className="h-3 w-3 mr-1" /> 
            <span>Secured by Stripe • 30-day money-back guarantee</span>
          </div>
        </div>

        {/* Testimonial or badge section */}
        <div className="mt-8 text-center text-sm text-gray-400">
          Trusted by 10,000+ traders worldwide
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}