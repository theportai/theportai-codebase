"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function SignupPage() {
  const [phone, setPhone] = useState("");
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [chartData, setChartData] = useState<{ height: number; isPositive: boolean }[]>([]);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();


  useEffect(() => {
    setIsClient(true);
    setChartData(
      Array.from({ length: 30 }, () => ({
        height: Math.floor(Math.random() * 20) + 4, 
        isPositive: Math.random() > 0.5,
      }))
    );
  }, []); 


  const validatePhone = (value: string) => {
    return /^\d{10}$/.test(value);
  };

  const handlePhoneChange = (e: { target: { value: string } }) => {
    const value = e.target.value.replace(/\D/g, "");
    setPhone(value);

    if (value.length > 0) {
      setIsValid(validatePhone(value));
      setErrorMessage(validatePhone(value) ? "" : "Please enter a valid 10-digit phone number");
    } else {
      setIsValid(true);
      setErrorMessage("");
    }
  };

  const handleGetOTP = async () => {
    if (!validatePhone(phone)) {
      setIsValid(false);
      setErrorMessage("Please enter a valid 10-digit phone number");
      return;
    }
  
    try {
      const response = await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, type: "send" }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "An error occurred while sending OTP");
      }
  
      const data = await response.json();
      console.log("✅ OTP Sent Successfully:", data);
  
      localStorage.setItem("userPhone", phone);  
      console.log("📲 Phone saved in localStorage:", localStorage.getItem("userPhone"));
  
      router.push(`/verify-otp?phone=${phone}`);
    } catch (error: unknown) {
      console.error("❌ Error Sending OTP:", error);
  
      let errorMessage = "An error occurred. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
  
      setIsValid(false);
      setErrorMessage(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-700">
        <div className="flex items-center">
          <div className="text-blue-500 font-bold text-2xl">PortAI</div>
        </div>
        <div className="flex items-center space-x-6">
          <a href="#features" className="text-gray-400 hover:text-blue-400">Features</a>
          <a href="#how-it-works" className="text-gray-400 hover:text-blue-400">How It Works</a>
          <a href="#pricing" className="text-gray-400 hover:text-blue-400">Pricing</a>
          <a href="#support" className="text-gray-400 hover:text-blue-400">Support</a>
          <a href="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Sign Up</a>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row min-h-[calc(100vh-74px)]">
        {/* Left Column - Form */}
        <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-8 md:p-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md text-center"
          >
            <h1 className="text-4xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
              Invest Smarter. Trade Faster. Win More.
            </h1>
            <p className="text-gray-400 mb-8">
              Harness the power of AI to revolutionize your trading strategy. Our platform identifies opportunities, executes trades, and optimizes performance—all automatically.
            </p>

            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-medium mb-2">Mobile Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <span className="text-gray-500">+91</span>
                </div>
                <input
                  type="text"
                  placeholder="10-digit mobile number"
                  className={`w-full pl-12 pr-4 py-3 border ${!isValid ? 'border-red-500' : 'border-gray-600'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength={10}
                />
              </div>
              {!isValid && <p className="mt-1 text-sm text-red-500">{errorMessage}</p>}
            </div>

            <button
              className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors font-medium"
              onClick={handleGetOTP}
            >
              Get OTP
            </button>

            <p className="text-xs text-gray-500 mt-4">
              By proceeding, you agree to the terms & privacy policy
            </p>
          </motion.div>
        </div>

        {/* Right Column - Preview */}
        <div className="hidden md:flex w-1/2 bg-gray-800 items-center justify-center p-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="max-w-md"
          >
            <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden border border-gray-700">
              <div className="p-1 bg-gray-800 flex items-center">
                <div className="flex space-x-1.5 pl-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="mx-auto text-white text-xs">Trading Dashboard</div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <div className="text-sm text-gray-400">Portfolio Value</div>
                    <div className="text-xl font-bold text-white">₹27,439.65</div>
                    <div className="text-sm text-green-400">+5.26% ↗</div>
                  </div>
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <div className="text-sm text-gray-400">Todays P/L</div>
                    <div className="text-xl font-bold text-white">+₹843.21</div>
                    <div className="text-sm text-green-400">+3.17% ↗</div>
                  </div>
                </div>

                <div className="bg-gray-700 p-4 rounded-lg mb-4 shadow-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-gray-200 font-medium">Performance (Last 30 Days)</h3>
                    <div className="bg-gray-900 p-2 rounded-xl border border-gray-700"></div>
                    <div className="flex items-end justify-around h-24">
                      {chartData.map((height, i) => (
                        <div key={i} className={`w-1 h-${height} bg-green-500 rounded`}></div>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    {/* Chart */}
                    {isClient && chartData.length > 0 && (
                      <div className="relative">
                        <div className="flex items-end justify-between h-32 px-2 bg-gray-800 rounded-lg py-3">
                          {chartData.map((bar, i) => (
                            <div
                              key={i}
                              className={`w-1 ${bar.isPositive ? "bg-green-500" : "bg-red-500"} rounded transition-all hover:w-2`}
                              style={{ height: `${bar.height * 4}px` }}
                              title={`Day ${i + 1}`}
                            ></div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* X-axis labels */}
                    <div className="flex justify-between mt-1 text-xs text-gray-400 px-2">
                      <span>1</span>
                      <span>15</span>
                      <span>30</span>
                    </div>
                  </div>
                </div>



                <div className="bg-gray-700 p-4 rounded-lg">
                  <div className="text-sm text-gray-400 mb-2">Recent Trades</div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                        <span>AAPL</span>
                      </div>
                      <span className="text-green-400">+₹124.50</span>
                    </div>
                    <div className="flex justify-between">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                        <span>TSLA</span>
                      </div>
                      <span className="text-red-400">-₹73.20</span>
                    </div>
                    <div className="flex justify-between">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                        <span>MSFT</span>
                      </div>
                      <span className="text-green-400">+₹215.75</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
