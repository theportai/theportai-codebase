"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  
  
  useEffect(() => {
    let isMounted = true; // ✅ Prevent state update on unmounted component
  
    async function fetchKYCStatus() {
      const phone = localStorage.getItem("userPhone");
      
      // ✅ Check if phone number is missing
      if (!phone) {
        console.error("❌ No phone number found in localStorage.");
        return; // 🔴 Stop execution if phone number is missing
      }
  
      try {
        console.log(`🔍 Fetching KYC status for phone: ${phone}`);
        const response = await fetch(`/api/user-status?phone=${phone}`, { cache: "no-store" });
        const data = await response.json();
        console.log("📥 API Response:", data);
  
        if (!isMounted) return; // ✅ Prevent updates if component is unmounted
  
        if (response.ok && data.kycStatus) {
          setKycStatus(data.kycStatus);
  
          // ✅ Redirect based on KYC status
          if (data.kycStatus === "APPROVED") {
            setTimeout(() => router.push("/dashboard"), 1000);
          } else if (data.kycStatus === "REJECTED") {
            setTimeout(() => router.push("/kyc"), 1000);
          }
        } else {
          console.error("❌ Error fetching KYC status:", data.error);
        }
      } catch (error) {
        console.error("❌ Failed to fetch KYC status:", error);
      }
    }
  
    // ✅ Only check KYC status if phone is present
    if (localStorage.getItem("userPhone")) {
      fetchKYCStatus();
    }
  
    return () => {
      isMounted = false;
    };
  }, [kycStatus, router]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-6">
      {kycStatus === "PENDING" ? (
        <div className="w-full max-w-lg bg-gray-800 p-6 rounded-lg text-center">
          <h1 className="text-2xl font-bold mb-3">KYC in Progress 🚀</h1>
          <p className="text-gray-400">Your KYC verification is in progress.</p>
        </div>
      ) : kycStatus === "APPROVED" ? (
        <div className="w-full max-w-lg bg-gray-800 p-6 rounded-lg text-center">
          <h1 className="text-2xl font-bold mb-3">Welcome to AI Invest Pro! 🚀</h1>
          <p className="text-gray-400">Start investing in AI-powered trading now.</p>
          <button onClick={() => router.push("/invest")} className="bg-blue-600 px-6 py-3 rounded-lg mt-4">
            Start Investing
          </button>
        </div>
      ) : (
        <div className="w-full max-w-lg bg-gray-800 p-6 rounded-lg text-center">
          <h1 className="text-2xl font-bold mb-3 text-red-500">KYC Rejected ❌</h1>
          <button onClick={() => router.push("/kyc")} className="bg-yellow-500 px-6 py-3 rounded-lg mt-4">
            Retry KYC
          </button>
        </div>
      )}
    </div>
  );
}