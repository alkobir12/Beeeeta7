import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const useStitch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const abortControllerRef = useRef(null);
  const pollRef = useRef(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const pollForCompletion = useCallback(async (generationId) => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }

    let attempts = 0;
    const maxAttempts = 60;

    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const response = await axios.get(`${API_BASE}/stitch/status/${generationId}`);
        const status = response.data?.status;

        if (status === 'completed' || status === 'failed') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          if (status === 'completed') {
            setResult(response.data);
          } else {
            setError(response.data?.error_message || 'فشل توليد الواجهة');
          }
        } else if (attempts >= maxAttempts) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setError('انتهت مهلة التوليد، حاول لاحقاً');
        }
      } catch (err) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setError('تعذر متابعة حالة التوليد');
      }
    }, 5000);
  }, []);

  const generateUI = useCallback(async (prompt, designStyle, colorScheme, uiScope) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${API_BASE}/stitch/generate`,
        {
          prompt,
          design_style: designStyle,
          color_scheme: colorScheme || null,
          ui_scope: uiScope || 'section',
        },
        { signal: controller.signal }
      );

      if (response?.data) {
        setResult(response.data);
        if (response.data.status && response.data.status !== 'completed') {
          pollForCompletion(response.data.id);
        }
      }
      return response.data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.code === 'ECONNABORTED') {
          setError('انتهت مهلة الاتصال مع Stitch');
        } else if (err.response?.status === 429) {
          setError('تم تجاوز حد الطلبات، حاول لاحقاً');
        } else if (err.response?.status >= 500) {
          setError('خطأ في الخادم أثناء توليد الواجهة');
        } else {
          setError(err.response?.data?.detail || 'فشل توليد الواجهة');
        }
      } else {
        setError('حدث خطأ غير متوقع');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [pollForCompletion]);

  const getHistory = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/stitch/history`);
      return response.data || [];
    } catch (err) {
      setError('تعذر تحميل سجل التوليد');
      return [];
    }
  }, []);

  return {
    loading,
    error,
    result,
    generateUI,
    getHistory,
    resetError,
  };
};

export default useStitch;