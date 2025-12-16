"use client";

import { useState, useEffect } from "react";
import { FiLock, FiTrendingUp, FiDollarSign, FiChevronDown, FiCheck, FiAlertCircle } from "react-icons/fi";
import { FaBrain } from "react-icons/fa";
import { FiActivity, FiBarChart2, FiShield, FiZap } from "react-icons/fi";
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

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
              <a href="#tech" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Technology</a>
              <a href="#testimonials" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Testimonials</a>
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
              <a href="#tech" className="block px-3 py-2 hover:bg-gray-800 rounded-lg font-medium">Technology</a>
              <a href="#testimonials" className="block px-3 py-2 hover:bg-gray-800 rounded-lg font-medium">Testimonials</a>
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
                Trade <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-600">Faster.</span> <br />
                Win <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Autonomously.</span>
              </h1>
              <p className="mt-8 text-gray-300 text-lg max-w-xl leading-relaxed">
                Meet your AI co-pilot for investing — PortAI analyzes markets, places trades, and optimizes your portfolio 24/7 with zero bias and maximum intelligence.
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
                  <span className="text-gray-200">Automated trade execution</span>
                </div>
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 mr-3">
                    <FiCheck className="text-purple-400" size={14} />
                  </div>
                  <span className="text-gray-200">24/7 portfolio optimization</span>
                </div>
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-pink-500/20 mr-3">
                    <FiCheck className="text-pink-400" size={14} />
                  </div>
                  <span className="text-gray-200">Risk-managed & strategy-tuned</span>
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
                    <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                      <div className="text-sm font-medium text-gray-300 mb-3">AI Recommendations</div>
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <div className="text-xs text-gray-300">Buy AAPL at $176.40 (Confidence: 89%)</div>
                      </div>
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <div className="text-xs text-gray-300">Sell BTC at $58,340 (Confidence: 92%)</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <div className="text-xs text-gray-300">Hold ETH (Monitoring: 24/7)</div>
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
      
      <Analytics/>
      <SpeedInsights/>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-900/30 backdrop-blur">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why Choose PortAI</h2>
            <p className="text-gray-400 max-w-xl mx-auto">Our AI-powered platform gives you the edge in today's competitive markets</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-400 opacity-0 group-hover:opacity-100 rounded-xl blur-md transition-opacity duration-300"></div>
              <div className="relative p-8 bg-gray-900/80 backdrop-blur rounded-xl border border-gray-800 h-full transform transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-blue-500/50">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500/20 text-blue-400 mb-6">
                  <FiLock size={24} />
                </div>
                <h3 className="text-xl font-semibold mb-3">Secure & Reliable</h3>
                <p className="text-gray-400 leading-relaxed">Bank-level encryption + API-only access. Your assets remain with your exchange — we never touch custody.</p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-400 opacity-0 group-hover:opacity-100 rounded-xl blur-md transition-opacity duration-300"></div>
              <div className="relative p-8 bg-gray-900/80 backdrop-blur rounded-xl border border-gray-800 h-full transform transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-indigo-500/50">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-500/20 text-indigo-400 mb-6">
                  <FiTrendingUp size={24} />
                </div>
                <h3 className="text-xl font-semibold mb-3">24/7 AI Intelligence</h3>
                <p className="text-gray-400 leading-relaxed">Our multi-agent AI system monitors markets around the clock to identify profitable entry & exit points.</p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-purple-400 opacity-0 group-hover:opacity-100 rounded-xl blur-md transition-opacity duration-300"></div>
              <div className="relative p-8 bg-gray-900/80 backdrop-blur rounded-xl border border-gray-800 h-full transform transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-purple-500/50">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-purple-500/20 text-purple-400 mb-6">
                  <FiZap size={24} />
                </div>
                <h3 className="text-xl font-semibold mb-3">Autonomous Execution</h3>
                <p className="text-gray-400 leading-relaxed">From signal generation to order placement, PortAI handles everything without human intervention.</p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-pink-400 opacity-0 group-hover:opacity-100 rounded-xl blur-md transition-opacity duration-300"></div>
              <div className="relative p-8 bg-gray-900/80 backdrop-blur rounded-xl border border-gray-800 h-full transform transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-pink-500/50">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-pink-500/20 text-pink-400 mb-6">
                  <FiDollarSign size={24} />
                </div>
                <h3 className="text-xl font-semibold mb-3">Proven Returns</h3>
                <p className="text-gray-400 leading-relaxed">Early users saw an 87%+ annualized return through our live beta. Now it's your turn.</p>
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
              <h3 className="text-xl font-semibold mb-3">Sign Up</h3>
              <p className="text-gray-400 max-w-xs mx-auto">Join our waitlist to access early user benefits and priority access.</p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 rounded-full blur-md opacity-20"></div>
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 flex items-center justify-center text-xl font-bold mb-6 shadow-lg">2</div>
              </div>
              <h3 className="text-xl font-semibold mb-3">Connect</h3>
              <p className="text-gray-400 max-w-xs mx-auto">Link your Binance or brokerage account securely with API keys (read/trade-only access).</p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500 rounded-full blur-md opacity-20"></div>
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-purple-400 flex items-center justify-center text-xl font-bold mb-6 shadow-lg">3</div>
              </div>
              <h3 className="text-xl font-semibold mb-3">Profit</h3>
              <p className="text-gray-400 max-w-xs mx-auto">Our AI starts trading autonomously, optimizing your portfolio every minute.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section id="tech" className="py-20 bg-gray-900/30 backdrop-blur">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Built Like a Hedge Fund. Powered by Multi-Agent AI.</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">PortAI uses a multi-agent architecture — including Prediction AI, Sentiment AI, Market Intelligence, Risk Manager & Execution Agent — that mimics institutional trading desks.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
            <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-800 p-6 shadow-lg hover:shadow-blue-900/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 mb-5">
                <FaBrain size={24} />
              </div>
              <h3 className="text-lg font-semibold mb-2">Prediction AI</h3>
              <p className="text-gray-400 text-sm">Predicts short-term price action with state-of-the-art neural networks</p>
            </div>

            <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-800 p-6 shadow-lg hover:shadow-blue-900/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 mb-5">
                <FiActivity size={24} />
              </div>
              <h3 className="text-lg font-semibold mb-2">Sentiment AI</h3>
              <p className="text-gray-400 text-sm">Analyzes news, social media, and market sentiment in real-time</p>
            </div>

            <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-800 p-6 shadow-lg hover:shadow-blue-900/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 mb-5">
                <FiBarChart2 size={24} />
              </div>
              <h3 className="text-lg font-semibold mb-2">Portfolio Manager</h3>
              <p className="text-gray-400 text-sm">Tracks returns, PnL, exposure and optimizes allocations</p>
            </div>

            <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-800 p-6 shadow-lg hover:shadow-blue-900/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 text-red-400 mb-5">
                <FiShield size={24} />
              </div>
              <h3 className="text-lg font-semibold mb-2">Risk Manager</h3>
              <p className="text-gray-400 text-sm">Stops loss before it spirals with proprietary risk controls</p>
            </div>

            <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-800 p-6 shadow-lg hover:shadow-blue-900/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 text-green-400 mb-5">
                <FiZap size={24} />
              </div>
              <h3 className="text-lg font-semibold mb-2">Execution AI</h3>
              <p className="text-gray-400 text-sm">Places trades in real-time with minimal slippage and impact</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 bg-gray-950">
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
                  <h4 className="text-lg font-semibold">Nitin Sagar</h4>
                  <p className="text-gray-400 text-sm">Fund Manager</p>
                </div>
              </div>
              <p className="text-gray-300 leading-relaxed">"It's exactly what hedge funds use — now made for retail. The demo looks incredibly promising."</p>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-xl border border-gray-800 shadow-xl hover:shadow-indigo-900/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center mb-6">
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-bold text-xl">AT</div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold">Alice T.</h4>
                  <p className="text-gray-400 text-sm">Day Trader</p>
                </div>
              </div>
              <p className="text-gray-300 leading-relaxed">"The strategy automation is next-level. It identified setups 3 hours before I could even see them forming."</p>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-xl border border-gray-800 shadow-xl hover:shadow-purple-900/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center mb-6">
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-purple-600 to-purple-400 flex items-center justify-center text-white font-bold text-xl">MR</div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold">Sanjay Kumar</h4>
                  <p className="text-gray-400 text-sm">Investor</p>
                </div>
              </div>
              <p className="text-gray-300 leading-relaxed">"The best AI trading system I've seen so far. Clean interface, and 100% hands-off trading."</p>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist Section */}
      <section id="waitlist" className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute right-0 bottom-0 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl opacity-10"></div>
          <div className="absolute left-20 bottom-40 w-72 h-72 bg-purple-600 rounded-full filter blur-3xl opacity-10"></div>
        </div>

        <div className="container mx-auto px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">The Future of AI-Powered Investing Starts Here.</h2>
              <p className="text-gray-400 max-w-lg mx-auto">
                Join thousands already signed up for early access.<br />
                Get the edge of institutional-grade AI, today.
              </p>
            </div>

            <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-800 shadow-xl">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                    placeholder="johndoe@example.com"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-400 mb-1">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <button
                  type="submit"
                  disabled={formStatus.isSubmitting}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-all duration-300 shadow-lg hover:shadow-blue-500/30 flex items-center justify-center"
                >
                  {formStatus.isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    "Join the Waitlist →"
                  )}
                </button>

                {formStatus.isSuccess && (
                  <div className="mt-4 p-4 bg-green-900/30 border border-green-800 rounded-lg flex items-start">
                    <FiCheck className="text-green-400 mt-1 mr-3 flex-shrink-0" size={18} />
                    <p className="text-green-300 text-sm">{formStatus.message}</p>
                  </div>
                )}

                {formStatus.isError && (
                  <div className="mt-4 p-4 bg-red-900/30 border border-red-800 rounded-lg flex items-start">
                    <FiAlertCircle className="text-red-400 mt-1 mr-3 flex-shrink-0" size={18} />
                    <p className="text-red-300 text-sm">{formStatus.message}</p>
                  </div>
                )}
              </form>
            </div>

            <div className="mt-8 text-center text-sm text-gray-500">
              <p>By joining, you agree to our Terms of Service and Privacy Policy. We'll never spam you.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-950 border-t border-gray-900">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <span className="text-2xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 bg-clip-text text-transparent">PortAI</span>
              <p className="text-gray-500 text-sm mt-2">The future of autonomous investing.</p>
            </div>

            <div className="flex items-center space-x-8">
              <a href="#features" className="text-gray-400 hover:text-white transition-colors text-sm">Features</a>
              <a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors text-sm">How It Works</a>
              <a href="#tech" className="text-gray-400 hover:text-white transition-colors text-sm">Technology</a>
              <a href="#testimonials" className="text-gray-400 hover:text-white transition-colors text-sm">Testimonials</a>
            </div>
          </div>

          <div className="border-t border-gray-900 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} PortAI. All rights reserved.</p>

            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-500 hover:text-white transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd"></path>
                </svg>
              </a>
              <a href="#" className="text-gray-500 hover:text-white transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path>
                </svg>
              </a>
              <a href="#" className="text-gray-500 hover:text-white transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd"></path>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}