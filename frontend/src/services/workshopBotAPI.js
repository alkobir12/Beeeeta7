import axios from 'axios';
import { resolveBackendBase } from './api';

const API_URL = `${resolveBackendBase()}/api/workshop-bot`;

export const workshopBotAPI = {
  getModels: () => axios.get(`${API_URL}/models`),
  getEngines: () => axios.get(`${API_URL}/engines`),
  getSummary: () => axios.get(`${API_URL}/catalog/summary`),
  getSkills: (params) => axios.get(`${API_URL}/skills`, { params }),
  getSkill: (skillId) => axios.get(`${API_URL}/skills/${skillId}`),
  getConversations: (params) => axios.get(`${API_URL}/conversations`, { params }),
  getConversation: (sessionId) => axios.get(`${API_URL}/conversations/${sessionId}`),
  deleteConversation: (sessionId) => axios.delete(`${API_URL}/conversations/${sessionId}`),
  respond: (payload) => axios.post(`${API_URL}/respond`, payload),
};