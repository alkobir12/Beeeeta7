import React, { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  FileDown, FileUp, Save, Printer, Grid3x3, Layout as LayoutIcon, 
  Eye, Trash2, Plus, Type, Image as ImageIcon, Table, QrCode
} from 'lucide-react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api','/api');

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const GRID_SIZE = 10;

const InvoiceTemplateStudioV2 = () => {
  // State Management
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [activeTab, setActiveTab] = useState('designer'); // designer | preview | grid
  const [loading, setLoading] = useState(false);

  // Designer State
  const [elements, setElements] = useState([]);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [zoom, setZoom] = useState(0.8);
  
  // Grid State
  const [grid, setGrid] = useState([]);
  const [mapping, setMapping] = useState({
    CUSTOMER_NAME: '',
    WORKSHOP_NAME: '',
    INVOICE_NO: '',
    DATE: '',
    TOTAL: ''
  });

  // File Upload
  const fileInputRef = useRef(null);

  // Load Templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/invoice-templates`);
      setTemplates(res.data || []);
    } catch (err) {
      console.error('خطأ في تحميل القوالب:', err);
    } finally {
      setLoading(false);
    }
  };

  // Create Blank Template
  const createBlankTemplate = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/invoice-templates/create-blank`, {
        name: 'قالب جديد',
        rows: 30,
        cols: 10
      });
      await loadTemplates();
      setSelectedTemplate(res.data);
      setElements(res.data.elements || []);
      setGrid(res.data.preview || []);
    } catch (err) {
      alert('❌ فشل إنشاء القالب: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Import from File
  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post(`${API_URL}/invoice-templates/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      await loadTemplates();
      setSelectedTemplate(res.data);
      alert('✅ تم الاستيراد بنجاح');
    } catch (err) {
      alert('❌ فشل الاستيراد: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save as Excel
  const saveAsExcel = async () => {
    if (!selectedTemplate) {
      alert('⚠️ اختر قالباً أولاً');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_URL}/invoice-templates/${selectedTemplate.id}/save-json`, {
        grid,
        mapping,
        items: { anchor: '{{ITEMS}}', columns: {} }
      });
      alert('✅ تم الحفظ بنجاح');
    } catch (err) {
      alert('❌ فشل الحفظ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate Invoice
  const generateInvoice = async () => {
    if (!selectedTemplate) {
      alert('⚠️ اختر قالباً أولاً');
      return;
    }

    try {
      setLoading(true);
      const sampleData = {
        WORKSHOP_NAME: 'ورشة الخليج للسيارات',
        CUSTOMER_NAME: 'عميل تجريبي',
        INVOICE_NO: 'INV-001',
        DATE: new Date().toLocaleDateString('ar-SA'),
        TOTAL: '1500.00',
        ITEMS: [
          { description: 'تغيير زيت المحرك', qty: 1, price: 200, total: 200 },
          { description: 'فلتر هواء', qty: 1, price: 50, total: 50 }
        ]
      };

      const res = await axios.post(`${API_URL}/print/invoice-xlsx`, {
        templateId: selectedTemplate.id,
        data: sampleData
      }, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      alert('✅ تم توليد الفاتورة');
    } catch (err) {
      alert('❌ فشل التوليد: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Template
  const deleteTemplate = async () => {
    if (!selectedTemplate) return;
    
    if (!window.confirm(`هل تريد حذف "${selectedTemplate.name}"؟`)) return;

    try {
      setLoading(true);
      await axios.delete(`${API_URL}/invoice-templates/${selectedTemplate.id}`);
      setSelectedTemplate(null);
      setElements([]);
      setGrid([]);
      await loadTemplates();
      alert('✅ تم الحذف');
    } catch (err) {
      alert('❌ فشل الحذف: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add Element
  const addElement = (type) => {
    const newElement = {
      id: `el-${Date.now()}`,
      type,
      x: 50,
      y: 50,
      w: 200,
      h: 40,
      text: type === 'text' ? 'نص جديد' : '',
      fontSize: 16,
      color: '#000000',
      binding: ''
    };
    setElements([...elements, newElement]);
    setSelectedElementId(newElement.id);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <LayoutIcon className="w-8 h-8" />
                استوديو تصميم الفواتير
              </h1>
              <p className="text-blue-100 text-sm">صمم فواتيرك الاحترافية بسهولة</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={createBlankTemplate}
                className="bg-white text-blue-600 hover:bg-blue-50"
                disabled={loading}
              >
                <Plus className="w-4 h-4 ml-2" />
                قالب جديد
              </Button>
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="bg-white/10 text-white border-white/30 hover:bg-white/20"
                disabled={loading}
              >
                <FileUp className="w-4 h-4 ml-2" />
                استيراد
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportFile}
              />
              
              <Button
                onClick={saveAsExcel}
                className="bg-green-500 hover:bg-green-600 text-white"
                disabled={!selectedTemplate || loading}
              >
                <Save className="w-4 h-4 ml-2" />
                حفظ
              </Button>
              
              <Button
                onClick={generateInvoice}
                className="bg-amber-500 hover:bg-amber-600 text-white"
                disabled={!selectedTemplate || loading}
              >
                <Printer className="w-4 h-4 ml-2" />
                توليد
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Templates List */}
          <div className="lg:col-span-1">
            <Card className="shadow-xl border-0">
              <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-t-lg">
                <CardTitle className="text-lg">القوالب المحفوظة</CardTitle>
              </CardHeader>
              <CardContent className="p-4 max-h-[600px] overflow-y-auto">
                {loading && (
                  <div className="text-center py-8 text-slate-500">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    جاري التحميل...
                  </div>
                )}
                
                {!loading && templates.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <FileDown className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">لا توجد قوالب</p>
                    <p className="text-xs mt-1">أنشئ قالباً جديداً للبدء</p>
                  </div>
                )}
                
                <div className="space-y-2">
                  {templates.map(template => (
                    <div
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplate(template);
                        setElements(template.elements || []);
                        setGrid(template.preview || []);
                      }}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedTemplate?.id === template.id
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold text-slate-800 mb-1">
                        {template.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {template.format?.toUpperCase()} • 
                        {template.elements?.length || 0} عنصر
                      </div>
                    </div>
                  ))}
                </div>
                
                {selectedTemplate && (
                  <Button
                    onClick={deleteTemplate}
                    variant="destructive"
                    className="w-full mt-4"
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4 ml-2" />
                    حذف القالب
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Area */}
          <div className="lg:col-span-3">
            {!selectedTemplate ? (
              <Card className="shadow-xl border-0">
                <CardContent className="p-12 text-center">
                  <LayoutIcon className="w-24 h-24 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-2xl font-bold text-slate-700 mb-2">
                    مرحباً بك في الاستوديو
                  </h3>
                  <p className="text-slate-500 mb-6">
                    اختر قالباً من القائمة أو أنشئ قالباً جديداً للبدء
                  </p>
                  <Button
                    onClick={createBlankTemplate}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    <Plus className="w-5 h-5 ml-2" />
                    إنشاء قالب جديد
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                  <Button
                    onClick={() => setActiveTab('designer')}
                    variant={activeTab === 'designer' ? 'default' : 'outline'}
                    className={activeTab === 'designer' ? 'bg-blue-600' : ''}
                  >
                    <LayoutIcon className="w-4 h-4 ml-2" />
                    المصمم
                  </Button>
                  <Button
                    onClick={() => setActiveTab('preview')}
                    variant={activeTab === 'preview' ? 'default' : 'outline'}
                    className={activeTab === 'preview' ? 'bg-blue-600' : ''}
                  >
                    <Eye className="w-4 h-4 ml-2" />
                    معاينة
                  </Button>
                  <Button
                    onClick={() => setActiveTab('grid')}
                    variant={activeTab === 'grid' ? 'default' : 'outline'}
                    className={activeTab === 'grid' ? 'bg-blue-600' : ''}
                  >
                    <Grid3x3 className="w-4 h-4 ml-2" />
                    الشبكة
                  </Button>
                </div>

                {/* Designer Tab */}
                {activeTab === 'designer' && (
                  <Card className="shadow-xl border-0">
                    <CardHeader className="bg-slate-50 border-b">
                      <div className="flex justify-between items-center">
                        <CardTitle>لوح التصميم</CardTitle>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => addElement('text')} variant="outline">
                            <Type className="w-4 h-4 ml-1" /> نص
                          </Button>
                          <Button size="sm" onClick={() => addElement('image')} variant="outline">
                            <ImageIcon className="w-4 h-4 ml-1" /> صورة
                          </Button>
                          <Button size="sm" onClick={() => addElement('table')} variant="outline">
                            <Table className="w-4 h-4 ml-1" /> جدول
                          </Button>
                          <Button size="sm" onClick={() => addElement('qr')} variant="outline">
                            <QrCode className="w-4 h-4 ml-1" /> QR
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="flex justify-center bg-slate-100 rounded-lg p-8">
                        <div
                          className="bg-white shadow-2xl relative"
                          style={{
                            width: A4_WIDTH * zoom,
                            height: A4_HEIGHT * zoom,
                            transform: `scale(1)`,
                            transformOrigin: 'top center'
                          }}
                        >
                          {/* Grid Background */}
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundImage: `
                                repeating-linear-gradient(0deg, transparent, transparent ${GRID_SIZE-1}px, rgba(59, 130, 246, 0.1) ${GRID_SIZE-1}px, rgba(59, 130, 246, 0.1) ${GRID_SIZE}px),
                                repeating-linear-gradient(90deg, transparent, transparent ${GRID_SIZE-1}px, rgba(59, 130, 246, 0.1) ${GRID_SIZE-1}px, rgba(59, 130, 246, 0.1) ${GRID_SIZE}px)
                              `,
                              backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`
                            }}
                          />
                          
                          {/* Elements */}
                          {elements.map(el => (
                            <div
                              key={el.id}
                              className={`absolute border-2 transition-all ${
                                selectedElementId === el.id
                                  ? 'border-blue-500 shadow-lg'
                                  : 'border-transparent hover:border-blue-300'
                              }`}
                              style={{
                                left: el.x * zoom,
                                top: el.y * zoom,
                                width: el.w * zoom,
                                height: el.h * zoom
                              }}
                              onClick={() => setSelectedElementId(el.id)}
                            >
                              {el.type === 'text' && (
                                <div className="p-2 text-sm">{el.text}</div>
                              )}
                              {el.type === 'image' && (
                                <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                                  <ImageIcon className="w-8 h-8 text-slate-400" />
                                </div>
                              )}
                              {el.type === 'table' && (
                                <div className="w-full h-full border">
                                  <div className="text-xs text-center p-2">جدول</div>
                                </div>
                              )}
                              {el.type === 'qr' && (
                                <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                                  <QrCode className="w-8 h-8 text-slate-400" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Preview Tab */}
                {activeTab === 'preview' && (
                  <Card className="shadow-xl border-0">
                    <CardHeader className="bg-slate-50 border-b">
                      <CardTitle>معاينة الطباعة</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="text-center py-12 text-slate-500">
                        <Eye className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>معاينة الفاتورة النهائية</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Grid Tab */}
                {activeTab === 'grid' && (
                  <Card className="shadow-xl border-0">
                    <CardHeader className="bg-slate-50 border-b">
                      <CardTitle>محرر الشبكة</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="overflow-auto">
                        <table className="w-full border-collapse">
                          <tbody>
                            {grid.map((row, i) => (
                              <tr key={i}>
                                {row.map((cell, j) => (
                                  <td key={j} className="border p-2 min-w-[100px]">
                                    <Input
                                      value={cell || ''}
                                      onChange={(e) => {
                                        const newGrid = [...grid];
                                        newGrid[i][j] = e.target.value;
                                        setGrid(newGrid);
                                      }}
                                      className="text-sm"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default InvoiceTemplateStudioV2;
