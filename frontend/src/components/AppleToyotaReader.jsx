import React from 'react';

// Placeholder component after removing Toyota manual integration
// This prevents any frontend calls to /api/toyota-manual while keeping the file for compatibility
const AppleToyotaReader = () => {
  return (
    <div className="p-6 text-center text-gray-500">
      <h2 className="text-xl font-semibold mb-2">تم تعطيل دليل تويوتا</h2>
      <p className="text-sm">تم إزالة تكامل دليل تويوتا من النظام بناءً على طلبك. لن يتم تحميل أي بيانات من الدليل حالياً.</p>
    </div>
  );
};

export default AppleToyotaReader;
