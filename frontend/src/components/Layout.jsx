import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import LanguageToggle from './LanguageToggle';
import DieselExpertFloatingButton from './DieselExpertFloatingButton';
import AnimatedBackground from './AnimatedBackground';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="layout-main" style={{ backgroundColor: '#121314', minHeight: '100vh', position: 'relative' }}>
      {/* Animated Background */}
      <AnimatedBackground />
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      {/* Main Content */}
      <main className="content-area" style={{ backgroundColor: 'transparent', position: 'relative', zIndex: 10 }}>
        {/* Top Left Language Toggle (Desktop/Tablet) */}
        <div className="hidden lg:flex justify-end px-4 py-2" style={{ position: 'relative', zIndex: 50 }}>
           <LanguageToggle />
        </div>

        {/* Mobile Header - Fixed at top */}
        <div className="lg:hidden sticky top-0 z-50 flex items-center justify-between p-3 bg-card/95 backdrop-blur-lg rounded-xl shadow-lg border border-border mb-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 hover:bg-muted rounded-xl transition-colors"
            aria-label="فتح القائمة"
          >
            <Menu size={22} className="text-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground">نظام إدارة الورش</h1>
          <LanguageToggle />
        </div>
        
        {/* Page Content */}
        <div className="animate-fade-in" style={{ position: 'relative', zIndex: 10 }}>
          {children}
        </div>
      </main>
      
      {/* Diesel Expert Floating Button */}
      <DieselExpertFloatingButton />
    </div>
  );
};

export default Layout;
