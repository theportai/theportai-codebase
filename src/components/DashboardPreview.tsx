import { FiTrendingUp } from 'react-icons/fi'
import React from 'react';

const DashboardPreview = () => {
  return (
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
  );
};

export default DashboardPreview;
