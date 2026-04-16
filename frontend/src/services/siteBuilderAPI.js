import axios from 'axios';
import { API_BASE } from './api';

export const siteBuilderAPI = {
  getCustomization: (params) => axios.get(`${API_BASE}/alkabeer-bot/customization`, { params }),
  saveCustomization: (payload) => axios.put(`${API_BASE}/alkabeer-bot/customization`, payload),
  getEditorDraft: (params) => axios.get(`${API_BASE}/alkabeer-bot/editor/draft`, { params }),
  saveEditorDraft: (payload) => axios.post(`${API_BASE}/alkabeer-bot/editor/draft/save`, payload),
  publishEditorDraft: (payload) => axios.post(`${API_BASE}/alkabeer-bot/editor/publish`, payload),
  getEditorHistory: (params) => axios.get(`${API_BASE}/alkabeer-bot/editor/history`, { params }),
  getEditorComments: (params) => axios.get(`${API_BASE}/alkabeer-bot/editor/comments`, { params }),
  addEditorComment: (payload) => axios.post(`${API_BASE}/alkabeer-bot/editor/comments`, payload),
  updateEditorComment: (commentId, payload) => axios.put(`${API_BASE}/alkabeer-bot/editor/comments/${commentId}`, payload),
  deleteEditorComment: (commentId) => axios.delete(`${API_BASE}/alkabeer-bot/editor/comments/${commentId}`),
};