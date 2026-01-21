import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AutoProfitDashboard = () => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  const [stats, setStats] = useState({
    revenue: 0,
    expenses: 0,
    cash: 50000,
    customers: 0
  });
  
  const [operations, setOperations] = useState([]);
  const [topServices, setTopServices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all');
  
  const [formData, setFormData] = useState({
    type: 'sale',
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    paymentMethod: 'cash'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [balanceRes, topRes, opsRes] = await Promise.all([
        axios.get(`${API_URL}/accounts-chart/balance-sheet/summary`),
        axios.get(`${API_URL}/analytics-advanced/top-performers?days=30`),
        axios.get(`${API_URL}/operations`).catch(() => ({ data: [] }))
      ]);
      
      setStats({
        revenue: balanceRes.data.revenue || 0,
        expenses: balanceRes.data.expenses || 0,
        cash: balanceRes.data.assets || 50000,
        customers: 15
      });
      
      setTopServices(topRes.data.top_services || []);
      setOperations(Array.isArray(opsRes.data) ? opsRes.data.slice(0, 10) : []);
      
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const filteredOps = filter === 'all' 
    ? operations 
    : operations.filter(op => op.type === filter);

  const getOperationBadge = (type) => {
    const badges = {
      sale: { class: 'badge-sale', label: 'بيع' },
      purchase: { class: 'badge-purchase', label: 'شراء' },
      expense: { class: 'badge-expense', label: 'مصروف' },
      collection: { class: 'badge-collection', label: 'تحصيل' }
    };
    return badges[type] || { class: '', label: type };
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, Noto Sans Arabic, sans-serif', backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
      <style>{`
        .dashboard-card {
          border-radius: 10px;
          transition: transform 0.3s, box-shadow 0.3s;
          border: none;
          height: 100%;
        }
        
        .dashboard-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        
        .stat-number {
          font-size: 2.5rem;
          font-weight: bold;
        }
        
        .profit { color: #27ae60; }
        .loss { color: #e74c3c; }
        
        .operation-badge {
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 0.8rem;
        }
        
        .badge-sale { background-color: #d4edda; color: #155724; }
        .badge-purchase { background-color: #d1ecf1; color: #0c5460; }
        .badge-expense { background-color: #f8d7da; color: #721c24; }
        .badge-collection { background-color: #fff3cd; color: #856404; }
      `}</style>
      
      <div className="p-4">
        {/* العنوان */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="mb-0">🚗 AutoProfit Pro</h2>
            <p className="text-muted mb-0">نظام إدارة مالي ذكي لورش صيانة السيارات</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            ➕ عملية جديدة
          </button>
        </div>
        
        {/* بطاقات الإحصائيات */}
        <div className="row g-4 mb-4">
          <div className="col-md-3">
            <div className="card dashboard-card border-success">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="text-muted">الإيرادات</h6>
                    <h3 className="stat-number profit">{stats.revenue.toLocaleString()}</h3>
                    <small className="text-muted">ر.س</small>
                  </div>
                  <div style={{ fontSize: '3rem' }}>💰</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card dashboard-card border-danger">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="text-muted">المصروفات</h6>
                    <h3 className="stat-number loss">{stats.expenses.toLocaleString()}</h3>
                    <small className="text-muted">ر.س</small>
                  </div>
                  <div style={{ fontSize: '3rem' }}>💸</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card dashboard-card border-info">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="text-muted">الأصول</h6>
                    <h3 className="stat-number text-info">{stats.cash.toLocaleString()}</h3>
                    <small className="text-muted">ر.س</small>
                  </div>
                  <div style={{ fontSize: '3rem' }}>🏦</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card dashboard-card border-warning">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="text-muted">صافي الربح</h6>
                    <h3 className={`stat-number ${stats.revenue - stats.expenses >= 0 ? 'profit' : 'loss'}`}>
                      {(stats.revenue - stats.expenses).toLocaleString()}
                    </h3>
                    <small className="text-muted">ر.س</small>
                  </div>
                  <div style={{ fontSize: '3rem' }}>📊</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* أفضل الخدمات والعمليات */}
        <div className="row g-4 mb-4">
          <div className="col-lg-8">
            <div className="card">
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0">🔄 أحدث العمليات</h5>
                <div className="btn-group btn-group-sm">
                  <button className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setFilter('all')}>الكل</button>
                  <button className={`btn ${filter === 'sale' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setFilter('sale')}>مبيعات</button>
                  <button className={`btn ${filter === 'purchase' ? 'btn-info' : 'btn-outline-info'}`} onClick={() => setFilter('purchase')}>مشتريات</button>
                  <button className={`btn ${filter === 'expense' ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setFilter('expense')}>مصروفات</button>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="bg-light">
                      <tr>
                        <th>التاريخ</th>
                        <th>النوع</th>
                        <th>الوصف</th>
                        <th className="text-end">المبلغ</th>
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOps.length > 0 ? filteredOps.map((op, idx) => {
                        const badge = getOperationBadge(op.type);
                        return (
                          <tr key={idx}>
                            <td>{new Date(op.date || op.createdAt).toLocaleDateString('ar-SA')}</td>
                            <td><span className={`operation-badge ${badge.class}`}>{badge.label}</span></td>
                            <td>{op.description}</td>
                            <td className="text-end fw-bold">{(op.total || op.amount || 0).toLocaleString()} ر.س</td>
                            <td><span className="badge bg-success">مكتمل</span></td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan="5" className="text-center text-muted py-4">
                            لا توجد عمليات حالياً
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-lg-4">
            <div className="card">
              <div className="card-header bg-white">
                <h5 className="mb-0">🏆 أفضل الخدمات</h5>
              </div>
              <div className="card-body">
                <ul className="list-group list-group-flush">
                  {topServices.length > 0 ? topServices.map((service, idx) => (
                    <li key={idx} className="list-group-item d-flex justify-content-between align-items-center px-0">
                      <div>
                        <strong>{service.name}</strong>
                        <br />
                        <small className="text-muted">{service.count} عملية</small>
                      </div>
                      <span className="badge bg-success rounded-pill fs-6">{service.revenue.toLocaleString()} ر.س</span>
                    </li>
                  )) : (
                    <li className="list-group-item text-center text-muted">لا توجد بيانات</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoProfitDashboard;
