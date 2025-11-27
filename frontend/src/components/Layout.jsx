import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import ChatWidget from './ChatWidget';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="layout-main">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      {/* Main Content */}
      <main className="content-area">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between mb-4 p-2 bg-card rounded-lg shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-semibold">نظام إدارة الورش</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>
        
        {/* Page Content */}
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
      
      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
};

export default Layout;
