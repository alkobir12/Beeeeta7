import React, { useEffect } from 'react';

/**
 * z.ai Chat Widget
 *
 * يستبدل مساعد Groq الحالي بويدجت z.ai على كل الصفحات.
 * يعتمد على كود التضمين (Embed) من z.ai.
 */
const ZaiChatWidget = () => {
  useEffect(() => {
    // إذا كان السكربت موجود مسبقًا لا نضيفه مرة أخرى
    if (document.getElementById('zai-chat-script')) return;

    const script = document.createElement('script');
    script.id = 'zai-chat-script';
    script.async = true;
    script.src = 'https://cdn.z-ai.chat/widget.js';

    // مثال: تمرير الـ chat id / token الذي أعطيتني إياه
    // (إذا كان z.ai يقدم كود مختلف يمكننا تعديله حسب الكود الرسمي من لوحة التحكم)
    script.setAttribute('data-chat-id', 'ef76cd62-ddc4-4e7a-951a-fe9d06f04b6c');
    script.setAttribute('data-api-key', 'a42c9f7f1c1348858cc53d0c7f6fde93.qYRWUOPG1zoMtZOQ');

    document.body.appendChild(script);

    return () => {
      // لا نحذف السكربت عادةً لأن الواجهة كاملة تعتمد عليه
      // لكن إن أردت تنظيفًا أقوى يمكن إزالة السكربت هنا
    };
  }, []);

  return null; // لا نرسم أي JSX؛ السكربت نفسه يضيف الودجت
};

export default ZaiChatWidget;
