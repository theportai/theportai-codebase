"use client";

import { useEffect, useState } from "react";
import {
    BarChart3, Users, Moon, Sun, Menu, X,
    Home, Settings, LogOut, ArrowUp, ArrowDown, Bell, Search
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


interface Asset {
    name: string;
    symbol: string;
    value: number;
    change: number;
    color: string;
}

interface Trade {
    action: string;
    asset: string;
    time: string;
}

interface Stats {
    portfolioValue: number;
    portfolioChange: number;
    investmentMode: string;
    expectedReturn: string;
    riskLevel: number;
    assets: Asset[];
    trades: Trade[];
}

export default function UserDashboard() {
    const [stats, setStats] = useState<Stats>({
        portfolioValue: 127549.83,
        portfolioChange: 12.3,
        investmentMode: "Aggressive",
        expectedReturn: "15-25%",
        riskLevel: 3,
        assets: [
            { name: "Bitcoin", symbol: "BTC", value: 55234.12, change: 5.8, color: "bg-orange-500" },
            { name: "Ethereum", symbol: "ETH", value: 3145.36, change: 3.2, color: "bg-blue-500" },
            { name: "Solana", symbol: "SOL", value: 125.78, change: 8.4, color: "bg-green-500" },
            { name: "Avalanche", symbol: "AVAX", value: 34.22, change: -1.2, color: "bg-red-500" },
            { name: "Binance Coin", symbol: "BNB", value: 423.56, change: -2.4, color: "bg-yellow-500" }
        ],
        trades: [
            { action: "Buy", asset: "BTC", time: "2 min ago" },
            { action: "Sell", asset: "XRP", time: "15 min ago" },
            { action: "Buy", asset: "ETH", time: "28 min ago" },
            { action: "Buy", asset: "SOL", time: "42 min ago" },
            { action: "Sell", asset: "DOT", time: "1 hour ago" }
        ]
    });

    const updatePortfolioValue = (newValue: number) => {
        setStats((prevStats) => ({
            ...prevStats,
            portfolioValue: newValue,
        }));
    };

    const addTrade = (action: string, asset: string, time: string) => {
        setStats((prevStats) => ({
            ...prevStats,
            trades: [
                ...prevStats.trades,
                { action, asset, time },
            ],
        }));
    };

    // Example usage
    useEffect(() => {
        // Simulate an update after 5 seconds
        const timer = setTimeout(() => {
            updatePortfolioValue(130000);
            addTrade("Buy", "ADA", "5 min ago");
        }, 5000);

        return () => clearTimeout(timer);
    }, []);





    const [darkMode, setDarkMode] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const toggleTheme = () => {
        setDarkMode(!darkMode);
    };

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    return (
        <div className={`min-h-screen flex transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>
            {/* Sidebar */}
            <div
                className={`fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out
          ${darkMode ? 'bg-gray-800' : 'bg-white'}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0`}
            >
                <div className="h-full flex flex-col p-4">
                    <div className="flex items-center mb-8">
                        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center mr-2">
                            <span className="font-bold text-white">AI</span>
                        </div>
                        <h1 className="text-xl font-bold text-blue-500">PortAI</h1>
                        <button
                            onClick={toggleSidebar}
                            className="ml-auto md:hidden text-gray-400 hover:text-blue-500"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <nav className="flex-1">
                        <div className="space-y-1">
                            <div className={`flex items-center px-4 py-3 rounded-lg font-medium ${darkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'}`}>
                                <Home size={18} className="mr-3" />
                                <span>Dashboard</span>
                            </div>

                            <div className={`flex items-center px-4 py-3 rounded-lg font-medium ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <BarChart3 size={18} className="mr-3" />
                                <span>Trades</span>
                            </div>

                            <div className={`flex items-center px-4 py-3 rounded-lg font-medium ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <Users size={18} className="mr-3" />
                                <span>AI Insights</span>
                            </div>

                            <div className={`flex items-center px-4 py-3 rounded-lg font-medium ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <Settings size={18} className="mr-3" />
                                <span>Strategy</span>
                            </div>

                            <div className={`flex items-center px-4 py-3 rounded-lg font-medium ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <Settings size={18} className="mr-3" />
                                <span>Settings</span>
                            </div>
                        </div>
                    </nav>

                    <div className={`mt-auto pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <div className="flex items-center p-2">
                            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center mr-2">
                                <span className="font-semibold text-white text-sm">JD</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium">John Doe</p>
                                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>john@example.com</p>
                            </div>
                            <button className={`p-1 rounded-full ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                                <LogOut size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1">
                {/* Header */}
                <header className={`sticky top-0 z-20 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-4 py-3`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            {!sidebarOpen && (
                                <button
                                    onClick={toggleSidebar}
                                    className={`mr-4 ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                                >
                                    <Menu size={20} />
                                </button>
                            )}

                            <div className="relative ml-6 max-w-md w-full">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <Search className="w-5 h-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search assets, markets..."
                                    className={`pl-10 pr-4 py-2 w-full rounded-lg ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-100 text-gray-800 border-gray-200'} border`}
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <div className="relative">
                                <Bell size={20} className="text-gray-400" />
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs">2</span>
                                </div>
                            </div>

                            <button
                                onClick={toggleTheme}
                                className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-200 text-gray-700'}`}
                            >
                                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                            </button>

                            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                                <span className="font-semibold text-white text-sm">JD</span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

                        {/* Portfolio Value */}
                        <div className={`rounded-xl p-6 ${darkMode ? 'bg-gray-800' : 'bg-white shadow-md'}`}>
                            <h2 className="text-lg font-semibold mb-2">Total Portfolio Value</h2>
                            <div className="flex items-baseline">
                                <span className="text-3xl font-bold">${stats.portfolioValue.toLocaleString()}</span>
                                <span className={`ml-2 text-sm font-medium ${stats.portfolioChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {stats.portfolioChange > 0 ? '+' : ''}{stats.portfolioChange}%
                                </span>
                            </div>

                            <div className="mt-6 h-64 bg-white rounded-lg">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={[
                                            { name: 'Jan', value: 1200 },
                                            { name: 'Feb', value: 1500 },
                                            { name: 'Mar', value: 1300 },
                                            { name: 'Apr', value: 1700 },
                                            { name: 'May', value: 1600 },
                                            { name: 'Jun', value: 1900 },
                                        ]}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>



                        {/* AI Investment Mode */}
                        <div className={`rounded-xl p-6 ${darkMode ? 'bg-gray-800' : 'bg-white shadow-md'}`}>
                            <h2 className="text-lg font-semibold mb-4">AI Investment Mode</h2>

                            <div className="grid grid-cols-3 gap-2 mb-6">
                                <button className={`py-2 px-4 rounded-lg font-medium ${stats.investmentMode === 'Aggressive' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                                    Aggressive
                                </button>
                                <button className={`py-2 px-4 rounded-lg font-medium ${stats.investmentMode === 'Balanced' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                                    Balanced
                                </button>
                                <button className={`py-2 px-4 rounded-lg font-medium ${stats.investmentMode === 'Conservative' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                                    Conservative
                                </button>
                            </div>

                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                <h3 className="font-semibold mb-2">High Growth Strategy</h3>
                                <p className="text-sm text-gray-500 mb-4">Aims for maximum growth with higher volatility. AI allocates up to 80% in high-potential assets.</p>

                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-500">Expected Annual Return</span>
                                    <span className="font-semibold">{stats.expectedReturn}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Risk Level</span>
                                    <div className="flex space-x-1">
                                        {[...Array(3)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`w-8 h-2 rounded ${i < stats.riskLevel ? 'bg-blue-600' : 'bg-gray-300'}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Live AI Trading Activity */}
                        <div className={`rounded-xl p-6 ${darkMode ? 'bg-gray-800' : 'bg-white shadow-md'}`}>
                            <h2 className="text-lg font-semibold mb-4">Live AI Trading Activity</h2>

                            <div className="space-y-4">
                                {stats.trades.map((trade, index) => (
                                    <div key={index} className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${trade.action === 'Buy' ? 'bg-green-100' : 'bg-red-100'}`}>
                                                {trade.action === 'Buy' ?
                                                    <ArrowUp size={16} className="text-green-600" /> :
                                                    <ArrowDown size={16} className="text-red-600" />
                                                }
                                            </div>
                                            <div className="ml-3">
                                                <div className="font-medium">{trade.action} {trade.asset}</div>
                                            </div>
                                        </div>
                                        <div className="text-sm text-gray-500">{trade.time}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Market Trends & AI Insights */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className={`rounded-xl p-6 ${darkMode ? 'bg-gray-800' : 'bg-white shadow-md'}`}>
                            <h2 className="text-lg font-semibold mb-4">Market Trends & AI Insights</h2>

                            <div className="space-y-4">
                                {stats.assets.map((asset) => (
                                    <div key={asset.name} className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${asset.color}`}>
                                                <span className="text-white font-semibold">{asset.name.charAt(0)}</span>
                                            </div>
                                            <div className="ml-3">
                                                <div className="font-medium">{asset.name}</div>
                                                <div className="text-sm text-gray-500">{asset.symbol}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-medium ${asset.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {asset.change > 0 ? '+' : ''}{asset.change}%
                                            </div>
                                            <div className="text-sm text-gray-500">${asset.value.toLocaleString()}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Additional Insights or Widgets */}
                        <div className={`rounded-xl p-6 ${darkMode ? 'bg-gray-800' : 'bg-white shadow-md'}`}>
                            <h2 className="text-lg font-semibold mb-4">Additional Insights</h2>
                            <p className="text-gray-500">This section can be used to display additional insights, widgets, or any other relevant information.</p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
