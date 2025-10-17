import axios from 'axios';

const API_BASE = (import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL) + '/api';

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

export { authAPI, userAPI };
export default { auth: authAPI, user: userAPI };
