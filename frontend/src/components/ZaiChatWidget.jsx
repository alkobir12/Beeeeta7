import React from 'react';

/**
 * z.ai Chat Widget (بسيط)
 *
 * يستبدل مساعد Groq الحالي بزر عائم يفتح صفحة شات z.ai
 * بالرابط الذي زودتني به.
 */
const CHAT_URL = 'https://chat.z.ai/c/9a9e62f0-62fa-4b5e-9042-d78f02e06062';

const ZaiChatWidget = () => {
  const handleClick = () => {
    try {
      window.open(CHAT_URL, '_blank', 'noopener,noreferrer');
    } catch (e) {
      // تجاهل أي أخطاء بسيطة في فتح النافذة
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="fixed z-50 bottom-4 right-4 w-12 h-12 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors text-xs font-semibold"
      aria-label="Open z.ai chat"
    >
      Chat
    </button>
  );
};

export default ZaiChatWidget;
