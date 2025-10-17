import axios from 'axios';

const API_BASE = (import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL) + '/api';

const vehicleAPI = {
  async track(trackingId) {
    return axios.get(`${API_BASE}/vehicles/track/${trackingId}`);
  },
  async getAll() {
    return axios.get(`${API_BASE}/vehicles`);
  },
  async getById(id) {
    return axios.get(`${API_BASE}/vehicles/${id}`);
  },
  async create(data) {
    return axios.post(`${API_BASE}/vehicles`, data);
  },
  async update(id, data) {
    return axios.put(`${API_BASE}/vehicles/${id}`, data);
  },
  async delete(id) {
    return axios.delete(`${API_BASE}/vehicles/${id}`);
  }
};

const aiAPI = {
  async enhancedChat(payload){ return axios.post(`${API_BASE}/ai/enhanced-chat`, payload); },
  // Knowledge Base - generic docs
  async addDoc(payload){ return axios.post(`${API_BASE}/ai/kb/docs`, payload); },
  async searchDocs(query){ return axios.get(`${API_BASE}/ai/kb/search-docs`, { params: { query } }); },
  // Electrical KB
  async electricalIngest(payload){ return axios.post(`${API_BASE}/ai/kb/electrical/ingest`, payload); },
  async electricalSearch(query){ return axios.get(`${API_BASE}/ai/kb/electrical/search`, { params: { query } }); },
  async electricalQA(payload){ return axios.post(`${API_BASE}/ai/electrical/qa`, payload); },
  // Imports
  async importJson(items){ return axios.post(`${API_BASE}/ai/kb/import/json`, items); },
  async importCsv(formData){ return axios.post(`${API_BASE}/ai/kb/import/csv`, formData); },
};

const mediaAPI = {
  async init(filename, size, mimeType){ return axios.post(`${API_BASE}/media/upload/init`, { filename, size, mimeType }); },
  async chunk(uploadId, index, blob){ const form = new FormData(); form.append('uploadId', uploadId); form.append('index', index); form.append('chunk', blob); return axios.post(`${API_BASE}/media/upload/chunk`, form); },
  async complete(uploadId, totalChunks){ return axios.post(`${API_BASE}/media/upload/complete`, { uploadId, totalChunks }); },
  async list(){ return axios.get(`${API_BASE}/media/list`); }
};

const notificationAPI = {
  async prepare(payload){ return axios.post(`${API_BASE}/notifications/prepare`, payload); }
};

const statsAPI = {};

export { vehicleAPI };
export default {
  vehicle: vehicleAPI,
  ai: aiAPI,
  media: mediaAPI,
  notification: notificationAPI,
  stats: statsAPI
};
