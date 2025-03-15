"use client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export default function WelcomePage() {
  const router = useRouter();
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [showStars, setShowStars] = useState(false);

  useEffect(() => {
    async function checkKYCStatus() {
      const phone = localStorage.getItem("userPhone") || "";
      if (!phone) return;

      try {
        const response = await fetch(`/api/user-status?phone=${phone}`, { cache: "no-store" });
        const data = await response.json();

        if (response.ok && data.kycStatus) {
          setKycStatus(data.kycStatus);

          // ✅ Fix: Redirecting Correctly
          if (data.kycStatus === "APPROVED") {
            router.replace("/dashboard"); // Use replace to avoid history back issue
          } else if (data.kycStatus === "PENDING") {
            router.replace("/welcome?kyc=progress");
          }
        }
      } catch (error) {
        console.error("❌ Error fetching KYC status:", error);
      }
    }

    checkKYCStatus();
  }, [router]);

  useEffect(() => {
    setTimeout(() => setShowStars(true), 300);
    setTimeout(() => setShowCard(true), 800);
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white overflow-hidden">
      {/* Animated background elements */}
      {showStars &&
        Array.from({ length: 50 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-white rounded-full"
            initial={{
              opacity: 0,
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              width: Math.random() < 0.2 ? "2px" : "1px",
              height: Math.random() < 0.2 ? "2px" : "1px",
            }}
            animate={{
              opacity: Math.random() * 0.7 + 0.3,
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              repeatType: "reverse",
              delay: Math.random() * 2,
            }}
          />
        ))}

      <motion.div
        className="absolute w-96 h-96 rounded-full bg-gradient-to-r from-blue-600/30 to-purple-600/30 blur-3xl"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 0.6, scale: 1 }}
        transition={{ duration: 1.5 }}
      />

      {/* Main Content */}
      {showCard && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 w-full max-w-lg"
        >
          <motion.div
            className="p-8 rounded-xl bg-gray-800/80 backdrop-blur-md shadow-2xl text-center border border-gray-700"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Handling KYC Status */}
            {kycStatus === "progress" ? (
              <>
                <motion.h1 className="text-3xl font-bold mb-3">KYC in Progress 🎉</motion.h1>
                <motion.p className="text-gray-300 mb-6">
                  Your KYC is being reviewed. This process usually takes up to 24 hours.
                </motion.p>
                <motion.button className="px-8 py-3 rounded-lg font-semibold bg-gray-600 cursor-not-allowed opacity-50" disabled>
                  KYC in Progress...
                </motion.button>
              </>
            ) : (
              <>
                <motion.h1 className="text-3xl font-bold mb-3">Welcome to AI Invest Pro!</motion.h1>
                <motion.p className="text-gray-300 mb-6">
                  Complete your KYC to start investing and unlock your financial potential.
                </motion.p>
                <motion.button
                  className="px-8 py-3 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => router.push("/kyc")}
                >
                  Complete KYC
                </motion.button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}