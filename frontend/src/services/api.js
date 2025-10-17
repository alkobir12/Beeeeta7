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

const customerAPI = {
  async getAll() {
    return axios.get(`${API_BASE}/customers`);
  },
  async getById(id) {
    return axios.get(`${API_BASE}/customers/${id}`);
  },
  async create(data) {
    return axios.post(`${API_BASE}/customers`, data);
  },
  async update(id, data) {
    return axios.put(`${API_BASE}/customers/${id}`, data);
  },
  async delete(id) {
    return axios.delete(`${API_BASE}/customers/${id}`);
  }
};

const technicianAPI = {
  async getAll() {
    return axios.get(`${API_BASE}/technicians`);
  },
  async getById(id) {
    return axios.get(`${API_BASE}/technicians/${id}`);
  },
  async create(data) {
    return axios.post(`${API_BASE}/technicians`, data);
  },
  async update(id, data) {
    return axios.put(`${API_BASE}/technicians/${id}`, data);
  }
};

const serviceAPI = {
  async getAll() {
    return axios.get(`${API_BASE}/services`);
  },
  async create(data) {
    return axios.post(`${API_BASE}/services`, data);
  },
  async update(id, data) {
    return axios.put(`${API_BASE}/services/${id}`, data);
  },
  async delete(id) {
    return axios.delete(`${API_BASE}/services/${id}`);
  }
};

const partAPI = {
  async getAll() {
    return axios.get(`${API_BASE}/parts`);
  },
  async create(data) {
    return axios.post(`${API_BASE}/parts`, data);
  },
  async update(id, data) {
    return axios.put(`${API_BASE}/parts/${id}`, data);
  }
};

const transactionAPI = {
  async getAll() {
    return axios.get(`${API_BASE}/transactions`);
  },
  async create(data) {
    return axios.post(`${API_BASE}/transactions`, data);
  }
};

const fileAPI = {
  async upload(formData) {
    return axios.post(`${API_BASE}/files/upload`, formData);
  }
};

const statsAPI = {
  async getStats() {
    return axios.get(`${API_BASE}/stats`);
  }
};

export { vehicleAPI, customerAPI, technicianAPI, serviceAPI, partAPI, transactionAPI, fileAPI, aiAPI, mediaAPI, notificationAPI, statsAPI };
export default {
  vehicle: vehicleAPI,
  customer: customerAPI,
  technician: technicianAPI,
  service: serviceAPI,
  part: partAPI,
  transaction: transactionAPI,
  file: fileAPI,
  ai: aiAPI,
  media: mediaAPI,
  notification: notificationAPI,
  stats: statsAPI
};
