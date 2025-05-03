import React, { useState } from 'react';

interface TabsProps {
  children: React.ReactNode;
  defaultValue?: string;
}

export const Tabs: React.FC<TabsProps> = ({ children, defaultValue = '' }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div className="tabs">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            activeTab,
            handleTabChange,
          });
        }
        return child;
      })}
    </div>
  );
};

interface TabsListProps {
  children: React.ReactNode;
}

export const TabsList: React.FC<TabsListProps> = ({ children }) => {
  return <div className="tabs-list">{children}</div>;
};

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  activeTab: string;
  handleTabChange: (tab: string) => void;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, children, activeTab, handleTabChange }) => {
  const isActive = activeTab === value;

  return (
    <button
      className={`tabs-trigger ${isActive ? 'active' : ''}`}
      onClick={() => handleTabChange(value)}
    >
      {children}
    </button>
  );
};

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  activeTab: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, children, activeTab }) => {
  if (activeTab !== value) {
    return null;
  }

  return <div className="tabs-content">{children}</div>;
};
