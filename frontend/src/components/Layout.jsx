import React, { useState } from 'react';
import { Button } from './ui/button';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 right-4 z-30">
        <Button 
          onClick={() => setSidebarOpen(true)}
          className="bg-white shadow-lg hover:shadow-xl transition-all"
          size="icon"
        >
          <Menu size={24} className="text-slate-700" />
        </Button>
      </div>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="lg:mr-64 pb-16">
        {children}
      </div>
    </div>
  );
};

export default Layout;