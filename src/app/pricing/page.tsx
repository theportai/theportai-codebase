"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { jwtDecode } from "jwt-decode";

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  // Function to check subscription status from token or API
  const checkSubscriptionStatus = async () => {
    setIsCheckingStatus(true);
    
    try {
      // First refresh the token to ensure we have latest data
      const phone = localStorage.getItem("userPhone");
      if (phone) {
        await fetch(`/api/auth/refresh-token?phone=${encodeURIComponent(phone)}`);
      }
      
      // Now read the updated token
      const token = document.cookie
        .split(";")
        .find((c) => c.trim().startsWith("userToken="))
        ?.split("=")[1];

      if (token) {
        try {
          const decoded: any = jwtDecode(token);
          console.log("Decoded token:", decoded);
          
          setIsSubscribed(decoded.subscriptionActive === true);
        } catch (err) {
          console.error("Failed to decode JWT:", err);
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
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch (err) {
      setError("Stripe checkout failed. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-2xl w-full bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-xl">
        <h1 className="text-4xl font-bold mb-4">PortAI Pro</h1>
        <p className="text-gray-400 mb-6">
          Unlock full access to live AI trading, portfolio tracking, and priority support.
        </p>

        <div className="bg-gray-800 p-6 rounded-xl mb-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-medium">Monthly Subscription</span>
            <span className="text-3xl font-bold">$12</span>
          </div>
          <ul className="text-gray-400 list-disc pl-5 text-sm space-y-1">
            <li>Live Binance trading with real-time AI signals</li>
            <li>Real-time dashboard with portfolio and PnL</li>
            <li>Advanced sentiment + prediction engine</li>
            <li>Priority support and future feature access</li>
          </ul>
        </div>

        {isCheckingStatus ? (
          <button
            disabled
            className="w-full bg-gray-700 text-white font-medium py-3 rounded-xl flex items-center justify-center transition duration-300"
          >
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Checking subscription...
          </button>
        ) : isSubscribed ? (
          <div className="flex flex-col items-center">
            <button
              disabled
              className="w-full bg-green-700 text-white font-medium py-3 rounded-xl flex items-center justify-center transition duration-300 mb-4"
            >
              ✅ You're already subscribed
            </button>
            <a 
              href="/dashboard" 
              className="text-blue-400 hover:text-blue-300 text-sm transition"
            >
              Go to Dashboard →
            </a>
          </div>
        ) : (
          <button
            onClick={handleSubscribe}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl flex items-center justify-center transition duration-300"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Processing...
              </>
            ) : (
              "Subscribe Now"
            )}
          </button>
        )}

        {error && <p className="text-red-500 mt-4 text-sm text-center">{error}</p>}
      </div>
    </div>
  );
}