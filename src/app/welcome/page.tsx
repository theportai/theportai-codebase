"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export default function WelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kycStatus = searchParams.get("kyc"); // Check if KYC is in progress
  const [showCard, setShowCard] = useState(false);
  const [showStars, setShowStars] = useState(false);

  useEffect(() => {
    // Staggered animations
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

      {/* Animated gradient circle */}
      <motion.div
        className="absolute w-96 h-96 rounded-full bg-gradient-to-r from-blue-600/30 to-purple-600/30 blur-3xl"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 0.6, scale: 1 }}
        transition={{ duration: 1.5 }}
      />

      {/* Main content */}
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
            {/* Header with icon animation */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex justify-center mb-6"
            >
              <motion.div
                className="flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4"
                whileHover={{ scale: 1.05, rotate: 5 }}
              >
                <motion.span
                  className="text-2xl"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  🚀
                </motion.span>
              </motion.div>
            </motion.div>

            <motion.h1
              className="text-3xl font-bold mb-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {kycStatus === "progress"
                ? "KYC in Progress 🎉"
                : "Welcome to AI Invest Pro!"}
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <p className="text-gray-300 mb-6">
                {kycStatus === "progress"
                  ? "Your KYC is being reviewed. This process usually takes up to 24 hours. We'll notify you once it's done!"
                  : "Your account has been successfully created. Complete your KYC to start investing and unlock your financial potential."}
              </p>
            </motion.div>

            {/* Features section */}
            <motion.div
              className="grid grid-cols-2 gap-4 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              {[
                { icon: "📊", title: "Smart Analytics", desc: "AI-powered insights" },
                { icon: "🔒", title: "Secure Platform", desc: "Bank-grade security" },
                { icon: "💰", title: "High Returns", desc: "Beat the market" },
                { icon: "⚡", title: "Instant Trades", desc: "Zero waiting time" },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  className="bg-gray-700/50 p-3 rounded-lg text-left"
                  whileHover={{ scale: 1.03, backgroundColor: "rgba(59, 130, 246, 0.2)" }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center">
                    <span className="text-xl mr-2">{feature.icon}</span>
                    <div>
                      <h3 className="font-medium text-sm">{feature.title}</h3>
                      <p className="text-gray-400 text-xs">{feature.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Action button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.5 }}
            >
              <motion.button
                className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                  kycStatus === "progress"
                    ? "bg-gray-600 cursor-not-allowed opacity-50"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
                onClick={() => router.push("/kyc")}
                disabled={kycStatus === "progress"}
                whileHover={{
                  scale: kycStatus === "progress" ? 1 : 1.05,
                  boxShadow: kycStatus === "progress" ? "none" : "0 0 15px rgba(59, 130, 246, 0.5)",
                }}
                whileTap={{ scale: 0.95 }}
              >
                {kycStatus === "progress" ? "KYC in Progress..." : "Complete KYC"}
              </motion.button>
              {kycStatus === "progress" && (
                <motion.p className="text-gray-400 text-sm mt-4">
                  Please check back in a few hours
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}