import axios from 'axios';
import { API_BASE } from './api';

export const siteBuilderAPI = {
  getCustomization: (params) => axios.get(`${API_BASE}/alkabeer-bot/customization`, { params }),
  saveCustomization: (payload) => axios.put(`${API_BASE}/alkabeer-bot/customization`, payload),
};