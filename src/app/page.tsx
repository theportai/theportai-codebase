"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiLock,
  FiTrendingUp,
  FiDollarSign,
  FiChevronDown,
  FiCheck,
  FiAlertCircle
} from "react-icons/fi";

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 }
  }
};

export default function WaitlistPage() {
  const [scrollY, setScrollY] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: ""
  });
  const [formStatus, setFormStatus] = useState({
    isSubmitting: false,
    isSuccess: false,
    isError: false,
    message: ""
  });

  // Track scroll position for navbar effects
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return; // Ensure code runs only after mounting

    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, [mounted]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset any previous form status
    setFormStatus({ 
      isSubmitting: true, 
      isError: false, 
      isSuccess: false, 
      message: "" 
    });

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setFormStatus({
        isSubmitting: false,
        isSuccess: true,
        isError: false,
        message: data.message || "You've been added to the waitlist!"
      });
      
      // Reset form after successful submission
      setFormData({ name: "", email: "", phone: "" });
      
    } catch (error) {
      console.error("Form submission error:", error);
      setFormStatus({
        isSubmitting: false,
        isSuccess: false,
        isError: true,
        message: error.message || "Failed to join waitlist. Please try again."
      });
    }
  };

  if (!mounted) return null; // Prevent SSR issues

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrollY > 10 ? "bg-gray-900/95 shadow-xl backdrop-blur-sm" : "bg-transparent"}`}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">PortAI</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <div className="flex items-center space-x-8">
                <a href="#features" className="hover:text-blue-400 transition-colors text-sm font-medium">Features</a>
                <a href="#how-it-works" className="hover:text-blue-400 transition-colors text-sm font-medium">How It Works</a>
                <a href="#waitlist" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors">
                  Join Waitlist
                </a>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-300 hover:text-white"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-gray-800/95 backdrop-blur-sm">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <a href="#features" className="block px-3 py-2 hover:bg-gray-700 rounded-md">Features</a>
              <a href="#how-it-works" className="block px-3 py-2 hover:bg-gray-700 rounded-md">How It Works</a>
              <a href="#waitlist" className="block px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md mt-2">
                Join Waitlist
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="absolute inset-0 z-0 opacity-30">
          <div className="absolute right-0 top-20 w-96 h-96 bg-blue-500 rounded-full filter blur-3xl opacity-20"></div>
          <div className="absolute left-20 top-40 w-72 h-72 bg-purple-500 rounded-full filter blur-3xl opacity-20"></div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between">
            <motion.div
              className="lg:w-1/2 mb-12 lg:mb-0"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Invest Smarter. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">Trade Faster.</span> <br />
                Win More.
              </h1>
              <p className="mt-6 text-gray-300 text-lg max-w-lg">
                Harness the power of AI to revolutionize your trading strategy. Our platform identifies opportunities, executes trades, and optimizes performance—all automatically.
              </p>

              <div className="mt-8">
                <div className="flex items-center space-x-2 mb-2">
                  <FiCheck className="text-green-500" />
                  <span className="text-gray-300">AI-powered market analysis</span>
                </div>
                <div className="flex items-center space-x-2 mb-2">
                  <FiCheck className="text-green-500" />
                  <span className="text-gray-300">Automated trading strategies</span>
                </div>
                <div className="flex items-center space-x-2">
                  <FiCheck className="text-green-500" />
                  <span className="text-gray-300">24/7 portfolio optimization</span>
                </div>
              </div>

              <div className="mt-8">
                <a 
                  href="#waitlist" 
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg font-bold text-lg inline-block hover:bg-blue-600 transition-colors"
                >
                  Join the Waitlist
                </a>
              </div>
            </motion.div>

            <motion.div
              className="lg:w-1/2"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              {/* Dashboard Preview */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur-lg opacity-30 transform -rotate-2"></div>
                <div className="relative bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
                  <div className="bg-gray-900 px-4 py-3 flex items-center border-b border-gray-800">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="mx-auto text-sm text-gray-400">PortAI Dashboard</div>
                  </div>
                  <div className="p-3">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="text-gray-400 text-sm mb-1">Portfolio Value</div>
                        <div className="text-xl font-bold text-white">$27,439.65</div>
                        <div className="text-green-500 text-sm flex items-center mt-1">
                          +5.26% <FiTrendingUp className="ml-1" />
                        </div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="text-gray-400 text-sm mb-1">Today's P/L</div>
                        <div className="text-xl font-bold text-white">+$843.21</div>
                        <div className="text-green-500 text-sm flex items-center mt-1">
                          +3.17% <FiTrendingUp className="ml-1" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-3">
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-sm font-medium text-gray-400">Performance</div>
                        <div className="text-xs text-gray-500">Last 30 Days</div>
                      </div>
                      <div className="h-24 flex items-end space-x-1">
                        {[...Array(30)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-full ${i % 2 === 0 ? 'h-16' : 'h-8'} ${i % 3 === 0 ? 'bg-green-500' : 'bg-red-500'} rounded-sm`}
                          ></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <FiChevronDown className="text-gray-500 text-2xl" />
          </motion.div>
        </div>
      </section>

      {/* Features Section - Simplified */}
      <section id="features" className="py-20 bg-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why Choose PortAI</h2>
            <p className="text-gray-400 max-w-lg mx-auto">Our AI-powered platform gives you the edge in today's competitive markets</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              className="p-6 bg-gray-900 rounded-lg shadow-lg"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <FiLock className="text-blue-500 text-2xl mb-4" />
              <h3 className="text-xl font-semibold mb-2">Secure & Reliable</h3>
              <p className="text-gray-400">Bank-level security with military-grade encryption protecting your assets and data</p>
            </motion.div>
            <motion.div
              className="p-6 bg-gray-900 rounded-lg shadow-lg"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <FiTrendingUp className="text-blue-500 text-2xl mb-4" />
              <h3 className="text-xl font-semibold mb-2">AI-Powered Analysis</h3>
              <p className="text-gray-400">Advanced algorithms that analyze markets 24/7 to identify the most profitable opportunities</p>
            </motion.div>
            <motion.div
              className="p-6 bg-gray-900 rounded-lg shadow-lg"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <FiDollarSign className="text-blue-500 text-2xl mb-4" />
              <h3 className="text-xl font-semibold mb-2">Proven Results</h3>
              <p className="text-gray-400">Our strategies have delivered 87% average annual returns for our early beta testers</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works - Very Simplified */}
      <section id="how-it-works" className="py-20 bg-gray-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-400 max-w-lg mx-auto">Simple. Efficient. Powerful.</p>
          </div>
          <div className="flex flex-col md:flex-row justify-center items-center space-y-8 md:space-y-0 md:space-x-12">
            <motion.div
              className="flex flex-col items-center"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-2xl font-bold mb-4">1</div>
              <h3 className="text-xl font-semibold mb-2">Sign Up</h3>
              <p className="text-gray-400 text-center max-w-xs">Join our waitlist to be among the first to experience PortAI</p>
            </motion.div>
            <motion.div
              className="flex flex-col items-center"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-2xl font-bold mb-4">2</div>
              <h3 className="text-xl font-semibold mb-2">Connect</h3>
              <p className="text-gray-400 text-center max-w-xs">Link your exchange account when we launch</p>
            </motion.div>
            <motion.div
              className="flex flex-col items-center"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-2xl font-bold mb-4">3</div>
              <h3 className="text-xl font-semibold mb-2">Profit</h3>
              <p className="text-gray-400 text-center max-w-xs">Let our AI do the work while you enjoy the returns</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Waitlist Section */}
      <section id="waitlist" className="py-20 bg-gradient-to-b from-gray-800 to-gray-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <motion.div
              className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden p-8"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4">Join the Waitlist</h2>
                <p className="text-gray-400">Be among the first to experience the future of AI-powered trading</p>
              </div>
              
              {formStatus.isSuccess ? (
                <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 text-center">
                  <FiCheck className="mx-auto text-green-500 text-2xl mb-2" />
                  <p className="text-green-500 font-medium">{formStatus.message}</p>
                  <p className="text-gray-300 mt-2">We'll notify you when PortAI is ready to launch.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  {formStatus.isError && (
                    <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
                      <div className="flex items-center">
                        <FiAlertCircle className="text-red-500 mr-2" />
                        <p className="text-red-500">{formStatus.message}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <label htmlFor="name" className="block text-gray-400 mb-2">Full Name</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="email" className="block text-gray-400 mb-2">Email Address</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  
                  <div className="mb-6">
                    <label htmlFor="phone" className="block text-gray-400 mb-2">Phone Number</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+1 (555) 123-4567"
                      required
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={formStatus.isSubmitting}
                    className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors ${formStatus.isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {formStatus.isSubmitting ? 'Submitting...' : 'Join the Waitlist'}
                  </button>
                  
                  <p className="text-gray-500 text-sm mt-4 text-center">
                    By joining, you agree to receive updates about PortAI. We respect your privacy and will never share your information.
                  </p>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 bg-gray-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Built for Serious Traders</h2>
            <p className="text-gray-400 max-w-lg mx-auto">Join thousands of professional traders who are already on our waitlist</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xl">JD</div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold">John D.</h4>
                  <p className="text-gray-400 text-sm">Hedge Fund Manager</p>
                </div>
              </div>
              <p className="text-gray-300">"Can't wait to integrate this AI-powered tool into our trading stack. The demo looks promising."</p>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-xl">AT</div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold">Alice T.</h4>
                  <p className="text-gray-400 text-sm">Day Trader</p>
                </div>
              </div>
              <p className="text-gray-300">"The automated analysis feature could be a game-changer for identifying opportunities faster than the competition."</p>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xl">MR</div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold">Michael R.</h4>
                  <p className="text-gray-400 text-sm">Institutional Investor</p>
                </div>
              </div>
              <p className="text-gray-300">"Looking forward to seeing how PortAI's machine learning models can adapt to volatile market conditions."</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 border-t border-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="text-gray-400 text-sm">
              © {new Date().getFullYear()} PortAI. All rights reserved.
            </div>
            <div className="mt-4 md:mt-0">
              <a href="#waitlist" className="text-blue-400 hover:text-blue-300 transition-colors">
                Join the Waitlist
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}