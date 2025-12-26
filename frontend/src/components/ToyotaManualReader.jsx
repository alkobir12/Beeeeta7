import React from 'react';

// Legacy ToyotaManualReader has been disabled.
// This stub ensures no calls are made to /api/toyota-manual or /api/manuals.
const ToyotaManualReader = () => {
  return (
    <div className="p-6 text-center text-gray-500">
      <h2 className="text-xl font-semibold mb-2">تم تعطيل قارئ دليل تويوتا القديم</h2>
      <p className="text-sm">لن يتم تحميل أو فتح أي ملفات من دليل تويوتا في هذا الإصدار.</p>
    </div>
  );
};

export default ToyotaManualReader;
