import axios from 'axios';

const API_BASE = `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api');

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
  chat: (data) => axios.post(`${API_BASE}/ai/enhanced-chat`, data),
  searchSolutions: (query) => axios.get(`${API_BASE}/ai/search-solutions`, { params: { query } })
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
  getRevenue: () => axios.get(`${API_BASE}/stats/revenue`)
};

const transactionAPI = {
  getAll: () => axios.get(`${API_BASE}/transactions`),
  create: (data) => axios.post(`${API_BASE}/transactions`, data)
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
  transactionAPI 
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
