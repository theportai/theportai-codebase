"use client";

import { useState, useEffect } from "react";
import { FiLock, FiTrendingUp, FiDollarSign, FiChevronDown, FiCheck, FiAlertCircle } from "react-icons/fi";

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
    if (!mounted) return;

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

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-blue-950 text-white font-sans">
      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrollY > 10 ? "bg-gray-900/90 shadow-lg backdrop-blur-md py-3" : "bg-transparent py-6"}`}>
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <span className="text-2xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 bg-clip-text text-transparent">PortAI</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Features</a>
              <a href="#how-it-works" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">How It Works</a>
              <a href="#waitlist" className="px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium transition-all duration-300 shadow-lg hover:shadow-blue-500/30">
                Join Waitlist
              </a>
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
          <div className="md:hidden bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 mt-4">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block px-3 py-2 hover:bg-gray-800 rounded-lg font-medium">Features</a>
              <a href="#how-it-works" className="block px-3 py-2 hover:bg-gray-800 rounded-lg font-medium">How It Works</a>
              <a href="#waitlist" className="block px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg font-medium text-center mt-3">
                Join Waitlist
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 w-full h-full bg-gradient-to-b from-blue-900/20 to-transparent"></div>
          <div className="absolute right-0 top-20 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl opacity-10"></div>
          <div className="absolute left-20 top-40 w-72 h-72 bg-purple-600 rounded-full filter blur-3xl opacity-10"></div>
        </div>

        <div className="container mx-auto px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-16">
            <div className="lg:w-1/2">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-none tracking-tight">
                Invest <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">Smarter.</span> <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-600">Trade Faster.</span> <br />
                Win <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">More.</span>
              </h1>
              <p className="mt-8 text-gray-300 text-lg max-w-xl leading-relaxed">
                Harness the power of AI to revolutionize your trading strategy. Our platform identifies opportunities, executes trades, and optimizes performance—all automatically.
              </p>

              <div className="mt-10 space-y-4">
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 mr-3">
                    <FiCheck className="text-blue-400" size={14} />
                  </div>
                  <span className="text-gray-200">AI-powered market analysis</span>
                </div>
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 mr-3">
                    <FiCheck className="text-indigo-400" size={14} />
                  </div>
                  <span className="text-gray-200">Automated trading strategies</span>
                </div>
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 mr-3">
                    <FiCheck className="text-purple-400" size={14} />
                  </div>
                  <span className="text-gray-200">24/7 portfolio optimization</span>
                </div>
              </div>

              <div className="mt-10">
                <a
                  href="#waitlist"
                  className="px-8 py-4 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-lg transition-all duration-300 shadow-lg hover:shadow-blue-600/30 inline-flex items-center"
                >
                  Join the Waitlist
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                  </svg>
                </a>
              </div>
            </div>

            <div className="lg:w-1/2 w-full">
              {/* Dashboard Preview */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl blur-lg opacity-30 transform rotate-1"></div>
                <div className="relative bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
                  <div className="bg-gray-950 px-4 py-3 flex items-center border-b border-gray-800">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="mx-auto text-sm font-medium text-gray-400">PortAI Dashboard</div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                        <div className="text-gray-400 text-sm mb-1">Portfolio Value</div>
                        <div className="text-2xl font-bold text-white">$27,439.65</div>
                        <div className="text-green-400 text-sm flex items-center mt-1">
                          +5.26% <FiTrendingUp className="ml-1" />
                        </div>
                      </div>
                      <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                        <div className="text-gray-400 text-sm mb-1">Today's P/L</div>
                        <div className="text-2xl font-bold text-white">+$843.21</div>
                        <div className="text-green-400 text-sm flex items-center mt-1">
                          +3.17% <FiTrendingUp className="ml-1" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700 mb-3">
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-sm font-medium text-gray-300">Performance</div>
                        <div className="text-xs text-gray-500">Last 30 Days</div>
                      </div>
                      <div className="h-32 flex items-end space-x-1">
                        {Array(20).fill(0).map((_, i) => (
                          <div
                            key={i}
                            style={{ height: `${Math.random() * 80 + 20}%` }}
                            className={`w-full ${Math.random() > 0.5 ? 'bg-green-500' : 'bg-red-500'} rounded-sm opacity-80`}
                          ></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="animate-bounce flex items-center flex-col">
            <span className="text-sm text-gray-400 mb-2">Scroll to explore</span>
            <FiChevronDown className="text-gray-400 text-xl" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-900/30 backdrop-blur">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why Choose PortAI</h2>
            <p className="text-gray-400 max-w-xl mx-auto">Our AI-powered platform gives you the edge in today's competitive markets</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-400 opacity-0 group-hover:opacity-100 rounded-xl blur-md transition-opacity duration-300"></div>
              <div className="relative p-8 bg-gray-900/80 backdrop-blur rounded-xl border border-gray-800 h-full transform transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-blue-500/50">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500/20 text-blue-400 mb-6">
                  <FiLock size={24} />
                </div>
                <h3 className="text-xl font-semibold mb-3">Secure & Reliable</h3>
                <p className="text-gray-400 leading-relaxed">Bank-level security with military-grade encryption protecting your assets and data at all times.</p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-400 opacity-0 group-hover:opacity-100 rounded-xl blur-md transition-opacity duration-300"></div>
              <div className="relative p-8 bg-gray-900/80 backdrop-blur rounded-xl border border-gray-800 h-full transform transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-indigo-500/50">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-500/20 text-indigo-400 mb-6">
                  <FiTrendingUp size={24} />
                </div>
                <h3 className="text-xl font-semibold mb-3">AI-Powered Analysis</h3>
                <p className="text-gray-400 leading-relaxed">Advanced algorithms that analyze markets 24/7 to identify the most profitable opportunities.</p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-purple-400 opacity-0 group-hover:opacity-100 rounded-xl blur-md transition-opacity duration-300"></div>
              <div className="relative p-8 bg-gray-900/80 backdrop-blur rounded-xl border border-gray-800 h-full transform transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-purple-500/50">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-purple-500/20 text-purple-400 mb-6">
                  <FiDollarSign size={24} />
                </div>
                <h3 className="text-xl font-semibold mb-3">Proven Results</h3>
                <p className="text-gray-400 leading-relaxed">Our strategies have delivered 87% average annual returns for our early beta testers.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-gray-950">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-400 max-w-lg mx-auto">Simple. Efficient. Powerful.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-20"></div>
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-center text-xl font-bold mb-6 shadow-lg">1</div>
              </div>
              <div className="h-24 w-px bg-gradient-to-b from-blue-500 to-transparent absolute"></div>
              <h3 className="text-xl font-semibold mb-3">Sign Up</h3>
              <p className="text-gray-400 max-w-xs mx-auto">Join our waitlist to be among the first to experience PortAI</p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 rounded-full blur-md opacity-20"></div>
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 flex items-center justify-center text-xl font-bold mb-6 shadow-lg">2</div>
              </div>
              <h3 className="text-xl font-semibold mb-3">Connect</h3>
              <p className="text-gray-400 max-w-xs mx-auto">Link your exchange account when we launch for seamless integration</p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500 rounded-full blur-md opacity-20"></div>
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-purple-400 flex items-center justify-center text-xl font-bold mb-6 shadow-lg">3</div>
              </div>
              <h3 className="text-xl font-semibold mb-3">Profit</h3>
              <p className="text-gray-400 max-w-xs mx-auto">Let our AI do the work while you enjoy the returns</p>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist Section */}
      <section id="waitlist" className="py-20 bg-gray-900/30">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl blur-lg opacity-30"></div>
              <div className="relative bg-gray-900/90 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-800 overflow-hidden p-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold mb-4">Join the Waitlist</h2>
                  <p className="text-gray-400">Be among the first to experience the future of AI-powered trading</p>
                </div>

                {formStatus.isSuccess ? (
                  <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-6 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 text-green-400 mb-4">
                      <FiCheck size={24} />
                    </div>
                    <p className="text-green-400 font-medium text-lg mb-2">{formStatus.message}</p>
                    <p className="text-gray-300">We'll notify you when PortAI is ready to launch.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {formStatus.isError && (
                      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
                        <div className="flex items-center">
                          <FiAlertCircle className="text-red-400 mr-2 flex-shrink-0" />
                          <p className="text-red-400">{formStatus.message}</p>
                        </div>
                      </div>
                    )}

                    <div>
                      <label htmlFor="name" className="block text-gray-300 mb-2 font-medium">Full Name</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="John Doe"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-gray-300 mb-2 font-medium">Email Address</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="you@example.com"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-gray-300 mb-2 font-medium">Phone Number</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+1 (555) 123-4567"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={formStatus.isSubmitting}
                      className={`w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-4 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-blue-600/30 ${formStatus.isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {formStatus.isSubmitting ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting...
                        </span>
                      ) : 'Join the Waitlist'}
                    </button>

                    <p className="text-gray-500 text-sm text-center">
                      By joining, you agree to receive updates about PortAI. We respect your privacy and will never share your information.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gray-950">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Built for Serious Traders</h2>
            <p className="text-gray-400 max-w-lg mx-auto">Join thousands of professional traders who are already on our waitlist</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-xl border border-gray-800 shadow-xl hover:shadow-blue-900/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center mb-6">
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold text-xl">JD</div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold">John D.</h4>
                  <p className="text-gray-400 text-sm">Hedge Fund Manager</p>
                </div>
              </div>
              <p className="text-gray-300 leading-relaxed">"Can't wait to integrate this AI-powered tool into our trading stack. The demo looks promising."</p>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-xl border border-gray-800 shadow-xl hover:shadow-indigo-900/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center mb-6">
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-bold text-xl">AT</div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold">Alice T.</h4>
                  <p className="text-gray-400 text-sm">Day Trader</p>
                </div>
              </div>
              <p className="text-gray-300 leading-relaxed">"The automated analysis feature could be a game-changer for identifying opportunities faster than the competition."</p>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-xl border border-gray-800 shadow-xl hover:shadow-purple-900/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center mb-6">
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-purple-600 to-purple-400 flex items-center justify-center text-white font-bold text-xl">MR</div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold">Michael R.</h4>
                  <p className="text-gray-400 text-sm">Institutional Investor</p>
                </div>
              </div>
              <p className="text-gray-300 leading-relaxed">"Looking forward to seeing how PortAI's machine learning models can adapt to volatile market conditions."</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-950 border-t border-gray-800">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center mb-6 md:mb-0">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">PortAI</span>
            </div>
            <div className="text-gray-400 text-sm text-center md:text-left">
              <p>&copy; 2023 PortAI. All rights reserved.</p>
              <p>Follow us on social media:</p>
              <div className="flex space-x-4 justify-center md:justify-start mt-2">
                <a href="#" className="text-gray-300 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.676 0H1.324C.593 0 0 .593 0 1.324v21.352C0 23.407.593 24 1.324 24H12.82v-9.21H9.692v-3.69H6.73v3.69h-2.96V10.73h2.896v-3.18a.71.71 0 01.684-.537 29.75 29.75 0 00-1.18-.084v-1.92h2.89v1.3c.058.347.22.682.465.988v-.002a.71.71 0 01.465-.988h2.89v3.69h-2.85c-.246 0-.412.033-.537.06a.71.71 0 01-.684-.538V7.308h3.92l-.467 3.69h-3.453V24h6.116c.73 0 1.323-.593 1.323-1.324V1.324C24 .593 23.407 0 22.676 0z"></path>
                  </svg>
                </a>
                <a href="#" className="text-gray-300 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 4.557a9.83 9.83 0 01-2.828.775 4.932 4.932 0 002.165-2.724 9.859 9.859 0 01-3.127 1.195A4.916 4.916 0 0017.579 6c1.271 0 2.458.409 3.379 1.183a4.688 4.688 0 01-1.482 3.55 4.91 4.91 0 00-.084.084 1.312 1.312 0 01-1.815-1.084 4 4 0 113.461-3.111 1.312 1.312 0 11-1.089 1.787 4.109 4.109 0 01-3.278-1.855v.085a4.898 4.898 0 003.169 4.566 4.902 4.902 0 01-2.229-.072 4.9 4.9 0 004.668 3.906 11.553 11.553 0 01-6.122 1.901 4.898 4.898 0 007.454 4.514A15.3 15.3 0 01.469 19.443a13.49 13.49 0 007.548 2.212c9.178 0 14.58-7.268 14.58-14.596v-.545a4.238 4.238 0 001.262-3.11z"></path>
                  </svg>
                </a>
                <a href="#" className="text-gray-300 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.163 7.577a6.206 6.206 0 00-5.22-3.962 6.249 6.249 0 00-6.21 6.21 6.249 6.249 0 00-3.962 5.22A6.206 6.206 0 003.837 16.423a6.249 6.249 0 006.21 6.21 6.249 6.249 0 005.22-3.962 6.206 6.206 0 003.962-5.22 6.249 6.249 0 00-3.962-5.22 6.206 6.206 0 00-5.22-3.962 6.249 6.249 0 00-6.21 6.21 6.249 6.249 0 00-3.962 5.22A6.206 6.206 0 003.837 16.423a6.249 6.249 0 006.21 6.21 6.249 6.249 0 005.22-3.962 6.206 6.206 0 003.962-5.22 6.249 6.249 0 00-3.962-5.22 6.206 6.206 0 00-5.22-3.962 6.249 6.249 0 00-6.21 6.21 6.249 6.249 0 00-3.962 5.22A6.206 6.206 0 003.837 16.423a6.249 6.249 0 006.21 6.21 6.249 6.249 0 005.22-3.962 6.206 6.206 0 003.962-5.22z"></path>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
