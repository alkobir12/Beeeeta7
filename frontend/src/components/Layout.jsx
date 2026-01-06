import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import LanguageToggle from './LanguageToggle';
import DieselExpertFloatingButton from './DieselExpertFloatingButton';
import AnimatedBackground from './AnimatedBackground';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="layout-main" style={{ backgroundColor: '#1E1E1E', minHeight: '100vh', position: 'relative' }}>
      {/* Animated Background */}
      <AnimatedBackground />
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      {/* Main Content */}
      <main className="content-area" style={{ backgroundColor: 'transparent', position: 'relative', zIndex: 1 }}>
        {/* Top Left Language Toggle (Desktop/Tablet) */}
        <div className="hidden lg:flex justify-end px-4 py-2">
           <LanguageToggle />
        </div>

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
      
      {/* Diesel Expert Floating Button */}
      <DieselExpertFloatingButton />
    </div>
  );
};

export default Layout;
