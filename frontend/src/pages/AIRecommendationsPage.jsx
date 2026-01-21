import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Lightbulb, TrendingUp, Package, Users, Wrench, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import { useTranslation } from 'react-i18next';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AIRecommendationsPage = () => {
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  const [recommendations, setRecommendations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [recsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/ai-recommendations`),
        axios.get(`${API_URL}/ai-recommendations/stats`)
      ]);
      
      setRecommendations(recsRes.data.recommendations || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type) => {
    const icons = {
      pricing: <TrendingUp size={20} />,
      inventory: <Package size={20} />,
      customer: <Users size={20} />,
      service: <Wrench size={20} />
    };
    return icons[type] || <Lightbulb size={20} />;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'border-red-500 bg-red-50',
      medium: 'border-yellow-500 bg-yellow-50',
      low: 'border-green-500 bg-green-50'
    };
    return colors[priority] || 'border-gray-300';
  };

  const filteredRecs = filter === 'all' 
    ? recommendations 
    : recommendations.filter(r => r.priority === filter);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isArabic ? '🤖 التوصيات الذكية' : '🤖 AI Recommendations'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isArabic ? 'توصيات مدعومة بالذكاء الاصطناعي لتحسين الأداء' : 'AI-powered recommendations'}
          </p>
        </div>
        <Button onClick={loadData} variant="outline">
          {isArabic ? '🔄 تحديث' : '🔄 Refresh'}
        </Button>
      </div>

      {/* إحصائيات */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{stats.by_priority?.high || 0}</p>
              <p className="text-sm text-red-700">{isArabic ? 'أولوية عالية' : 'High Priority'}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-yellow-600">{stats.by_priority?.medium || 0}</p>
              <p className="text-sm text-yellow-700">{isArabic ? 'أولوية متوسطة' : 'Medium Priority'}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{stats.by_priority?.low || 0}</p>
              <p className="text-sm text-green-700">{isArabic ? 'أولوية منخفضة' : 'Low Priority'}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.implemented_value?.toLocaleString()}</p>
              <p className="text-sm text-blue-700">{isArabic ? 'قيمة متوقعة (ر.س)' : 'Expected Value'}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* فلاتر */}
      <div className="flex gap-2">
        {['all', 'high', 'medium', 'low'].map(p => (
          <Button
            key={p}
            variant={filter === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(p)}
          >
            {p === 'all' ? (isArabic ? 'الكل' : 'All') : p}
          </Button>
        ))}
      </div>

      {/* قائمة التوصيات */}
      <div className="space-y-4">
        {filteredRecs.map((rec) => (
          <Card key={rec.id} className={`border-l-4 ${getPriorityColor(rec.priority)}`}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full ${rec.priority === 'high' ? 'bg-red-100 text-red-600' : rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>
                  {getIcon(rec.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{rec.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                      rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {rec.priority === 'high' ? '🔴 عالية' : rec.priority === 'medium' ? '🟡 متوسطة' : '🟢 منخفضة'}
                    </span>
                  </div>
                  
                  {(rec.current_value !== null || rec.recommended_value !== null) && (
                    <div className="mt-3 flex gap-4 text-sm">
                      {rec.current_value !== null && (
                        <div>
                          <span className="text-gray-500">{isArabic ? 'الحالي:' : 'Current:'}</span>
                          <span className="font-semibold ml-2">{rec.current_value}</span>
                        </div>
                      )}
                      {rec.recommended_value !== null && rec.recommended_value !== rec.current_value && (
                        <div>
                          <span className="text-gray-500">{isArabic ? 'المقترح:' : 'Recommended:'}</span>
                          <span className="font-semibold ml-2 text-blue-600">{rec.recommended_value}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>{isArabic ? '💡 التأثير المتوقع:' : '💡 Expected Impact:'}</strong> {rec.expected_impact}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRecs.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <Lightbulb size={48} className="mx-auto mb-4 opacity-20" />
            <p>{isArabic ? 'لا توجد توصيات حالياً' : 'No recommendations at the moment'}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIRecommendationsPage;
