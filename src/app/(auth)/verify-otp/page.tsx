"use client";
import { useState, useEffect, useRef, ChangeEvent, KeyboardEvent, ClipboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

export default function VerifyOTP() {
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [resendDisabled, setResendDisabled] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(30);
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "+91 XXXXXXXXXX";
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!searchParams.get("phone")) {
      router.push("/signup");
    }
    if (inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [router, searchParams]);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (resendDisabled && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      setResendDisabled(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [resendDisabled, countdown]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(0, 1);
    }
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    if (value !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && index > 0 && otp[index] === "") {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    
    if (/^\d+$/.test(pastedData)) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length; i++) {
        if (i < 6) {
          newOtp[i] = pastedData[i];
        }
      }
      setOtp(newOtp);
      
      if (pastedData.length < 6) {
        inputRefs.current[pastedData.length]?.focus();
      } else {
        inputRefs.current[5]?.focus();
      }
    }
  };

  const handleResend = () => {
    setResendDisabled(true);
    setCountdown(30);
    setOtp(["", "", "", "", "", ""]);
    inputRefs.current[0]?.focus();
  };

  const handleVerify = () => {
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }
    
    setIsLoading(true);
    setError("");

    setTimeout(() => {
      setIsLoading(false);
      router.push("/welcome"); // ✅ Redirect to KYC page instead of /auth/login
    }, 1500);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 rounded-xl bg-gray-800 shadow-2xl"
      >
        <div className="flex justify-center mb-6">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </motion.div>
        </div>

        <motion.h1 className="text-2xl font-bold text-center mb-2">Verify Your Account</motion.h1>
        <motion.p className="text-gray-400 text-center mb-6">We have sent a 6-digit OTP to <span className="font-semibold text-blue-400">{phone}</span></motion.p>

        <motion.div className="flex justify-between mb-6">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              maxLength={1}
              className="w-12 h-14 text-center text-xl font-bold bg-gray-700 border-2 border-gray-600 rounded-lg focus:border-blue-500 focus:ring-blue-500 focus:outline-none transition-all text-white"
              value={digit}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(index, e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              inputMode="numeric"
            />
          ))}
        </motion.div>

        {error && <motion.p className="text-red-500 text-center mb-4">{error}</motion.p>}

        <motion.button
          className={`w-full py-3 rounded-lg font-bold transition-all ${isLoading ? "bg-gray-600" : "bg-blue-600 hover:bg-blue-700"}`}
          onClick={handleVerify}
          disabled={isLoading}
        >
          {isLoading ? "Verifying..." : "Verify & Continue"}
        </motion.button>

        <motion.div className="mt-6 text-center">
          <p className="text-gray-400">Did not receive the code?</p>
          <div className="mt-2">
            {resendDisabled ? (
              <p className="text-gray-400">Resend in <span className="font-semibold text-blue-400">{countdown}s</span></p>
            ) : (
              <div className="flex justify-center space-x-4">
                <button className="text-blue-400 hover:text-blue-300" onClick={handleResend}>Resend via SMS</button>
                <span className="text-gray-600">|</span>
                <button className="text-blue-400 hover:text-blue-300" onClick={handleResend}>Resend via WhatsApp</button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}