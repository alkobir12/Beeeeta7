import React, { useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { BarChart3, Sparkles } from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CEO = () => {
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [metrics, setMetrics] = useState(null);

  const askAI = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/ceo/ai-analysis`, null, { params: { question: 'كيف يبدو أداء الورشة هذا الشهر؟' }});
      setAnswer(res.data.response);
      setMetrics(res.data.metrics);
    } catch (e) {
      setAnswer('تعذر جلب التحليل الآن.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen" dir="rtl">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">لوحة المدير التنفيذي</h1>
              <p className="text-slate-600">نظرة عليا وتحليلات ذكية</p>
            </div>
            <Button onClick={askAI} className="bg-purple-600 hover:bg-purple-700" disabled={loading}>
              <Sparkles size={18} className="ml-2" />
              {loading ? 'جاري التحليل...' : 'تحليل ذكي (AI)'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-green-50">
                <CardTitle>الإيرادات</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-green-700">{metrics ? metrics.revenue.toLocaleString() : 0} ر.س</div>
              </CardContent>
            </Card>
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-red-50">
                <CardTitle>المصروفات</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-red-700">{metrics ? metrics.expenses.toLocaleString() : 0} ر.س</div>
              </CardContent>
            </Card>
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-l from-blue-50">
                <CardTitle>الربح</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-blue-700">{metrics ? metrics.profit.toLocaleString() : 0} ر.س</div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 size={20} /> تحليل AI</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {answer ? (
                <div className="prose prose-slate rtl text-slate-800 whitespace-pre-wrap leading-8">
                  {answer}
                </div>
              ) : (
                <div className="text-slate-500">اضغط "تحليل ذكي" لعرض توصيات المدير التنفيذي.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default CEO;
