"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function StripeSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Processing payment...");
  const [error, setError] = useState("");
  
  // Get parameters from search params
  const sessionId = searchParams.get("session_id");
  const phone = searchParams.get("phone");

  useEffect(() => {
    // Only run if we have the necessary params
    if (!sessionId || !phone) {
      setStatus("Missing payment details. Redirecting to pricing...");
      // Redirect after a brief delay if missing required params
      const timeout = setTimeout(() => {
        router.push("/pricing");
      }, 2000);
      return () => clearTimeout(timeout);
    }

    async function processPayment() {
      try {
        setStatus("Verifying payment...");
        
        // Call API to process payment and get new token
        const response = await fetch(
          `/api/stripe-success?session_id=${encodeURIComponent(sessionId)}&phone=${encodeURIComponent(phone)}`
        );
        
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          setStatus("Payment successful! Redirecting to dashboard...");
          
          // Give a small delay to allow cookies/state to be properly set
          const timeout = setTimeout(() => {
            // Use the suggested redirect or default to dashboard
            router.push(data.redirectTo || "/dashboard");
          }, 1500);
          
          return () => clearTimeout(timeout);
        } else {
          setError(data.error || "Payment verification failed");
          setStatus("Error");
        }
      } catch (err) {
        console.error("Error processing payment:", err);
        setError("Something went wrong. Please contact support.");
        setStatus("Error");
      }
    }

    processPayment();
  }, [sessionId, phone, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="max-w-md w-full p-8 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">PortAI Pro Subscription</h1>
        
        {status === "Error" ? (
          <div className="bg-red-900/30 border border-red-500 rounded-md p-4 mb-6">
            <p className="text-red-300">{error}</p>
            <p className="mt-2">
              Please try again or contact support if the issue persists.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center mb-6">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            </div>
            <p className="text-center text-gray-300">{status}</p>
          </>
        )}
        
        {status === "Error" && (
          <button
            onClick={() => router.push("/pricing")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors mt-6"
          >
            Back to Pricing
          </button>
        )}
      </div>
    </div>
  );
}