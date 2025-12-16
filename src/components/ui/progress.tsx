import React from 'react';

interface ProgressProps {
  value: number;
  className?: string;
}

const Progress: React.FC<ProgressProps> = ({ value, className = '' }) => {
  return (
    <div className={`h-2 w-full bg-gray-200 rounded-full ${className}`}>
      <div
        className="h-2 bg-blue-600 rounded-full"
        style={{ width: `${value}%` }}
      ></div>
    </div>
  );
};

export default Progress;
