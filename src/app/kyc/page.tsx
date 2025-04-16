"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function KYCPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [pan, setPan] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("Choose file");
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  //const phone = localStorage.getItem("userPhone") || "";


  const formSteps = [
    { label: "Personal Details", icon: "👤" },
    { label: "Identity Verification", icon: "🆔" },
    { label: "Document Upload", icon: "📄" },
    { label: "Review & Submit", icon: "✅" }
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const uploadedFile = e.target.files[0];
      setFile(uploadedFile);
      setFileName(uploadedFile.name);
    }
  };

  const nextStep = () => {
    if (currentStep < formSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };



  
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const phone = localStorage.getItem("userPhone");
      if (!phone) {
        alert("❌ Error: Phone number is missing!");
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData();
      formData.append("phone", phone);
      formData.append("fullName", fullName);
      formData.append("pan", pan);
      formData.append("aadhaar", aadhaar);
      if (file) formData.append("document", file);

      const response = await fetch("/api/kyc", { method: "POST", body: formData });

      if (!response.ok) {
        throw new Error("Failed to submit KYC");
      }



      console.log("✅ KYC Submitted Successfully!");

      // 🔍 **Ensure API is updated before redirecting**
      setTimeout(async () => {
        const statusResponse = await fetch(`/api/user-status?phone=${phone}`);
        const statusData = await statusResponse.json();

        if (statusResponse.ok && statusData.kycStatus) {
          console.log("📥 Latest KYC Status:", statusData.kycStatus);

          if (statusData.kycStatus === "APPROVED") {
            router.replace("/dashboard");
          } else {

              router.replace("/dashboard");
          }
        }
      }, 500); // Small delay to allow backend update


    } catch (error) {
      console.error("❌ KYC Submission Error:", error);
      alert("❌ Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };




  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md px-4"
      >
        <div className="text-center mb-8">
          <motion.h1
            className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-blue-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            KYC Verification
          </motion.h1>
          <motion.p
            className="text-gray-400 mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Complete verification to unlock all features
          </motion.p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8">
          {formSteps.map((step, index) => (
            <motion.div
              key={index}
              className="flex flex-col items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 + index * 0.1 }}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mb-2 ${index <= currentStep
                  ? "bg-gradient-to-r from-blue-500 to-purple-500"
                  : "bg-gray-700"
                  }`}
              >
                {index < currentStep ? "✓" : step.icon}
              </div>
              <div className="text-xs text-gray-400">
                {step.label}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="bg-gray-800/70 backdrop-blur-lg p-6 rounded-xl border border-gray-700 shadow-xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          {/* Step 1: Personal Details */}
          {currentStep === 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-medium mb-4 text-blue-400">Personal Details</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Enter your full name"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400 hidden sm:block">👤</span>
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <button
                  onClick={nextStep}
                  disabled={!fullName}
                  className={`w-full py-3 rounded-lg transition-all ${fullName
                    ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                    : "bg-gray-700 cursor-not-allowed opacity-50"
                    }`}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Identity Verification */}
          {currentStep === 1 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-medium mb-4 text-blue-400">Identity Verification</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">PAN Card</label>
                <input
                  type="text"
                  value={pan}
                  onChange={(e) => setPan(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Enter PAN number"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">Aadhaar Card</label>
                <input
                  type="text"
                  value={aadhaar}
                  onChange={(e) => setAadhaar(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Enter Aadhaar number"
                />
              </div>
              <div className="flex justify-between mt-6">
                <button
                  onClick={prevStep}
                  className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={nextStep}
                  disabled={!pan || !aadhaar}
                  className={`px-6 py-2 rounded-lg transition-all ${pan && aadhaar
                    ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                    : "bg-gray-700 cursor-not-allowed opacity-50"
                    }`}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Document Upload */}
          {currentStep === 2 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-medium mb-4 text-blue-400">Document Upload</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-300">Upload Document</label>
                <div className="relative">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="w-full flex items-center justify-center px-4 py-6 bg-gray-700/50 border-2 border-dashed border-gray-600 rounded-lg hover:bg-gray-700 transition-all cursor-pointer"
                  >
                    <div className="text-center">
                      <div className="mb-2 flex justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                      </div>
                      <p className="text-sm text-gray-400">
                        {fileName || "Drag and drop your file here or click to browse"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Supported formats: PDF, JPG, PNG (max 5MB)
                      </p>
                    </div>
                  </label>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  Please upload a clear photo of your ID or Proof of Address
                </div>
              </div>
              <div className="flex justify-between mt-6">
                <button
                  onClick={prevStep}
                  className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={nextStep}
                  disabled={!file}
                  className={`px-6 py-2 rounded-lg transition-all ${file
                    ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                    : "bg-gray-700 cursor-not-allowed opacity-50"
                    }`}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Review & Submit */}
          {currentStep === 3 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-medium mb-4 text-blue-400">Review & Submit</h2>
              <div className="bg-gray-700/50 p-4 rounded-lg mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Full Name:</span>
                  <span className="font-medium">{fullName}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">PAN Card:</span>
                  <span className="font-medium">{pan}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Aadhaar Card:</span>
                  <span className="font-medium">{aadhaar}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Document:</span>
                  <span className="font-medium">{fileName}</span>
                </div>
              </div>
              <div className="mb-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="terms"
                    className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="terms" className="ml-2 text-sm text-gray-400">
                    I confirm that all information provided is accurate and belongs to me
                  </label>
                </div>
              </div>
              <div className="flex justify-between mt-6">
                <button
                  onClick={prevStep}
                  className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-all"
                >
                  Back
                </button>


                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !fullName || !pan || !aadhaar || !file}
                  className={`px-6 py-2 rounded-lg transition-all ${isSubmitting || !fullName || !pan || !aadhaar || !file
                    ? "bg-gray-700 cursor-not-allowed opacity-50"
                    : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                    }`}
                >
                  {isSubmitting ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.791l.707-.707z"></path>
                      </svg>
                      Submitting...
                    </div>
                  ) : (
                    "Submit"
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
