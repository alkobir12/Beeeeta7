import axios from 'axios';

const API_BASE = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

const api = axios.create({
  baseURL: API_BASE,
});



const authAPI = {
  requestOtp: (phone) => axios.post(`${API_BASE}/auth/request-otp`, { phone }),
  verifyOtp: (payload) => axios.post(`${API_BASE}/auth/verify-otp`, payload),
};

const userAPI = {
  list: () => axios.get(`${API_BASE}/users`),
  create: (data) => axios.post(`${API_BASE}/users`, data),
  update: (id, data) => axios.put(`${API_BASE}/users/${id}`, data),
  remove: (id) => axios.delete(`${API_BASE}/users/${id}`)
};

const vehicleAPI = {
  getAll: () => axios.get(`${API_BASE}/vehicles`),
  getById: (id) => axios.get(`${API_BASE}/vehicles/${id}`),
  create: (data) => axios.post(`${API_BASE}/vehicles`, data),
  update: (id, data) => axios.put(`${API_BASE}/vehicles/${id}`, data),
  delete: (id) => axios.delete(`${API_BASE}/vehicles/${id}`),
  track: (trackingId) => axios.get(`${API_BASE}/vehicles/track/${trackingId}`)
};

const customerAPI = {
  getAll: () => axios.get(`${API_BASE}/customers`),
  getById: (id) => axios.get(`${API_BASE}/customers/${id}`),
  create: (data) => axios.post(`${API_BASE}/customers`, data),
  update: (id, data) => axios.put(`${API_BASE}/customers/${id}`, data),
  delete: (id) => axios.delete(`${API_BASE}/customers/${id}`),
  getHistory: (id) => axios.get(`${API_BASE}/customers/${id}/history`),
  getApprovals: (id) => axios.get(`${API_BASE}/customers/${id}/approvals`),

};

const technicianAPI = {
  getAll: () => axios.get(`${API_BASE}/technicians`),
  getById: (id) => axios.get(`${API_BASE}/technicians/${id}`),
  create: (data) => axios.post(`${API_BASE}/technicians`, data),
  update: (id, data) => axios.put(`${API_BASE}/technicians/${id}`, data),
  delete: (id) => axios.delete(`${API_BASE}/technicians/${id}`)
};

const serviceAPI = {
  getAll: () => axios.get(`${API_BASE}/services`),
  getById: (id) => axios.get(`${API_BASE}/services/${id}`),
  create: (data) => axios.post(`${API_BASE}/services`, data),
  update: (id, data) => axios.put(`${API_BASE}/services/${id}`, data),
  delete: (id) => axios.delete(`${API_BASE}/services/${id}`)
};

const aiAPI = {
  // مساعد الذكاء الشامل (RAG + Claude)
  chat: (data) => axios.post(`${API_BASE}/ai/enhanced-chat`, data),
  searchSolutions: (query) => axios.get(`${API_BASE}/ai/search-solutions`, { params: { query } }),

  // مساعد الورشة المتخصص (CarWorkshopAI + Genspark)
  workshopInfo: () => axios.get(`${API_BASE}/ai/workshop/info`),
  workshopDiagnose: (payload) => axios.post(`${API_BASE}/ai/workshop/diagnose`, payload),
  workshopSearchTechnical: (payload) => axios.post(`${API_BASE}/ai/workshop/search-technical`, payload),
  workshopAppointment: (payload) => axios.post(`${API_BASE}/ai/workshop/appointment`, payload),
  workshopServiceReport: (payload) => axios.post(`${API_BASE}/ai/workshop/service-report`, payload),

  // التحليل المالي بالذكاء الاصطناعي
  financialAnalysis: (payload) => api.post('/ai/financial-analysis', payload),
};

const partAPI = {
  getAll: () => axios.get(`${API_BASE}/parts`),
  getById: (id) => axios.get(`${API_BASE}/parts/${id}`),
  create: (data) => axios.post(`${API_BASE}/parts`, data),
  update: (id, data) => axios.put(`${API_BASE}/parts/${id}`, data),
  delete: (id) => axios.delete(`${API_BASE}/parts/${id}`)
};

const fileAPI = {
  upload: (formData) => axios.post(`${API_BASE}/files/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};

const statsAPI = {
  getStats: () => axios.get(`${API_BASE}/stats`),
};

const transactionAPI = {
  getAll: () => axios.get(`${API_BASE}/transactions`),
  create: (data) => axios.post(`${API_BASE}/transactions`, data)
};

const operationsAPI = {
  list: (params) => axios.get(`${API_BASE}/operations`, { params }),
  create: (data) => axios.post(`${API_BASE}/operations`, data),
};

const financeAPI = {
  getIncomeStatement: (params) => api.get('/finance/reports/income-statement', { params }),
  getBalanceSheet: (params) => api.get('/finance/reports/balance-sheet', { params }),
  getCashFlow: (params) => api.get('/finance/reports/cash-flow', { params }),
  getTrialBalance: (params) => api.get('/finance/reports/trial-balance', { params }),
  getInvoices: (params) => api.get('/v1/accounting/invoices', { params }),
  getJournalEntries: (params) => api.get('/finance/journal-entries', { params }),
  createJournalEntry: (data) =>
    api.post('/v1/accounting/journal-entries', data, {
      params: { workshop_id: process.env.REACT_APP_WORKSHOP_ID },
    }),
  getChartOfAccounts: () =>
    api.get('/finance/chart-of-accounts', {
      params: { workshop_id: process.env.REACT_APP_WORKSHOP_ID },
    }),
  getOperations: (params) => api.get('/finance/operations', { params }),
};

export { 
  authAPI, 
  userAPI, 
  vehicleAPI, 
  customerAPI, 
  technicianAPI, 
  serviceAPI, 
  aiAPI, 
  partAPI, 
  fileAPI, 
  statsAPI, 
  transactionAPI,
  operationsAPI,
  financeAPI,
  api,
};

export default { 
  auth: authAPI, 
  user: userAPI, 
  vehicle: vehicleAPI, 
  customer: customerAPI, 
  technician: technicianAPI, 
  service: serviceAPI, 
  ai: aiAPI, 
  part: partAPI, 
  file: fileAPI, 
  stats: statsAPI, 
  transaction: transactionAPI 
};
