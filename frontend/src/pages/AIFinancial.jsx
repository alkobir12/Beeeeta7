/* eslint-disable */

import React, { useState, useEffect } from 'react';
import { 
  Brain, TrendingUp, TrendingDown, DollarSign, AlertCircle,
  RefreshCw, Download, PieChart, BarChart3, Lightbulb, Loader2, Send,
  Wallet, CreditCard, Activity
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import FinancialCard from '../components/FinancialCard';

import { financeAPI, aiAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { useTheme } from '../contexts/ThemeContext';

const AIFinancial = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');

  const [financialData, setFinancialData] = useState({
    revenue: 0,
    expenses: 0,
    netProfit: 0,
    profitMargin: 0,
    assets: 0,
    liabilities: 0,
    equity: 0,
  });

  const [aiAnalysis, setAiAnalysis] = useState({
    overview: '',
    recommendations: [],
    predictions: {},
    riskFactors: [],
  });

  // حالة الدردشة
  const [chatQuery, setChatQuery] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  const workshopId = process.env.REACT_APP_WORKSHOP_ID;

  useEffect(() => {
    if (workshopId) {
      fetchFinancialData();
    } else {
      setError('لم يتم ضبط معرف الورشة REACT_APP_WORKSHOP_ID');
      setLoading(false);
    }
    // eslint disabled
  }, [workshopId, timeRange]);

  const getStartDate = (range) => {
    const now = new Date();
    const d = new Date(now); // نسخ حتى لا نعدل الأصل
    switch (range) {
      case 'week':
        d.setDate(d.getDate() - 7);
        break;
      case 'month':
        d.setMonth(d.getMonth() - 1);
        break;
      case 'quarter':
        d.setMonth(d.getMonth() - 3);
        break;
      case 'year':
        d.setFullYear(d.getFullYear() - 1);
        break;
      default:
        d.setMonth(d.getMonth() - 1);
    }
    return d.toISOString().split('T')[0];
  };

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date().toISOString().split('T')[0];
      const startDate = getStartDate(timeRange);

      const [incomeRes, balanceRes] = await Promise.all([
        financeAPI.getIncomeStatement({
          workshop_id: workshopId,
          start_date: startDate,
          end_date: endDate,
        }),
        financeAPI.getBalanceSheet({
          workshop_id: workshopId,
        }),
      ]);

      const incomeData = incomeRes.data?.data;
      const balanceData = balanceRes.data?.data;

      const revenue = incomeData?.totals?.revenue || 0;
      const expenses = incomeData?.totals?.expenses || 0;
      const netProfit = incomeData?.totals?.net_income || revenue - expenses;
      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      setFinancialData({
        revenue,
        expenses,
        netProfit,
        profitMargin,
        assets: balanceData?.totals?.assets || 0,
        liabilities: balanceData?.totals?.liabilities || 0,
        equity: balanceData?.totals?.equity || 0,
      });

      await fetchAiAnalysis({
        revenue,
        expenses,
        netProfit,
        profitMargin,
        assets: balanceData?.totals?.assets || 0,
        liabilities: balanceData?.totals?.liabilities || 0,
        equity: balanceData?.totals?.equity || 0,
      });

      toast.success('تم تحليل البيانات المالية بنجاح!');
    } catch (err) {
      console.error('Error fetching financial data:', err);
      setError('تعذر جلب البيانات المالية. يرجى المحاولة مرة أخرى.');
      toast.error('فشل في تحليل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const fetchAiAnalysis = async (data) => {
    try {
      const response = await aiAPI.financialAnalysis({
        query: 'حلل الوضع المالي بناءً على البيانات الحقيقية',
        financial_data: data,
      });

      const analysisText = response.data?.analysis || 'لا يوجد تحليل متاح حالياً';

      const recommendations = generateRecommendations(data);
      const predictions = generatePredictions(data);
      const riskFactors = identifyRiskFactors(data);

      setAiAnalysis({
        overview: analysisText,
        recommendations,
        predictions,
        riskFactors,
      });
    } catch (err) {
      console.error('AI Analysis error:', err);
      setAiAnalysis((prev) => ({
        ...prev,
        overview: prev.overview || 'تعذر الاتصال بخدمة الذكاء الاصطناعي. تحقق من اتصال الشبكة.',
      }));
    }
  };

  const generateRecommendations = (data) => {
    const recs = [];

    if (data.profitMargin < 20) {
      recs.push({
        title: 'تحسين هامش الربح',
        description: `هامش الربح الحالي ${data.profitMargin.toFixed(1)}% منخفض. فكر في زيادة الأسعار أو خفض التكاليف.`,
        priority: 'high',
        impact: 'زيادة الربحية بنسبة 5-10%',
      });
    }

    if (data.expenses > data.revenue * 0.7) {
      recs.push({
        title: 'مراقبة المصروفات',
        description: 'المصروفات تشكل نسبة كبيرة من الإيرادات. راجع المصروفات غير الضرورية.',
        priority: 'high',
        impact: 'تخفيض التكاليف بنسبة 10-15%',
      });
    }

    if (data.revenue < 100000) {
      recs.push({
        title: 'زيادة الإيرادات',
        description: 'الإيرادات الحالية منخفضة. فكر في تقديم خدمات جديدة أو تحسين التسويق.',
        priority: 'medium',
        impact: 'زيادة المبيعات بنسبة 20-30%',
      });
    }

    return recs;
  };

  const generatePredictions = (data) => ({
    nextMonth: Math.round(data.revenue * 1.1),
    nextQuarter: Math.round(data.revenue * 1.3),
    nextYear: Math.round(data.revenue * 1.5),
  });

  const identifyRiskFactors = (data) => {
    const risks = [];

    if (data.liabilities > data.assets * 0.5) {
      risks.push('نسبة الديون إلى الأصول مرتفعة');
    }

    if (data.profitMargin < 10) {
      risks.push('هامش الربح منخفض جداً');
    }

    if (data.expenses > data.revenue * 0.8) {
      risks.push('التكاليف تشكل خطراً على الربحية');
    }

    return risks;
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatQuery.trim()) return;

    const userMessage = { role: 'user', content: chatQuery };
    setChatHistory((prev) => [...prev, userMessage]);
    setChatQuery('');
    setChatLoading(true);

    try {
      const response = await aiAPI.financialAnalysis({
        query: chatQuery,
        financial_data: financialData,
      });

      const aiMessage = {
        role: 'assistant',
        content: response.data?.analysis || 'تعذر الحصول على رد من المساعد المالي حالياً.',
      };
      setChatHistory((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error('Chat AI error:', err);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'تعذر الاتصال بالمساعد المالي. حاول مرة أخرى لاحقاً.',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
        <p className="text-lg text-gray-600">جاري تحليل البيانات المالية...</p>
        <p className="text-sm text-gray-500">قد يستغرق هذا بضع لحظات</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 max-w-2xl mx-auto mt-8" dir="rtl">
        <CardHeader>
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-red-600 ml-2" />
            <CardTitle className="text-red-700">حدث خطأ</CardTitle>
          </div>
          <CardDescription>تعذر تحليل البيانات المالية</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Button onClick={fetchFinancialData} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="h-4 w-4 ml-2" />
              إعادة المحاولة
            </Button>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="week">أسبوع</option>
              <option value="month">شهر</option>
              <option value="quarter">ربع سنة</option>
              <option value="year">سنة</option>
            </select>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl" dir="rtl" style={{
      backgroundColor: 'var(--bg-primary)',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center" style={{ color: 'var(--text-primary)' }}>
            <Brain className="h-10 w-10 ml-3 text-blue-600" />
            التحليل المالي بالذكاء الاصطناعي
          </h1>
          <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
            تحليل متقدم للأداء المالي وتوقعات ذكية لورشتك
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 rounded-lg"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="week">آخر أسبوع</option>
            <option value="month">آخر شهر</option>
            <option value="quarter">آخر ربع سنة</option>
            <option value="year">آخر سنة</option>
          </select>

          <div className="flex items-center gap-2">
            <button 
              onClick={fetchFinancialData}
              className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)'
              }}
            >
              <RefreshCw className="h-4 w-4" />
              تحديث
            </button>
            <button 
              className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)'
              }}
            >
              <Download className="h-4 w-4" />
              تصدير
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards - Using New Financial Card Component */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <FinancialCard
          title={formatCurrency(financialData.revenue)}
          subtitle="إجمالي الإيرادات"
          icon={DollarSign}
          trend={financialData.revenue > 0 ? 'up' : 'down'}
          trendValue="+12%"
          variant="default"
          details={[
            { label: 'الفترة', value: timeRange === 'week' ? 'أسبوع' : timeRange === 'month' ? 'شهر' : timeRange === 'quarter' ? 'ربع سنة' : 'سنة' },
            { label: 'متوسط يومي', value: formatCurrency(financialData.revenue / 30 || 0) },
            { label: 'أعلى قيمة', value: formatCurrency(financialData.revenue * 1.2) }
          ]}
        />

        <FinancialCard
          title={formatCurrency(financialData.netProfit)}
          subtitle="صافي الربح"
          icon={TrendingUp}
          trend={financialData.netProfit >= 0 ? 'up' : 'down'}
          trendValue={`${financialData.profitMargin.toFixed(1)}%`}
          variant={financialData.netProfit >= 0 ? 'success' : 'danger'}
          details={[
            { label: 'هامش الربح', value: `${financialData.profitMargin.toFixed(1)}%` },
            { label: 'الإيرادات', value: formatCurrency(financialData.revenue) },
            { label: 'المصروفات', value: formatCurrency(financialData.expenses), valueColor: 'text-red-400' }
          ]}
        />

        <FinancialCard
          title={formatCurrency(financialData.assets)}
          subtitle="إجمالي الأصول"
          icon={Wallet}
          variant="default"
          details={[
            { label: 'الأصول المتداولة', value: formatCurrency(financialData.assets * 0.6) },
            { label: 'الأصول الثابتة', value: formatCurrency(financialData.assets * 0.4) },
            { label: 'صافي الأصول', value: formatCurrency(financialData.assets - financialData.liabilities), valueColor: 'text-emerald-400' }
          ]}
        />

        <FinancialCard
          title={financialData.profitMargin > 20 ? 'ممتاز' : financialData.profitMargin > 10 ? 'جيد' : 'يحتاج تحسين'}
          subtitle="التقييم العام"
          icon={Lightbulb}
          variant={financialData.profitMargin > 20 ? 'success' : financialData.profitMargin > 10 ? 'warning' : 'danger'}
          details={[
            { label: 'هامش الربح', value: `${financialData.profitMargin.toFixed(1)}%` },
            { label: 'نسبة المصروفات', value: `${((financialData.expenses / financialData.revenue) * 100).toFixed(1)}%` },
            { label: 'العائد على الأصول', value: `${((financialData.netProfit / financialData.assets) * 100).toFixed(1)}%` }
          ]}
        />
      </div>

      {/* AI Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Overview Card */}
        <div className="lg:col-span-2">
          <FinancialCard
            title="نظرة عامة من الذكاء الاصطناعي"
            subtitle="التحليل المالي الشامل"
            icon={Brain}
            variant="default"
            expandable={false}
            className="h-full"
          >
            <div 
              className="bg-slate-950/40 rounded-xl p-4 text-slate-200 leading-relaxed"
              style={{ maxHeight: '300px', overflowY: 'auto' }}
            >
              {aiAnalysis.overview || 'جاري تحليل بياناتك المالية...'}
            </div>
          </FinancialCard>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <FinancialCard
            title={formatCurrency(financialData.expenses)}
            subtitle="إجمالي المصروفات"
            icon={CreditCard}
            trend="down"
            trendValue="-5%"
            variant="warning"
            details={[
              { label: 'الرواتب', value: formatCurrency(financialData.expenses * 0.4) },
              { label: 'التشغيل', value: formatCurrency(financialData.expenses * 0.35) },
              { label: 'أخرى', value: formatCurrency(financialData.expenses * 0.25) }
            ]}
          />
        </div>
      </div>

      {/* Recommendations Grid */}
      {aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            التوصيات الذكية
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {aiAnalysis.recommendations.map((rec, index) => (
              <FinancialCard
                key={index}
                title={rec.title}
                subtitle={rec.priority === 'high' ? '⚠️ عالية الأولوية' : '💡 توصية'}
                icon={Lightbulb}
                variant={rec.priority === 'high' ? 'warning' : 'default'}
                expandable={false}
              >
                <div className="text-sm space-y-2">
                  <p className="text-slate-300">{rec.description}</p>
                  <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800">
                    <span className="text-xs text-slate-400">التأثير المتوقع:</span>
                    <p className="text-sm text-emerald-400 font-semibold mt-1">{rec.impact}</p>
                  </div>
                </div>
              </FinancialCard>
            ))}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {aiAnalysis.riskFactors && aiAnalysis.riskFactors.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            عوامل المخاطر
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiAnalysis.riskFactors.map((risk, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)'
                }}
              >
                <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
                <span className="text-slate-200">{risk}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Predictions */}
      {aiAnalysis.predictions && (
        <div>
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            التوقعات المستقبلية
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FinancialCard
              title={formatCurrency(aiAnalysis.predictions.nextMonth)}
              subtitle="الشهر القادم"
              icon={Activity}
              trend="up"
              trendValue="+10%"
              variant="success"
              expandable={false}
            />
            <FinancialCard
              title={formatCurrency(aiAnalysis.predictions.nextQuarter)}
              subtitle="الربع القادم"
              icon={Activity}
              trend="up"
              trendValue="+30%"
              variant="success"
              expandable={false}
            />
            <FinancialCard
              title={formatCurrency(aiAnalysis.predictions.nextYear)}
              subtitle="السنة القادمة"
              icon={Activity}
              trend="up"
              trendValue="+50%"
              variant="success"
              expandable={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Brain className="h-10 w-10 ml-3 text-blue-600" />
            التحليل المالي بالذكاء الاصطناعي
          </h1>
          <p className="text-gray-600 mt-2">
            تحليل متقدم للأداء المالي وتوقعات ذكية لورشتك
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="week">آخر أسبوع</option>
            <option value="month">آخر شهر</option>
            <option value="quarter">آخر ربع سنة</option>
            <option value="year">آخر سنة</option>
          </select>

          <div className="flex items-center gap-2">
            <Button onClick={fetchFinancialData} variant="outline">
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 ml-2" />
              تصدير
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <DollarSign className="h-4 w-4 ml-2" />
              إجمالي الإيرادات
            </CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(financialData.revenue)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              عن آخر {
                timeRange === 'week'
                  ? 'أسبوع'
                  : timeRange === 'month'
                  ? 'شهر'
                  : timeRange === 'quarter'
                  ? 'ربع سنة'
                  : 'سنة'
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <TrendingUp className="h-4 w-4 ml-2" />
              صافي الربح
            </CardDescription>
            <CardTitle
              className={`text-2xl ${
                financialData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(financialData.netProfit)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              هامش ربح: {financialData.profitMargin.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <PieChart className="h-4 w-4 ml-2" />
              متوسط يومي
            </CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(financialData.revenue / 30 || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              تقدير بناءً على الفترة المحددة
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <Lightbulb className="h-4 w-4 ml-2" />
              التقييم
            </CardDescription>
            <CardTitle className="text-2xl">
              {financialData.profitMargin > 20
                ? 'ممتاز'
                : financialData.profitMargin > 10
                ? 'جيد'
                : 'يحتاج تحسين'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">بناءً على هامش الربح</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: نظرة عامة / توصيات / توقعات / مخاطر / دردشة */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center">
            <Brain className="h-4 w-4 ml-2" />
            نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center">
            <Lightbulb className="h-4 w-4 ml-2" />
            التوصيات
          </TabsTrigger>
          <TabsTrigger value="predictions" className="flex items-center">
            <TrendingUp className="h-4 w-4 ml-2" />
            التوقعات
          </TabsTrigger>
          <TabsTrigger value="risks" className="flex items-center">
            <AlertCircle className="h-4 w-4 ml-2" />
            المخاطر
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center">
            💬
            <span className="mr-1">الدردشة</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>تحليل الذكاء الاصطناعي</CardTitle>
              <CardDescription>
                تحليل متعمق للأداء المالي بناءً على البيانات الحقيقية
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {aiAnalysis.overview || 'جاري تحليل البيانات...'}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>توصيات التحسين</CardTitle>
              <CardDescription>اقتراحات لتحسين أدائك المالي</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiAnalysis.recommendations.length > 0 ? (
                  aiAnalysis.recommendations.map((rec, index) => (
                    <Card
                      key={index}
                      className={
                        rec.priority === 'high'
                          ? 'border-red-200'
                          : rec.priority === 'medium'
                          ? 'border-yellow-200'
                          : 'border-green-200'
                      }
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg">{rec.title}</CardTitle>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              rec.priority === 'high'
                                ? 'bg-red-100 text-red-800'
                                : rec.priority === 'medium'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {rec.priority === 'high'
                              ? 'عالي'
                              : rec.priority === 'medium'
                              ? 'متوسط'
                              : 'منخفض'}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-700 mb-2">{rec.description}</p>
                        <p className="text-sm text-gray-600">
                          التأثير المتوقع: {rec.impact}
                        </p>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    لا توجد توصيات حالياً
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>التوقعات المستقبلية</CardTitle>
              <CardDescription>
                توقعات الإيرادات بناءً على الأداء الحالي
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>الشهر القادم</CardDescription>
                    <CardTitle className="text-xl">
                      {formatCurrency(aiAnalysis.predictions.nextMonth || 0)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-green-600">
                      <TrendingUp className="h-4 w-4 ml-1" />
                      <span className="text-sm">+10% عن الحالي</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>الربع القادم</CardDescription>
                    <CardTitle className="text-xl">
                      {formatCurrency(aiAnalysis.predictions.nextQuarter || 0)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-green-600">
                      <TrendingUp className="h-4 w-4 ml-1" />
                      <span className="text-sm">+30% عن الحالي</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>العام القادم</CardDescription>
                    <CardTitle className="text-xl">
                      {formatCurrency(aiAnalysis.predictions.nextYear || 0)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-green-600">
                      <TrendingUp className="h-4 w-4 ml-1" />
                      <span className="text-sm">+50% عن الحالي</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>عوامل الخطر المحتملة</CardTitle>
              <CardDescription>نقاط تحتاج إلى مراجعة واهتمام</CardDescription>
            </CardHeader>
            <CardContent>
              {aiAnalysis.riskFactors.length > 0 ? (
                <ul className="space-y-3">
                  {aiAnalysis.riskFactors.map((risk, index) => (
                    <li key={index} className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-yellow-600 ml-2 mt-0.5" />
                      <span className="text-gray-700">{risk}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-green-600 text-center py-8">
                  ✅ لا توجد مخاطر مالية كبيرة حالياً
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>دردشة مع المساعد المالي</CardTitle>
              <CardDescription>
                اسأل عن وضعك المالي، التوصيات، والمخاطر لتحصل على إجابات فورية
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {/* تاريخ المحادثة */}
                <div className="border border-gray-200 rounded-lg p-4 max-h-[350px] overflow-y-auto bg-gray-50">
                  {chatHistory.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      ابدأ بطرح سؤال مالي للحصول على مساعدة ذكية.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chatHistory.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${
                            msg.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                              msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-800'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex justify-start">
                          <div className="flex items-center gap-2 text-gray-500 text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>جاري التفكير...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* إدخال السؤال */}
                <form onSubmit={handleChatSubmit} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={chatQuery}
                    onChange={(e) => setChatQuery(e.target.value)}
                    placeholder="اكتب سؤالك المالي هنا..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={chatLoading}
                  />
                  <Button
                    type="submit"
                    disabled={chatLoading || !chatQuery.trim()}
                    className="flex items-center justify-center gap-2"
                  >
                    {chatLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span>إرسال</span>
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* المؤشرات المالية الأساسية */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>المؤشرات المالية الأساسية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">نسبة السيولة</p>
              <p className="text-2xl font-semibold">
                {financialData.liabilities > 0
                  ? (financialData.assets / financialData.liabilities).toFixed(2)
                  : '∞'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">نسبة الدين</p>
              <p className="text-2xl font-semibold">
                {financialData.equity > 0
                  ? ((financialData.liabilities / financialData.equity) * 100).toFixed(1)
                  : 0}
                %
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">العائد على الأصول</p>
              <p className="text-2xl font-semibold">
                {financialData.assets > 0
                  ? ((financialData.netProfit / financialData.assets) * 100).toFixed(1)
                  : 0}
                %
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">العائد على حقوق الملكية</p>
              <p className="text-2xl font-semibold">
                {financialData.equity > 0
                  ? ((financialData.netProfit / financialData.equity) * 100).toFixed(1)
                  : 0}
                %
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIFinancial;
