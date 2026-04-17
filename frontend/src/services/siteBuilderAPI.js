import axios from 'axios';

export const siteBuilderAPI = {
  getCustomization: (params) => axios.get('/api/alkabeer-bot/customization', { params }),
  saveCustomization: (payload) => axios.put('/api/alkabeer-bot/customization', payload),
  getEditorDraft: (params) => axios.get('/api/alkabeer-bot/editor/draft', { params }),
  saveEditorDraft: (payload) => axios.post('/api/alkabeer-bot/editor/draft/save', payload),
  publishEditorDraft: (payload) => axios.post('/api/alkabeer-bot/editor/publish', payload),
  getEditorHistory: (params) => axios.get('/api/alkabeer-bot/editor/history', { params }),
  getEditorComments: (params) => axios.get('/api/alkabeer-bot/editor/comments', { params }),
  addEditorComment: (payload) => axios.post('/api/alkabeer-bot/editor/comments', payload),
  updateEditorComment: (commentId, payload) => axios.put(`/api/alkabeer-bot/editor/comments/${commentId}`, payload),
  deleteEditorComment: (commentId) => axios.delete(`/api/alkabeer-bot/editor/comments/${commentId}`),
};