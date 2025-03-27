"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FiLock,
  FiBriefcase,
  FiTrendingUp,
  FiDollarSign,
  FiPhone,
  FiMail,
  FiGithub,
  FiTwitter,
  FiLinkedin,
  FiChevronDown
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

export default function HomePage() {
  const router = useRouter();
  const [scrollY, setScrollY] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [, setRandomBars] = useState<{ height: number; color: string }[]>([]);
  const [mounted, setMounted] = useState(false);


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




  useEffect(() => {
    const bars = Array.from({ length: 30 }).map(() => ({
      height: Math.floor(Math.random() * 20) + 4, // Height between 4 and 24
      color: Math.random() > 0.5 ? "bg-green-500" : "bg-red-500",
    }));
    setRandomBars(bars);
  }, []);

  // Stats with counter animation
  const stats = [
    { label: "Avg Annual Returns", value: "87%", icon: <FiTrendingUp /> },
    { label: "Automated Trading", value: "24/7", icon: <FiBriefcase /> },
    { label: "Active Users", value: "12,500+", icon: <FiPhone /> },
    { label: "Trading Volume", value: "$142M+", icon: <FiDollarSign /> }
  ];

  // Features data
  const features = [
    {
      title: "Sign Up & Connect",
      description: "Securely link your exchange account with military-grade encryption.",
      icon: <FiLock className="text-blue-500 text-2xl mb-4" />
    },
    {
      title: "AI Analysis",
      description: "Our AI-driven algorithms provide automated trading & real-time insights.",
      icon: <FiBriefcase className="text-blue-500 text-2xl mb-4" />
    },
    {
      title: "Grow & Optimize",
      description: "Machine learning powers personalized growth strategies for your portfolio.",
      icon: <FiTrendingUp className="text-blue-500 text-2xl mb-4" />
    },
    {
      title: "Withdraw Anytime",
      description: "Profits go directly to your account with no withdrawal fees or delays.",
      icon: <FiDollarSign className="text-blue-500 text-2xl mb-4" />
    }
  ];


  
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
                <a href="#pricing" className="hover:text-blue-400 transition-colors text-sm font-medium">Pricing</a>
                <a href="#support" className="hover:text-blue-400 transition-colors text-sm font-medium">Support</a>
                <button
                  onClick={() => router.push("/login")}
                  className="px-4 py-2 rounded-lg border border-gray-600 hover:border-blue-500 transition-colors"
                >
                  Log In
                </button>
                <button
                  onClick={() => router.push("/signup")}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  Sign Up
                </button>
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
              <a href="#pricing" className="block px-3 py-2 hover:bg-gray-700 rounded-md">Pricing</a>
              <a href="#support" className="block px-3 py-2 hover:bg-gray-700 rounded-md">Support</a>
              <button
                onClick={() => router.push("/login")}
                className="block w-full text-left px-3 py-2 hover:bg-gray-700 rounded-md"
              >
                Log In
              </button>
              <button
                onClick={() => router.push("/signup")}
                className="block w-full text-left px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md mt-2"
              >
                Sign Up
              </button>
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

              <div className="mt-10 flex flex-col items-center sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <button
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg font-bold text-lg"
                  onClick={() => router.push("/signup")}
                >
                  Sign Up for Free
                </button>
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
                        <div className="text-gray-400 text-sm mb-1">Todays P/L</div>
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
                            className={`w-full h-${Math.floor(Math.random() * 20) + 4} ${Math.random() > 0.5 ? 'bg-green-500' : 'bg-red-500'
                              } rounded-sm`}
                          ></div>

                        ))}
                      </div>




                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="text-sm font-medium text-gray-400 mb-3">Recent Trades</div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                            <span>AAPL</span>
                          </div>
                          <div>+$124.50</div>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                            <span>TSLA</span>
                          </div>
                          <div>-$73.20</div>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                            <span>MSFT</span>
                          </div>
                          <div>+$215.75</div>
                        </div>
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

      {/* Stats Section */}
      <section className="py-20 bg-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8
                ">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-8">Our Stats</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  className="flex flex-col items-center p-6 bg-gray-900 rounded-lg shadow-lg"
                  initial="hidden"
                  animate="visible"
                  variants={fadeIn}
                >
                  <div className="text-blue-500 text-3xl mb-2">{stat.icon}</div>
                  <div className="text-xl font-semibold">{stat.value}</div>
                  <div className="text-gray-400">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Features</h2>
            <p className="text-gray-400 max-w-lg mx-auto">Discover the powerful features that make PortAI the ultimate trading companion.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="p-6 bg-gray-800 rounded-lg shadow-lg text-center"
                initial="hidden"
                animate="visible"
                variants={fadeIn}
              >
                {feature.icon}
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-400 max-w-lg mx-auto">Learn how PortAI simplifies and enhances your trading experience.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <motion.div
              className="p-6 bg-gray-900 rounded-lg shadow-lg text-center"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <FiLock className="text-blue-500 text-3xl mb-4" />
              <h3 className="text-xl font-semibold mb-2">Secure Sign-Up</h3>
              <p className="text-gray-400">Create an account with secure encryption.</p>
            </motion.div>
            <motion.div
              className="p-6 bg-gray-900 rounded-lg shadow-lg text-center"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <FiBriefcase className="text-blue-500 text-3xl mb-4" />
              <h3 className="text-xl font-semibold mb-2">AI Analysis</h3>
              <p className="text-gray-400">Get real-time insights and automated trading.</p>
            </motion.div>
            <motion.div
              className="p-6 bg-gray-900 rounded-lg shadow-lg text-center"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              <FiTrendingUp className="text-blue-500 text-3xl mb-4" />
              <h3 className="text-xl font-semibold mb-2">Growth Strategies</h3>
              <p className="text-gray-400">Personalized strategies for portfolio growth.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Pricing Plans</h2>
            <p className="text-gray-400 max-w-lg mx-auto">Choose the plan that fits your trading needs.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-800 rounded-lg shadow-lg text-center">
              <h3 className="text-xl font-semibold mb-2">Basic</h3>
              <p className="text-gray-400 mb-4">For beginners looking to start.</p>
              <div className="text-3xl font-bold mb-4">Free</div>
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg">Get Started</button>
            </div>
            <div className="p-6 bg-gray-800 rounded-lg shadow-lg text-center">
              <h3 className="text-xl font-semibold mb-2">Pro</h3>
              <p className="text-gray-400 mb-4">For experienced traders.</p>
              <div className="text-3xl font-bold mb-4">$19.99/month</div>
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg">Get Started</button>
            </div>
            <div className="p-6 bg-gray-800 rounded-lg shadow-lg text-center">
              <h3 className="text-xl font-semibold mb-2">Enterprise</h3>
              <p className="text-gray-400 mb-4">For institutions and large teams.</p>
              <div className="text-3xl font-bold mb-4">Contact Us</div>
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg">Get Started</button>
            </div>
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section id="support" className="py-20 bg-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Support</h2>
            <p className="text-gray-400 max-w-lg mx-auto">Need help? Our support team is here for you.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-900 rounded-lg shadow-lg text-center">
              <FiMail className="text-blue-500 text-3xl mb-4" />
              <h3 className="text-xl font-semibold mb-2">Email Support</h3>
              <p className="text-gray-400">Contact us via email for assistance.</p>
            </div>
            <div className="p-6 bg-gray-900 rounded-lg shadow-lg text-center">
              <FiPhone className="text-blue-500 text-3xl mb-4" />
              <h3 className="text-xl font-semibold mb-2">Phone Support</h3>
              <p className="text-gray-400">Call our support line for immediate help.</p>
            </div>
            <div className="p-6 bg-gray-900 rounded-lg shadow-lg text-center">
              <FiGithub className="text-blue-500 text-3xl mb-4" />
              <h3 className="text-xl font-semibold mb-2">GitHub Issues</h3>
              <p className="text-gray-400">Report bugs or request features on GitHub.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="text-gray-400 text-sm">
              © {new Date().getFullYear()} PortAI. All rights reserved.
            </div>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-blue-400">
                <FiTwitter className="text-xl" />
              </a>
              <a href="#" className="text-gray-400 hover:text-blue-400">
                <FiLinkedin className="text-xl" />
              </a>
              <a href="#" className="text-gray-400 hover:text-blue-400">
                <FiGithub className="text-xl" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}



// Date : 16th March (Created feature/week1-market-analysis)