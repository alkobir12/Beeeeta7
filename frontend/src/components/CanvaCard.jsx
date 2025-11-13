import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

// A lightweight Canva-like card wrapper for consistent look across the app
const CanvaCard = ({ title, children, className = '', headerClassName = '', contentClassName = '', gradient = 'from-white to-slate-50', accent = 'border-slate-200' }) => {
  return (
    <Card className={`rounded-2xl shadow-sm hover:shadow-md transition-shadow border ${accent} bg-gradient-to-br ${gradient} ${className}`}>
      {title && (
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-800 text-lg">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={`p-6 ${contentClassName}`}>
        {children}
      </CardContent>
    </Card>
  );
};

export default CanvaCard;
