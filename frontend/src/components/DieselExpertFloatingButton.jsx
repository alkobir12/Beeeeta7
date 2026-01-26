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
    <div 
      className="fixed bottom-6 left-6 z-50" 
      style={{ pointerEvents: 'none' }}
    >
      <button
        onClick={() => navigate('/diesel-expert')}
        className="group bg-gradient-to-r from-emergent-green via-emergent-green-light to-emergent-green shadow-glow-lg hover:shadow-glow-lg hover:scale-105 transition-all duration-300 rounded-full"
        title="خبير الديزل 24/7"
        style={{ 
          animation: 'float 3s ease-in-out infinite',
          pointerEvents: 'auto'
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3 rounded-full">
          {/* Avatar with online indicator */}
          <div className="relative">
            {/* تم إزالة صورة خبير الديزل المرتبطة بـ Genspark */}
            <div className="w-10 h-10 rounded-full border-2 border-white shadow-lg bg-emergent-green-light flex items-center justify-center text-emergent-black font-bold text-xs">
              ديزل
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full border-2 border-emergent-green shadow-md">
              <div className="w-full h-full bg-white rounded-full animate-ping opacity-75"></div>
            </div>
          </div>
          
          {/* Text */}
          <div className="flex items-center gap-2 text-emergent-black font-bold">
            <Wrench className="w-5 h-5" />
            <span className="hidden sm:inline">خبير الديزل 24/7</span>
          </div>
        </div>
      </button>
    </div>
  );
};

export default DieselExpertFloatingButton;
