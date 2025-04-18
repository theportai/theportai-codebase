import { Suspense } from "react";
import VerifyOTPContent from "./VerifyOTPContent";

export default function VerifyOTPPage() {
  return (
    <Suspense fallback={<VerifyOTPLoading />}>
      <VerifyOTPContent />
    </Suspense>
  );
}

function VerifyOTPLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 rounded-xl bg-gray-800 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">Verify Your Account</h1>
        <p className="text-gray-400 text-center mb-6">Loading verification...</p>
        <div className="flex justify-between mb-6">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="w-12 h-14 bg-gray-700 border-2 border-gray-600 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    </div>
  );
}