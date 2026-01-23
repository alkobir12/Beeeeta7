import React, { useState } from 'react';
import { 
  Brain, 
  Send, 
  RefreshCw, 
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  DollarSign,
  Target,
  CheckCircle
} from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

// Sample financial data for AI analysis
const FINANCIAL_DATA = {
  revenue: 528000,
  expenses: 465000,
  net_income: 63000,
  gross_margin: 75.4,
  net_margin: 11.9,
  current_ratio: 3.28,
  quick_ratio: 2.29,
  debt_to_equity: 0.53,
  inventory_turnover: 1.66,
  receivables_turnover: 11.73,
  assets: 500500,
  liabilities: 173500,
  equity: 327000,
  cash: 125000,
  receivables: 45000,
  inventory: 78500,
  payables: 35000,
};

export default function AIFinancial() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('chat');

  const sampleQueries = [
    'ما هي أهم نقاط القوة والضعف في الوضع المالي؟',
    'كيف يمكن تحسين هامش الربح؟',
    'هل هناك مخاطر مالية يجب الانتباه لها؟',
    'قارن أدائنا المالي بالمعايير الصناعية',
    'ما هي التوصيات لزيادة التدفق النقدي؟',
  ];

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    const userMessage = { role: 'user', content: query };
    setChatHistory(prev => [...prev, userMessage]);

    try {
      const response = await axios.post(`${API_URL}/ai/financial-analysis`, {
        query,
        financial_data: FINANCIAL_DATA,
      });

      const aiMessage = {
        role: 'assistant',
        content: response.data.analysis || generateMockAnalysis(query),
      };
      setChatHistory(prev => [...prev, aiMessage]);
    } catch (error) {
      // Fallback to mock analysis if API fails
      const mockResponse = {
        role: 'assistant',
        content: generateMockAnalysis(query),
      };
      setChatHistory(prev => [...prev, mockResponse]);
    } finally {
      setLoading(false);
      setQuery('');
    }
  };

  const generateMockAnalysis = (question) => {
    const analyses = {
      default: `
## تحليل الوضع المالي 📊

بناءً على البيانات المالية المتاحة، إليك تحليلي:

### نقاط القوة ✅
- **هامش ربح إجمالي قوي** (${FINANCIAL_DATA.gross_margin}%): يدل على كفاءة في إدارة تكاليف المبيعات
- **نسبة سيولة ممتازة** (${FINANCIAL_DATA.current_ratio}): الأصول المتداولة تغطي الالتزامات قصيرة الأجل بأكثر من 3 مرات
- **مستوى ديون منخفض** (نسبة الدين إلى حقوق الملكية ${FINANCIAL_DATA.debt_to_equity}): استقرار مالي جيد

### نقاط تحتاج انتباه ⚠️
- **هامش صافي الربح** (${FINANCIAL_DATA.net_margin}%): يمكن تحسينه من خلال ضبط المصاريف التشغيلية
- **معدل دوران المخزون** (${FINANCIAL_DATA.inventory_turnover}): يُنصح بمراجعة مستويات المخزون

### التوصيات 💡
1. مراجعة تكاليف الرواتب والمصاريف الإدارية
2. تحسين إدارة المخزون لتقليل التكاليف
3. النظر في زيادة الأسعار بشكل تدريجي
4. تعزيز جهود التحصيل لتحسين السيولة
      `,
      profit: `
## تحليل الربحية 💰

### الوضع الحالي
- الإيرادات: ${new Intl.NumberFormat('ar-SA').format(FINANCIAL_DATA.revenue)} ريال
- المصروفات: ${new Intl.NumberFormat('ar-SA').format(FINANCIAL_DATA.expenses)} ريال
- صافي الربح: ${new Intl.NumberFormat('ar-SA').format(FINANCIAL_DATA.net_income)} ريال

### فرص التحسين 🎯
1. **تخفيض تكاليف المشتريات**: التفاوض مع الموردين للحصول على أسعار أفضل
2. **زيادة كفاءة العمالة**: تدريب الفنيين لزيادة الإنتاجية
3. **تحسين التسعير**: مراجعة أسعار الخدمات مقارنة بالمنافسين
4. **تقليل الهدر**: تطبيق نظام صارم لإدارة المخزون

### التوقعات 📈
بتطبيق هذه التوصيات، يمكن زيادة هامش الربح بنسبة 3-5% خلال 6 أشهر.
      `,
      risk: `
## تحليل المخاطر المالية ⚠️

### المخاطر المحددة

#### 1. مخاطر السيولة 🔵 (منخفضة)
- نسبة السيولة الحالية ممتازة (${FINANCIAL_DATA.current_ratio})
- النقدية المتاحة كافية للعمليات اليومية

#### 2. مخاطر الائتمان 🟡 (متوسطة)
- الذمم المدينة: ${new Intl.NumberFormat('ar-SA').format(FINANCIAL_DATA.receivables)} ريال
- يُنصح بمتابعة التحصيل بشكل دوري

#### 3. مخاطر التشغيل 🟡 (متوسطة)
- الاعتماد الكبير على الرواتب (34% من المصروفات)
- تركز الإيرادات في خدمات الصيانة

#### 4. مخاطر السوق 🟢 (منخفضة)
- التنوع في مصادر الإيرادات جيد
- قاعدة عملاء متنوعة

### التوصيات للحد من المخاطر 🛡️
1. إنشاء صندوق طوارئ (3-6 أشهر من المصروفات)
2. تنويع قاعدة العملاء
3. تطوير خدمات جديدة لزيادة مصادر الدخل
      `,
    };

    if (question.includes('ربح') || question.includes('هامش')) {
      return analyses.profit;
    } else if (question.includes('مخاطر') || question.includes('خطر')) {
      return analyses.risk;
    }
    return analyses.default;
  };

  const runQuickAnalysis = async () => {
    setLoading(true);
    setActiveTab('analysis');
    
    try {
      // Simulate AI analysis
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setAnalysis({
        overall_score: 78,
        summary: 'الوضع المالي للورشة جيد مع وجود فرص للتحسين',
        strengths: [
          'نسبة سيولة عالية تضمن استمرارية العمليات',
          'هامش ربح إجمالي يفوق المتوسط الصناعي',
          'مستوى ديون منخفض يوفر مرونة مالية',
          'تنوع في مصادر الإيرادات',
        ],
        weaknesses: [
          'هامش صافي الربح يمكن تحسينه',
          'معدل دوران المخزون أقل من المثالي',
          'نسبة المصاريف الإدارية مرتفعة نسبياً',
        ],
        recommendations: [
          { priority: 'high', text: 'تحسين إدارة المخزون لتقليل التكاليف' },
          { priority: 'high', text: 'مراجعة وتخفيض المصاريف الإدارية' },
          { priority: 'medium', text: 'زيادة جهود التسويق لتنمية الإيرادات' },
          { priority: 'medium', text: 'تطوير برنامج ولاء العملاء' },
          { priority: 'low', text: 'استكشاف فرص التوسع الجغرافي' },
        ],
        kpis: [
          { name: 'هامش الربح الإجمالي', value: '75.4%', status: 'good', benchmark: '60-70%' },
          { name: 'هامش صافي الربح', value: '11.9%', status: 'average', benchmark: '15-20%' },
          { name: 'نسبة السيولة', value: '3.28', status: 'excellent', benchmark: '1.5-2.0' },
          { name: 'نسبة الدين', value: '0.53', status: 'good', benchmark: '< 1.0' },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="ai-financial-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="text-purple-500" />
            التحليل المالي الذكي
          </h1>
          <p className="text-gray-400">احصل على رؤى وتوصيات مدعومة بالذكاء الاصطناعي</p>
        </div>

        <button
          onClick={runQuickAnalysis}
          disabled={loading}
          className="mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="animate-spin" size={20} />
          ) : (
            <Sparkles size={20} />
          )}
          <span>تحليل شامل</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'chat'
              ? 'bg-gray-800 text-white border-b-2 border-purple-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          💬 محادثة ذكية
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'analysis'
              ? 'bg-gray-800 text-white border-b-2 border-purple-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          📊 تقرير التحليل
        </button>
      </div>

      {activeTab === 'chat' && (
        <div className="space-y-4">
          {/* Quick Questions */}
          <div className="flex flex-wrap gap-2">
            {sampleQueries.map((q, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(q);
                }}
                className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-full text-sm hover:bg-gray-700 transition-colors border border-gray-700"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Chat History */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 min-h-[400px] max-h-[500px] overflow-y-auto p-4">
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Brain className="text-purple-500 mb-4" size={48} />
                <p className="text-gray-400 mb-2">مرحباً! أنا مساعدك المالي الذكي</p>
                <p className="text-gray-500 text-sm">اسألني عن أي شيء يتعلق بالوضع المالي للورشة</p>
              </div>
            ) : (
              <div className="space-y-4">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl p-4 ${
                        msg.role === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-100'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <div dangerouslySetInnerHTML={{ 
                            __html: msg.content
                              .replace(/^## /gm, '<h3 class="text-lg font-bold text-white mt-4 mb-2">')
                              .replace(/^### /gm, '<h4 class="text-base font-semibold text-gray-200 mt-3 mb-1">')
                              .replace(/^#### /gm, '<h5 class="text-sm font-medium text-gray-300 mt-2">')
                              .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                              .replace(/^- /gm, '• ')
                              .replace(/\n/g, '<br/>')
                          }} />
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-700 rounded-xl p-4 flex items-center gap-2">
                      <RefreshCw className="animate-spin text-purple-400" size={16} />
                      <span className="text-gray-300">جارٍ التحليل...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="اسأل عن الوضع المالي، التوصيات، المخاطر..."
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      )}

      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {analysis ? (
            <>
              {/* Score */}
              <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-xl p-6 border border-purple-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-bold text-lg mb-2">التقييم العام</h3>
                    <p className="text-gray-300">{analysis.summary}</p>
                  </div>
                  <div className="text-center">
                    <div className="text-5xl font-bold text-white">{analysis.overall_score}</div>
                    <div className="text-sm text-gray-400">من 100</div>
                  </div>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {analysis.kpis.map((kpi, idx) => (
                  <div key={idx} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-gray-400 text-sm mb-1">{kpi.name}</p>
                    <p className="text-2xl font-bold text-white">{kpi.value}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        kpi.status === 'excellent' ? 'bg-green-900/50 text-green-400' :
                        kpi.status === 'good' ? 'bg-blue-900/50 text-blue-400' :
                        'bg-yellow-900/50 text-yellow-400'
                      }`}>
                        {kpi.status === 'excellent' ? 'ممتاز' : kpi.status === 'good' ? 'جيد' : 'متوسط'}
                      </span>
                      <span className="text-xs text-gray-500">المعيار: {kpi.benchmark}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  <div className="bg-green-900/30 px-4 py-3 flex items-center gap-2">
                    <TrendingUp className="text-green-400" size={20} />
                    <h3 className="font-bold text-green-400">نقاط القوة</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {analysis.strengths.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <CheckCircle className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                        <span className="text-gray-300 text-sm">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  <div className="bg-orange-900/30 px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="text-orange-400" size={20} />
                    <h3 className="font-bold text-orange-400">نقاط الضعف</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {analysis.weaknesses.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <TrendingDown className="text-orange-400 mt-0.5 flex-shrink-0" size={16} />
                        <span className="text-gray-300 text-sm">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="bg-blue-900/30 px-4 py-3 flex items-center gap-2">
                  <Lightbulb className="text-blue-400" size={20} />
                  <h3 className="font-bold text-blue-400">التوصيات</h3>
                </div>
                <div className="p-4 space-y-3">
                  {analysis.recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        rec.priority === 'high' ? 'bg-red-900/50 text-red-400' :
                        rec.priority === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {rec.priority === 'high' ? 'عالية' : rec.priority === 'medium' ? 'متوسطة' : 'منخفضة'}
                      </span>
                      <span className="text-white">{rec.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
              <BarChart3 className="text-gray-600 mx-auto mb-4" size={48} />
              <p className="text-gray-400 mb-4">اضغط على "تحليل شامل" للحصول على تقرير مفصل</p>
              <button
                onClick={runQuickAnalysis}
                disabled={loading}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'جارٍ التحليل...' : 'بدء التحليل'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
