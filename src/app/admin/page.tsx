"use client";

import { useEffect, useState } from "react";
import {
    ChevronLeft, ChevronRight, Search, BarChart3, Users, CheckCircle,
    XCircle, AlertCircle, Moon, Sun, Menu, X, RefreshCw,
    Home, Settings, LogOut, User, Bell
} from "lucide-react";

interface User {
    phone: string;
    pan: string;
    aadhaar: string;
}

interface Stats {
    totalApplications: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
}

export default function AdminDashboard() {
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [darkMode, setDarkMode] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [usersPerPage] = useState(5);
    const [stats, setStats] = useState<Stats>({
        totalApplications: 0,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0
    });
    const [showNotifications, setShowNotifications] = useState(false);
    const [, setFilterStatus] = useState("all");


    const fetchData = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/admin/kyc-pending");
            if (!response.ok) throw new Error("Failed to fetch data");
    
            const data = await response.json();
            setUsers(data.users || []);
            setFilteredUsers(data.users || []);
            setStats({
                totalApplications: data.totalApplications || 0,
                pendingCount: data.users?.length || 0,
                approvedCount: data.approvedCount || 0,
                rejectedCount: data.rejectedCount || 0
            });
        } catch (error) {
            console.error("❌ Error fetching KYC data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Fetch data every 5 seconds
        return () => clearInterval(interval); // Cleanup interval on component unmount
    }, []);

    useEffect(() => {
        const results = users.filter(user =>
            user.phone.includes(searchQuery) ||
            user.pan.includes(searchQuery.toUpperCase()) ||
            user.aadhaar.includes(searchQuery)
        );
        setFilteredUsers(results);
        setCurrentPage(1);
    }, [searchQuery, users]);

    
    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

    const approveKYC = async (phone: string) => {
        if (confirm("Are you sure you want to approve this KYC application?")) {
            try {
                setIsLoading(true);
                await fetch("/api/admin/kyc-approve", {
                    method: "POST",
                    body: JSON.stringify({ phone: phone, status: "APPROVED" }),
                    headers: { "Content-Type": "application/json" },
                });

                setUsers(prevUsers => prevUsers.filter(user => user.phone !== phone));
                setStats(prev => ({
                    ...prev,
                    pendingCount: prev.pendingCount - 1,
                    approvedCount: prev.approvedCount + 1
                }));

                showToast("KYC application approved successfully", "success");
            } catch (error) {
                console.error("Error approving KYC:", error);
                showToast("Failed to approve KYC application", "error");
            } finally {
                setIsLoading(false);
            }
        }
    };

    const rejectKYC = async (phone: string) => {
        if (confirm("Are you sure you want to reject this KYC application?")) {
            try {
                setIsLoading(true);
                await fetch("/api/admin/kyc-reject", {
                    method: "POST",
                    body: JSON.stringify({ phone: phone, status: "REJECTED" }),
                    headers: { "Content-Type": "application/json" },
                });

                setUsers(prevUsers => prevUsers.filter(user => user.phone !== phone));
                setStats(prev => ({
                    ...prev,
                    pendingCount: prev.pendingCount - 1,
                    rejectedCount: prev.rejectedCount + 1
                }));

                showToast("KYC application rejected", "success");
            } catch (error) {
                console.error("Error rejecting KYC:", error);
                showToast("Failed to reject KYC application", "error");
            } finally {
                setIsLoading(false);
            }
        }
    };

    const showToast = (message: string, type: string) => {
        const toast = document.createElement("div");
        toast.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white
                       ${type === "success" ? "bg-green-500" : "bg-red-500"}
                       animate-fade-in-up`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("animate-fade-out");
            setTimeout(() => document.body.removeChild(toast), 500);
        }, 3000);
    };

    const resetFilters = () => {
        setSearchQuery("");
        setFilterStatus("all");
    };

    const refreshData = async () => {
        await fetchData();
        showToast("Data refreshed successfully", "success");
    };

    const toggleTheme = () => {
        setDarkMode(!darkMode);
    };

    return (
        <div className={`min-h-screen flex transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>
            <div
                className={`fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out
                   ${darkMode ? 'bg-gray-800' : 'bg-white shadow-lg'}
                   ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                   md:relative md:translate-x-0`}
                style={{ width: sidebarOpen ? '240px' : '0px' }}
            >
                <div className="h-full flex flex-col justify-between p-4">
                    <div>
                        <div className="flex items-center justify-between mb-8 mt-2">
                            <div className="flex items-center">
                                <div className={`h-8 w-8 rounded-full ${darkMode ? 'bg-blue-500' : 'bg-blue-600'} flex items-center justify-center mr-2`}>
                                    <span className="font-bold text-white">AI</span>
                                </div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">PortAI</h1>
                            </div>
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="md:hidden text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-1 mt-8">
                            <div className={`px-3 py-2 rounded-lg mb-1 flex items-center cursor-pointer
                         ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <Home size={18} className="mr-2" />
                                <span>Dashboard</span>
                            </div>

                            <div className={`px-3 py-2 rounded-lg mb-1 flex items-center cursor-pointer
                         ${darkMode ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                <Users size={18} className="mr-2" />
                                <span>KYC Approval</span>
                            </div>

                            <div className={`px-3 py-2 rounded-lg mb-1 flex items-center cursor-pointer
                         ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <User size={18} className="mr-2" />
                                <span>Users</span>
                            </div>

                            <div className={`px-3 py-2 rounded-lg mb-1 flex items-center cursor-pointer
                         ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <BarChart3 size={18} className="mr-2" />
                                <span>Analytics</span>
                            </div>

                            <div className={`px-3 py-2 rounded-lg mb-1 flex items-center cursor-pointer
                         ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <Settings size={18} className="mr-2" />
                                <span>Settings</span>
                            </div>
                        </div>
                    </div>

                    <div className={`mt-auto pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <div className="flex items-center p-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-400 to-blue-500 flex items-center justify-center mr-2">
                                <span className="font-semibold text-white text-sm">AD</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium">Admin User</p>
                                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>admin@portai.com</p>
                            </div>
                            <button className={`p-1 rounded-full ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                                <LogOut size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 transition-all duration-300 ease-in-out"
                style={{ marginLeft: sidebarOpen ? '0' : '0', width: sidebarOpen ? 'calc(100% - 240px)' : '100%' }}>
                <header className={`sticky top-0 z-20 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b shadow-sm px-4 py-3`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            {!sidebarOpen && (
                                <button
                                    onClick={() => setSidebarOpen(true)}
                                    className={`mr-4 ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                                >
                                    <Menu size={20} />
                                </button>
                            )}
                            <h2 className="text-xl font-semibold">KYC Approval Dashboard</h2>
                        </div>

                        <div className="flex items-center space-x-4">
                            <button onClick={refreshData} className={`p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                            </button>

                            <div className="relative">
                                <button
                                    onClick={() => setShowNotifications(!showNotifications)}
                                    className={`p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                                >
                                    <Bell size={18} />
                                    <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
                                </button>

                                {showNotifications && (
                                    <div className={`absolute right-0 w-64 mt-2 p-2 rounded-lg shadow-lg ${darkMode ? 'bg-gray-700' : 'bg-white'}`}>
                                        <div className={`p-2 mb-1 text-sm rounded ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                            <p>3 new KYC requests pending</p>
                                            <p className="text-xs text-gray-400 mt-1">Just now</p>
                                        </div>
                                        <div className={`p-2 text-sm rounded ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                            <p>System update scheduled</p>
                                            <p className="text-xs text-gray-400 mt-1">2 hours ago</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={toggleTheme}
                                className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
                            >
                                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                        </div>
                    </div>
                </header>

                <main className={`p-6 ${darkMode ? 'text-white' : 'text-gray-800'} transition-colors duration-300`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                        <div className={`rounded-xl p-5 ${darkMode ? 'bg-gray-800' : 'bg-gray-100 shadow-md'}`}>
                            <div className="flex items-center space-x-4">
                                <CheckCircle size={24} className={`${darkMode ? 'text-green-400' : 'text-green-500'}`} />
                                <div>
                                    <h3 className="text-lg font-semibold">{stats.approvedCount}</h3>
                                    <p className="text-sm text-gray-500">Approved</p>
                                </div>
                            </div>
                        </div>
                        <div className={`rounded-xl p-5 ${darkMode ? 'bg-gray-800' : 'bg-gray-100 shadow-md'}`}>
                            <div className="flex items-center space-x-4">
                                <XCircle size={24} className={`${darkMode ? 'text-red-400' : 'text-red-500'}`} />
                                <div>
                                    <h3 className="text-lg font-semibold">{stats.rejectedCount}</h3>
                                    <p className="text-sm text-gray-500">Rejected</p>
                                </div>
                            </div>
                        </div>
                        <div className={`rounded-xl p-5 ${darkMode ? 'bg-gray-800' : 'bg-gray-100 shadow-md'}`}>
                            <div className="flex items-center space-x-4">
                                <AlertCircle size={24} className={`${darkMode ? 'text-yellow-400' : 'text-yellow-500'}`} />
                                <div>
                                    <h3 className="text-lg font-semibold">{stats.pendingCount}</h3>
                                    <p className="text-sm text-gray-500">Pending</p>
                                </div>
                            </div>
                        </div>
                        <div className={`rounded-xl p-5 ${darkMode ? 'bg-gray-800' : 'bg-gray-100 shadow-md'}`}>
                            <div className="flex items-center space-x-4">
                                <Users size={24} className={`${darkMode ? 'text-blue-400' : 'text-blue-500'}`} />
                                <div>
                                    <h3 className="text-lg font-semibold">{stats.totalApplications}</h3>
                                    <p className="text-sm text-gray-500">Total Applications</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-4">
                        <div className="relative flex items-center">
                            <Search className="absolute left-3 text-gray-500" size={18} />
                            <input
                                type="text"
                                placeholder="Search by phone, PAN, or Aadhaar"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`pl-10 pr-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={resetFilters}
                                className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                            >
                                Reset Filters
                            </button>
                            <button
                                onClick={refreshData}
                                className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                            >
                                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                            <thead>
                                <tr className={`${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                    <th className="py-2 px-4">Phone</th>
                                    <th className="py-2 px-4">PAN</th>
                                    <th className="py-2 px-4">Aadhaar</th>
                                    <th className="py-2 px-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentUsers.map((user) => (
                                    <tr key={user.phone} className={`${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} border-b border-gray-200 dark:border-gray-700`}>
                                        <td className="py-2 px-4">{user.phone}</td>
                                        <td className="py-2 px-4">{user.pan}</td>
                                        <td className="py-2 px-4">{user.aadhaar}</td>
                                        <td className="py-2 px-4 flex space-x-2">
                                            <button
                                                onClick={() => approveKYC(user.phone)}
                                                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => rejectKYC(user.phone)}
                                                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                            >
                                                Reject
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center mt-4">
                        <button
                            onClick={() => setCurrentPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} disabled:opacity-50`}
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} disabled:opacity-50`}
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
}
