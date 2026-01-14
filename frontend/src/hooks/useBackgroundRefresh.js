import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook للتحديث في الخلفية بدون فقدان البيانات المدخلة
 * 
 * @param {Function} fetchFn - دالة جلب البيانات
 * @param {Object} options - خيارات التحديث
 * @param {number} options.interval - فترة التحديث بالمللي ثانية (افتراضي: 30000)
 * @param {boolean} options.refreshOnFocus - تحديث عند العودة للتطبيق (افتراضي: true)
 * @param {boolean} options.enabled - تفعيل التحديث التلقائي (افتراضي: true)
 */
export const useBackgroundRefresh = (fetchFn, options = {}) => {
  const {
    interval = 30000, // 30 ثانية افتراضياً
    refreshOnFocus = true,
    enabled = true
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const isMountedRef = useRef(true);
  const intervalRef = useRef(null);

  // جلب البيانات في الخلفية
  const backgroundFetch = useCallback(async (showLoading = false) => {
    if (!isMountedRef.current) return;
    
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      const result = await fetchFn();
      
      if (isMountedRef.current) {
        setData(result);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err);
        console.error('Background fetch error:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [fetchFn]);

  // تحديث يدوي
  const refresh = useCallback(() => {
    return backgroundFetch(false);
  }, [backgroundFetch]);

  // تحديث مع loading
  const refetch = useCallback(() => {
    return backgroundFetch(true);
  }, [backgroundFetch]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // جلب البيانات الأولي
    backgroundFetch(true);

    // تحديث عند العودة للتطبيق
    const handleVisibilityChange = () => {
      if (refreshOnFocus && !document.hidden && enabled) {
        backgroundFetch(false);
      }
    };

    // تحديث دوري في الخلفية
    if (enabled && interval > 0) {
      intervalRef.current = setInterval(() => {
        backgroundFetch(false);
      }, interval);
    }

    if (refreshOnFocus) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [backgroundFetch, refreshOnFocus, enabled, interval]);

  return {
    data,
    loading,
    error,
    isRefreshing,
    lastUpdated,
    refresh,
    refetch,
    setData
  };
};

/**
 * Hook لحفظ بيانات النموذج تلقائياً في localStorage
 * يمنع فقدان البيانات عند تحديث الصفحة
 * 
 * @param {string} key - مفتاح التخزين
 * @param {any} initialValue - القيمة الافتراضية
 */
export const usePersistedState = (key, initialValue) => {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('Failed to persist state:', err);
    }
  }, [key, value]);

  const clearPersistedValue = useCallback(() => {
    localStorage.removeItem(key);
    setValue(initialValue);
  }, [key, initialValue]);

  return [value, setValue, clearPersistedValue];
};

/**
 * Hook لمنع فقدان البيانات غير المحفوظة
 */
export const useUnsavedChangesWarning = (hasUnsavedChanges) => {
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'لديك تغييرات غير محفوظة. هل أنت متأكد من المغادرة؟';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
};

export default useBackgroundRefresh;
