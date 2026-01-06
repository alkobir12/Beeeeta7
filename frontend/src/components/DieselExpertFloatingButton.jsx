import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Wrench } from 'lucide-react';

const DieselExpertFloatingButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Don't show on diesel expert page itself
  if (location.pathname === '/diesel-expert' || location.pathname === '/chat') {
    return null;
  }

  return (
    <button
      onClick={() => navigate('/diesel-expert')}
      className="fixed bottom-6 left-6 z-50 group"
      style={{ 
        background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 50%, #92400e 100%)',
        animation: 'float 3s ease-in-out infinite'
      }}
      title="خبير الديزل 24/7"
    >
      <div className="flex items-center gap-3 px-4 py-3 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105">
        {/* Avatar with online indicator */}
        <div className="relative">
          <img 
            src="https://www.genspark.ai/api/files/s/owCUM0vz" 
            alt="Diesel Expert"
            className="w-10 h-10 rounded-full border-2 border-white shadow-lg"
          />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-md">
            <div className="w-full h-full bg-green-400 rounded-full animate-ping opacity-75"></div>
          </div>
        </div>
        
        {/* Text */}
        <div className="flex items-center gap-2 text-white font-bold">
          <Wrench className="w-5 h-5" />
          <span className="hidden sm:inline">خبير الديزل 24/7</span>
        </div>
      </div>
    </button>
  );
};

export default DieselExpertFloatingButton;
