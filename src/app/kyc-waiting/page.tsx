"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, CheckCircle, RefreshCcw } from "lucide-react";

export default function KYCWaitingPage() {
  const router = useRouter();
  const [status, setStatus] = useState("PENDING");
  const [isLoading, setIsLoading] = useState(true);
  const [showAnimation, setShowAnimation] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [error, setError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Fetch KYC status
  const checkStatus = async () => {
    try {
      setIsLoading(true);
      
      const phone = localStorage.getItem("userPhone");
      if (!phone) {
        console.log("No phone found in localStorage, redirecting to signup");
        router.replace("/signup");
        return;
      }

      console.log("Checking status for phone:", phone);
      const response = await fetch(`/api/user-status?phone=${encodeURIComponent(phone)}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache"
        }
      });
      
      if (!response.ok) {
        console.error("API error:", response.status, response.statusText);
        throw new Error(`Failed to fetch status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Status response:", data);
      
      const newStatus = data.kycStatus || "PENDING";
      setStatus(newStatus);

      // If approved, redirect to connect-exchange
      if (newStatus === "APPROVED" && !isRedirecting) {
        console.log("Status is APPROVED, preparing to redirect...");
        setIsRedirecting(true);
        
        // Show approved state briefly before redirecting
        setTimeout(() => {
          console.log("Redirecting to connect-exchange...");
          router.replace("/connect-exchange");
        }, 2000);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error checking KYC status:", error);
      setError("Couldn't connect to server. Please try again.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check auth status
    const phone = localStorage.getItem("userPhone");
    if (!phone) {
      console.log("No phone in localStorage on initial load, redirecting to login");
      router.replace("/login?redirect=kyc-waiting");
      return;
    }

    // Clean up function reference for interval clearing
    let statusInterval;
    let timeInterval;

    // Function to initialize everything
    const initialize = () => {
      // Trigger entrance animation
      setTimeout(() => {
        setShowAnimation(true);
      }, 100);

      // Initial status check
      checkStatus();

      // Set up polling every 15 seconds (reduced from 30 for faster response)
      statusInterval = setInterval(() => {
        if (!isRedirecting) {
          checkStatus();
          setTimeElapsed(prev => prev + 15);
        }
      }, 15000);

      // Update elapsed time counter every second
      timeInterval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    };

    initialize();

    // Cleanup function
    return () => {
      clearInterval(statusInterval);
      clearInterval(timeInterval);
    };
  }, [router, isRedirecting]);

  // Format elapsed time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Force refresh status
  const handleRefresh = () => {
    checkStatus();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: showAnimation ? 1 : 0, y: showAnimation ? 0 : 20 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.h1
            className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-blue-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: showAnimation ? 1 : 0 }}
            transition={{ delay: 0.2 }}
          >
            KYC Verification
          </motion.h1>
          <motion.p
            className="text-gray-400 mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: showAnimation ? 1 : 0 }}
            transition={{ delay: 0.3 }}
          >
            We're reviewing your information
          </motion.p>
        </div>

        {/* Status Card */}
        <motion.div
          className="bg-gray-800/70 backdrop-blur-lg p-6 rounded-xl border border-gray-700 shadow-xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: showAnimation ? 1 : 0, scale: showAnimation ? 1 : 0.95 }}
          transition={{ delay: 0.4 }}
        >
          {/* Status Animation */}
          <div className="flex justify-center mb-6">
            {status === "APPROVED" ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                  <CheckCircle size={48} className="text-white" />
                </div>
              </motion.div>
            ) : status === "REJECTED" ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
                  <AlertCircle size={48} className="text-white" />
                </div>
              </motion.div>
            ) : (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ ease: "linear", duration: 3, repeat: Infinity }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center"
              >
                <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                  <Loader2 size={36} className="text-blue-400" />
                </div>
              </motion.div>
            )}
          </div>

          {/* Status Text */}
          <h2 className="text-xl font-medium text-center mb-3">
            {status === "APPROVED" ? (
              <span className="text-green-400">Verification Approved!</span>
            ) : status === "REJECTED" ? (
              <span className="text-red-400">Verification Rejected</span>
            ) : (
              <span className="text-blue-400">Verification in Progress</span>
            )}
          </h2>

          {/* Status Description */}
          <p className="text-center text-gray-300 mb-6">
            {status === "APPROVED" ? (
              isRedirecting ? 
                "Your KYC has been approved. Redirecting you now..." :
                "Your KYC has been approved. You'll be redirected to connect your exchange..."
            ) : status === "REJECTED" ? (
              "Unfortunately, your KYC verification was rejected. Please contact support for more information."
            ) : (
              "We're currently reviewing your KYC information. This usually takes 24-48 hours."
            )}
          </p>

          {/* Status Info */}
          {status === "PENDING" && (
            <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Status:</span>
                <span className="font-medium">Under Review</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Time Elapsed:</span>
                <span className="font-medium">{formatTime(timeElapsed)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Estimated Time:</span>
                <span className="font-medium">24-48 hours</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4 text-red-200 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center mt-4">
            {status === "PENDING" && (
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCcw size={16} />
                )}
                Refresh Status
              </button>
            )}
            {status === "REJECTED" && (
              <button
                onClick={() => router.push("/welcome")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Try Again
              </button>
            )}
            {status === "APPROVED" && !isRedirecting && (
              <button
                onClick={() => {
                  setIsRedirecting(true);
                  router.replace("/connect-exchange");
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Continue to Exchange Setup &rarr;
              </button>
            )}
          </div>
        </motion.div>

        {/* Help Section */}
        <motion.div
          className="mt-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: showAnimation ? 1 : 0 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-sm text-gray-400">
            Need help? <button onClick={() => router.push("/support")} className="text-blue-400 hover:underline">Contact Support</button>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}