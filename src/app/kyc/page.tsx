"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Loader2, Check, X, Upload, AlertTriangle } from "lucide-react";

// Define validation regex patterns
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_REGEX = /^[2-9]{1}[0-9]{11}$/;

export default function KYCPage() {
  const router = useRouter();

  // Form state
  const [fullName, setFullName] = useState("");
  const [pan, setPan] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [panFile, setPanFile] = useState<File | null>(null);
  const [panFileName, setPanFileName] = useState("Choose a file");
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [aadhaarFileName, setAadhaarFileName] = useState("Choose a file");
  const [isAgreed, setIsAgreed] = useState(false);

  // UI state
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);

  // Validation state
  const [errors, setErrors] = useState<{
    fullName?: string;
    pan?: string;
    aadhaar?: string;
    panFile?: string;
    aadhaarFile?: string;
    submission?: string;
  }>({});

  useEffect(() => {
    // Check if user is already logged in
    const phone = localStorage.getItem("userPhone");
    if (!phone) {
      // Redirect to login if no phone number found
      router.replace("/login?redirect=kyc");
      return;
    }

    // Trigger entrance animation
    setTimeout(() => {
      setShowAnimation(true);
    }, 100);
  }, [router]);

  const formSteps = [
    { label: "Personal Details", icon: "👤" },
    { label: "Identity Verification", icon: "🆔" },
    { label: "Document Upload", icon: "📄" },
    { label: "Review & Submit", icon: "✅" }
  ];

  // Validate form fields
  const validateFullName = () => {
    if (!fullName.trim()) {
      setErrors(prev => ({ ...prev, fullName: "Full name is required" }));
      return false;
    }
    if (fullName.trim().length < 3) {
      setErrors(prev => ({ ...prev, fullName: "Name must be at least 3 characters" }));
      return false;
    }
    setErrors(prev => ({ ...prev, fullName: undefined }));
    return true;
  };

  const validatePan = () => {
    if (!pan) {
      setErrors(prev => ({ ...prev, pan: "PAN is required" }));
      return false;
    }
    if (!PAN_REGEX.test(pan)) {
      setErrors(prev => ({ ...prev, pan: "Invalid PAN format" }));
      return false;
    }
    setErrors(prev => ({ ...prev, pan: undefined }));
    return true;
  };

  const validateAadhaar = () => {
    if (!aadhaar) {
      setErrors(prev => ({ ...prev, aadhaar: "Aadhaar is required" }));
      return false;
    }
    if (!AADHAAR_REGEX.test(aadhaar)) {
      setErrors(prev => ({ ...prev, aadhaar: "Invalid Aadhaar format" }));
      return false;
    }
    setErrors(prev => ({ ...prev, aadhaar: undefined }));
    return true;
  };

  const validatePanFile = () => {
    if (!panFile) {
      setErrors(prev => ({ ...prev, panFile: "PAN card image is required" }));
      return false;
    }

    // Check file size (max 5MB)
    if (panFile.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, panFile: "File size should be less than 5MB" }));
      return false;
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(panFile.type)) {
      setErrors(prev => ({ ...prev, panFile: "Only JPG, PNG and PDF files are allowed" }));
      return false;
    }

    setErrors(prev => ({ ...prev, panFile: undefined }));
    return true;
  };

  const validateAadhaarFile = () => {
    if (!aadhaarFile) {
      setErrors(prev => ({ ...prev, aadhaarFile: "Aadhaar card image is required" }));
      return false;
    }

    // Check file size (max 5MB)
    if (aadhaarFile.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, aadhaarFile: "File size should be less than 5MB" }));
      return false;
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(aadhaarFile.type)) {
      setErrors(prev => ({ ...prev, aadhaarFile: "Only JPG, PNG and PDF files are allowed" }));
      return false;
    }

    setErrors(prev => ({ ...prev, aadhaarFile: undefined }));
    return true;
  };

  const handlePanFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const uploadedFile = e.target.files[0];
      setPanFile(uploadedFile);
      setPanFileName(uploadedFile.name);

      // Validate file immediately after selection
      validatePanFile();
    }
  };

  const handleAadhaarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const uploadedFile = e.target.files[0];
      setAadhaarFile(uploadedFile);
      setAadhaarFileName(uploadedFile.name);

      // Validate file immediately after selection
      validateAadhaarFile();
    }
  };

  const nextStep = () => {
    // Validate current step before proceeding
    let isValid = false;

    if (currentStep === 0) {
      isValid = validateFullName();
    } else if (currentStep === 1) {
      isValid = validatePan() && validateAadhaar();
    } else if (currentStep === 2) {
      isValid = validatePanFile() && validateAadhaarFile();
    }

    if (isValid && currentStep < formSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      // Scroll to top of form when changing steps
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      // Scroll to top of form when changing steps
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Final validation before submission
    const isNameValid = validateFullName();
    const isPanValid = validatePan();
    const isAadhaarValid = validateAadhaar();
    const isPanFileValid = validatePanFile();
    const isAadhaarFileValid = validateAadhaarFile();

    if (!isNameValid || !isPanValid || !isAadhaarValid || !isPanFileValid || !isAadhaarFileValid || !isAgreed) {
      setErrors(prev => ({
        ...prev,
        submission: "Please complete all required fields and agree to the terms"
      }));
      return;
    }

    setIsSubmitting(true);
    setErrors(prev => ({ ...prev, submission: undefined }));

    try {
      const phone = localStorage.getItem("userPhone");
      if (!phone) {
        setErrors(prev => ({ ...prev, submission: "User authentication error. Please login again." }));
        setIsSubmitting(false);
        setTimeout(() => router.replace("/login"), 2000);
        return;
      }

      const formData = new FormData();
      formData.append("phone", phone);
      formData.append("fullName", fullName);
      formData.append("pan", pan);
      formData.append("aadhaar", aadhaar);
      if (panFile) formData.append("panDocument", panFile);
      if (aadhaarFile) formData.append("aadhaarDocument", aadhaarFile);

      const response = await fetch("/api/kyc", {
        method: "POST",
        body: formData,
        // No need to set Content-Type when using FormData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to submit KYC");
      }

      console.log("✅ KYC Submitted Successfully!");

      // Show success message for a moment before redirecting
      setTimeout(async () => {
        try {
          const statusResponse = await fetch(`/api/user-status?phone=${encodeURIComponent(phone)}`);
          if (!statusResponse.ok) {
            throw new Error("Failed to verify submission status");
          }

          const statusData = await statusResponse.json();
          if (statusData.kycStatus) {
            console.log("📥 Latest KYC Status:", statusData.kycStatus);
            router.replace("/dashboard");
          } else {
            // Fallback redirect if status not returned properly
            router.replace("/welcome?kyc=pending");
          }
        } catch (statusError) {
          console.error("Error checking status:", statusError);
          // Still redirect to dashboard as KYC is submitted
          router.replace("/dashboard");
        }
      }, 1500);

    } catch (error) {
      console.error("❌ KYC Submission Error:", error);
      setErrors(prev => ({
        ...prev,
        submission: error instanceof Error ? error.message : "Submission failed. Please try again."
      }));
      setIsSubmitting(false);
    }
  };

  // Format PAN to uppercase automatically
  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setPan(value);
  };

  // Format Aadhaar with spaces for readability but store without spaces
  const handleAadhaarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove non-digits
    const value = e.target.value.replace(/\D/g, '');
    setAadhaar(value);
  };

  // Display formatted Aadhaar for UI with spaces
  const displayAadhaar = () => {
    if (!aadhaar) return '';
    const parts = [];
    for (let i = 0; i < aadhaar.length; i += 4) {
      parts.push(aadhaar.slice(i, i + 4));
    }
    return parts.join(' ');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white px-4 py-8">
      {/* Main container with animations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: showAnimation ? 1 : 0, y: showAnimation ? 0 : 20 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Header with title and description */}
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
            Complete verification to unlock all features
          </motion.p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8 relative">
          {/* Progress bar connecting the steps */}
          <div
            className="absolute top-5 left-0 h-0.5 bg-gray-700"
            style={{ width: '100%', zIndex: 0 }}
          />
          <div
            className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"
            style={{
              width: `${(currentStep / (formSteps.length - 1)) * 100}%`,
              zIndex: 1,
              transition: 'width 0.5s ease-in-out'
            }}
          />

          {/* Step indicators */}
          {formSteps.map((step, index) => (
            <motion.div
              key={index}
              className="flex flex-col items-center relative z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: showAnimation ? 1 : 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mb-2 transition-all duration-300 ${index < currentStep
                  ? "bg-gradient-to-r from-green-500 to-green-600"
                  : index === currentStep
                    ? "bg-gradient-to-r from-blue-500 to-purple-500 ring-4 ring-blue-500/20"
                    : "bg-gray-700"
                  }`}
                role="button"
                tabIndex={0}
                aria-label={`Step ${index + 1}: ${step.label}`}
                aria-current={index === currentStep ? "step" : undefined}
              >
                {index < currentStep ? (
                  <Check size={16} className="text-white" />
                ) : (
                  step.icon
                )}
              </div>
              <div className={`text-xs ${index === currentStep ? "text-blue-400 font-medium" : "text-gray-400"
                }`}>
                {step.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Form Container */}
        <motion.div
          className="bg-gray-800/70 backdrop-blur-lg p-6 rounded-xl border border-gray-700 shadow-xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: showAnimation ? 1 : 0, scale: showAnimation ? 1 : 0.95 }}
          transition={{ delay: 0.4 }}
        >
          <form onSubmit={(e) => e.preventDefault()}>
            <AnimatePresence mode="wait">
              {/* Step 1: Personal Details */}
              {currentStep === 0 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-xl font-medium mb-4 text-blue-400">Personal Details</h2>
                  <div className="mb-4">
                    <label htmlFor="fullName" className="block text-sm font-medium mb-2 text-gray-300">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        onBlur={validateFullName}
                        className={`w-full px-4 py-3 pl-10 bg-gray-700/50 border ${errors.fullName ? "border-red-500" : "border-gray-600"
                          } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                        placeholder="Enter your legal full name"
                        aria-required="true"
                        aria-invalid={errors.fullName ? "true" : "false"}
                        aria-describedby={errors.fullName ? "fullNameError" : undefined}
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-400">👤</span>
                      </div>
                    </div>
                    {errors.fullName && (
                      <p id="fullNameError" className="mt-1 text-sm text-red-500">
                        {errors.fullName}
                      </p>
                    )}
                  </div>
                  <div className="mt-6">
                    <button
                      onClick={nextStep}
                      type="button"
                      disabled={!fullName}
                      className={`w-full py-3 rounded-lg transition-all ${fullName
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                        : "bg-gray-700 cursor-not-allowed opacity-50"
                        }`}
                      aria-label="Continue to Identity Verification"
                    >
                      Continue
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Identity Verification */}
              {currentStep === 1 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-xl font-medium mb-4 text-blue-400">Identity Verification</h2>
                  <div className="mb-4">
                    <label htmlFor="pan" className="block text-sm font-medium mb-2 text-gray-300">
                      PAN Card <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="pan"
                        type="text"
                        value={pan}
                        onChange={handlePanChange}
                        onBlur={validatePan}
                        className={`w-full px-4 py-3 pl-10 bg-gray-700/50 border ${errors.pan ? "border-red-500" : "border-gray-600"
                          } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all uppercase`}
                        placeholder="e.g. ABCDE1234F"
                        maxLength={10}
                        aria-required="true"
                        aria-invalid={errors.pan ? "true" : "false"}
                        aria-describedby={errors.pan ? "panError" : "panHint"}
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-400">🆔</span>
                      </div>
                    </div>
                    {errors.pan ? (
                      <p id="panError" className="mt-1 text-sm text-red-500">
                        {errors.pan}
                      </p>
                    ) : (
                      <p id="panHint" className="mt-1 text-xs text-gray-400">
                        Format: 5 letters, 4 numbers, 1 letter (e.g. ABCDE1234F)
                      </p>
                    )}
                  </div>
                  <div className="mb-4">
                    <label htmlFor="aadhaar" className="block text-sm font-medium mb-2 text-gray-300">
                      Aadhaar Card <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="aadhaar"
                        type="text"
                        value={displayAadhaar()}
                        onChange={handleAadhaarChange}
                        onBlur={validateAadhaar}
                        className={`w-full px-4 py-3 pl-10 bg-gray-700/50 border ${errors.aadhaar ? "border-red-500" : "border-gray-600"
                          } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                        placeholder="e.g. 9999 8888 7777"
                        maxLength={14}
                        aria-required="true"
                        aria-invalid={errors.aadhaar ? "true" : "false"}
                        aria-describedby={errors.aadhaar ? "aadhaarError" : "aadhaarHint"}
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-400">🔢</span>
                      </div>
                    </div>
                    {errors.aadhaar ? (
                      <p id="aadhaarError" className="mt-1 text-sm text-red-500">
                        {errors.aadhaar}
                      </p>
                    ) : (
                      <p id="aadhaarHint" className="mt-1 text-xs text-gray-400">
                        12-digit Aadhaar number without spaces
                      </p>
                    )}
                  </div>
                  <div className="flex justify-between mt-6">
                    <button
                      onClick={prevStep}
                      type="button"
                      className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-gray-500"
                      aria-label="Back to Personal Details"
                    >
                      Back
                    </button>
                    <button
                      onClick={nextStep}
                      type="button"
                      disabled={!pan || !aadhaar || Boolean(errors.pan) || Boolean(errors.aadhaar)}
                      className={`px-6 py-2 rounded-lg transition-all ${pan && aadhaar && !errors.pan && !errors.aadhaar
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                        : "bg-gray-700 cursor-not-allowed opacity-50"
                        }`}
                      aria-label="Continue to Document Upload"
                    >
                      Continue
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Document Upload */}
              {currentStep === 2 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-xl font-medium mb-4 text-blue-400">Document Upload</h2>

                  {/* PAN Card Upload */}
                  <div className="mb-6">
                    <label htmlFor="pan-file-upload" className="block text-sm font-medium mb-2 text-gray-300">
                      Upload PAN Card Front <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        onChange={handlePanFileUpload}
                        className="hidden"
                        id="pan-file-upload"
                        accept=".jpg,.jpeg,.png,.pdf"
                        aria-required="true"
                        aria-invalid={errors.panFile ? "true" : "false"}
                        aria-describedby={errors.panFile ? "panFileError" : "panFileHint"}
                      />
                      <label
                        htmlFor="pan-file-upload"
                        className={`w-full flex items-center justify-center px-4 py-4 bg-gray-700/50 border-2 border-dashed ${errors.panFile ? "border-red-500" : "border-gray-600"
                          } rounded-lg hover:bg-gray-700 transition-all cursor-pointer`}
                      >
                        <div className="text-center">
                          <div className="mb-2 flex justify-center">
                            {panFile ? (
                              <Check size={24} className="text-green-400" />
                            ) : (
                              <Upload size={24} className="text-gray-400" />
                            )}
                          </div>
                          <p className="text-sm text-gray-400">
                            {panFile ? panFileName : "Upload PAN Card Front Image"}
                          </p>
                        </div>
                      </label>
                    </div>
                    {errors.panFile ? (
                      <p id="panFileError" className="mt-1 text-sm text-red-500">
                        {errors.panFile}
                      </p>
                    ) : (
                      <p id="panFileHint" className="mt-1 text-xs text-gray-400">
                        Please upload a clear photo of your PAN card front
                      </p>
                    )}
                  </div>

                  {/* Aadhaar Card Upload */}
                  <div className="mb-4">
                    <label htmlFor="aadhaar-file-upload" className="block text-sm font-medium mb-2 text-gray-300">
                      Upload Aadhaar Card Front <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        onChange={handleAadhaarFileUpload}
                        className="hidden"
                        id="aadhaar-file-upload"
                        accept=".jpg,.jpeg,.png,.pdf"
                        aria-required="true"
                        aria-invalid={errors.aadhaarFile ? "true" : "false"}
                        aria-describedby={errors.aadhaarFile ? "aadhaarFileError" : "aadhaarFileHint"}
                      />
                      <label
                        htmlFor="aadhaar-file-upload"
                        className={`w-full flex items-center justify-center px-4 py-4 bg-gray-700/50 border-2 border-dashed ${errors.aadhaarFile ? "border-red-500" : "border-gray-600"
                          } rounded-lg hover:bg-gray-700 transition-all cursor-pointer`}
                      >
                        <div className="text-center">
                          <div className="mb-2 flex justify-center">
                            {aadhaarFile ? (
                              <Check size={24} className="text-green-400" />
                            ) : (
                              <Upload size={24} className="text-gray-400" />
                            )}
                          </div>
                          <p className="text-sm text-gray-400">
                            {aadhaarFile ? aadhaarFileName : "Upload Aadhaar Card Front Image"}
                          </p>
                        </div>
                      </label>
                    </div>
                    {errors.aadhaarFile ? (
                      <p id="aadhaarFileError" className="mt-1 text-sm text-red-500">
                        {errors.aadhaarFile}
                      </p>
                    ) : (
                      <p id="aadhaarFileHint" className="mt-1 text-xs text-gray-400">
                        Please upload a clear photo of your Aadhaar card front
                      </p>
                    )}
                  </div>

                  <div className="p-3 mt-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                    <p className="text-xs text-blue-200 flex items-start gap-2">
                      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                      Files should be in JPG, PNG or PDF format and less than 5MB in size.
                    </p>
                  </div>

                  <div className="flex justify-between mt-6">
                    <button
                      onClick={prevStep}
                      type="button"
                      className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-gray-500"
                      aria-label="Back to Identity Verification"
                    >
                      Back
                    </button>
                    <button
                      onClick={nextStep}
                      type="button"
                      disabled={!panFile || !aadhaarFile || Boolean(errors.panFile) || Boolean(errors.aadhaarFile)}
                      className={`px-6 py-2 rounded-lg transition-all ${panFile && aadhaarFile && !errors.panFile && !errors.aadhaarFile
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                        : "bg-gray-700 cursor-not-allowed opacity-50"
                        }`}
                      aria-label="Continue to Review and Submit"
                    >
                      Continue
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Review & Submit */}
              {currentStep === 3 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-xl font-medium mb-4 text-blue-400">Review & Submit</h2>

                  {/* Review Details */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-2 text-gray-300">Personal Details</h3>
                    <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                      <p className="text-gray-300"><strong>Full Name:</strong> {fullName}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-2 text-gray-300">Identity Verification</h3>
                    <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                      <p className="text-gray-300"><strong>PAN Card:</strong> {pan}</p>
                      <p className="text-gray-300"><strong>Aadhaar Card:</strong> {displayAadhaar()}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-2 text-gray-300">Document Upload</h3>
                    <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                      <p className="text-gray-300"><strong>PAN Card File:</strong> {panFileName}</p>
                      <p className="text-gray-300"><strong>Aadhaar Card File:</strong> {aadhaarFileName}</p>
                    </div>
                  </div>

                  {/* Terms and Conditions */}
                  <div className="mb-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={isAgreed}
                        onChange={(e) => setIsAgreed(e.target.checked)}
                        className="form-checkbox h-5 w-5 text-blue-500"
                      />
                      <span className="text-gray-300 text-sm">
                        I agree to the <a href="/terms" className="text-blue-400 underline">terms and conditions</a>.
                      </span>
                    </label>
                  </div>

                  {/* Submission Button */}
                  <div className="mt-6">
                    <button
                      onClick={handleSubmit}
                      type="button"
                      disabled={!isAgreed || isSubmitting}
                      className={`w-full py-3 rounded-lg transition-all ${isAgreed && !isSubmitting
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                        : "bg-gray-700 cursor-not-allowed opacity-50"
                        } flex items-center justify-center`}
                      aria-label="Submit KYC"
                    >
                      {isSubmitting ? (
                        <Loader2 className="animate-spin mr-2" size={20} />
                      ) : (
                        <Check className="mr-2" size={20} />
                      )}
                      Submit
                    </button>
                  </div>

                  {/* Error Message */}
                  {errors.submission && (
                    <p className="mt-4 text-sm text-red-500 text-center">
                      {errors.submission}
                    </p>
                  )}

                  {/* Back Button */}
                  <div className="mt-4">
                    <button
                      onClick={prevStep}
                      type="button"
                      className="w-full py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-gray-500"
                      aria-label="Back to Document Upload"
                    >
                      Back
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
}
