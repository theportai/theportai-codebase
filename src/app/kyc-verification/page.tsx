"use client";

import { ChangeEvent, useState } from "react";

export default function KYCVerification() {
  const [fullName, setFullName] = useState("");
  const [panCard, setPanCard] = useState("");
  const [aadhaarCard, setAadhaarCard] = useState("");
  const [, setFiles] = useState({ pan: null, aadhaar: null });
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
      setFiles((prev) => ({ ...prev, [type]: file }));
    }
  };

  const handleSubmit = async () => {
    alert("KYC Submitted! Processing takes up to 24 hours.");
    // Add API integration logic here
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center">KYC Verification</h2>
        
        <div className="mb-4">
          <label className="block text-sm mb-1">Full Name</label>
          <input 
            type="text" 
            className="w-full p-2 bg-gray-700 rounded" 
            value={fullName} 
            onChange={(e) => setFullName(e.target.value)} 
            placeholder="Enter your full name"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm mb-1">PAN Card</label>
          <input 
            type="text" 
            className="w-full p-2 bg-gray-700 rounded" 
            value={panCard} 
            onChange={(e) => setPanCard(e.target.value)} 
            placeholder="Enter PAN Card Number"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm mb-1">Aadhaar Card</label>
          <input 
            type="text" 
            className="w-full p-2 bg-gray-700 rounded" 
            value={aadhaarCard} 
            onChange={(e) => setAadhaarCard(e.target.value)} 
            placeholder="Enter Aadhaar Number"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm mb-1">Upload PAN Card</label>
          <input type="file" className="w-full p-2 bg-gray-700 rounded" onChange={(e) => handleFileUpload(e, "pan")} />
        </div>

        <div className="mb-4">
          <label className="block text-sm mb-1">Upload Aadhaar Card</label>
          <input type="file" className="w-full p-2 bg-gray-700 rounded" onChange={(e) => handleFileUpload(e, "aadhaar")} />
        </div>

        <button 
          className="w-full bg-blue-500 p-2 rounded text-white font-semibold hover:bg-blue-600" 
          onClick={handleSubmit}
        >
          Submit Verification
        </button>

        <p className="text-center text-sm text-gray-400 mt-3">
          KYC approval takes up to 24 hours.
        </p>
      </div>
    </div>
  );
}