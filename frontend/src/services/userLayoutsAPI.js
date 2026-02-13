import axios from 'axios';

const API_URL = (
  process.env.NODE_ENV === 'production'
    ? '/api'
    : `${process.env.REACT_APP_BACKEND_URL || ''}/api`.replace('//api', '/api')
);

export const userLayoutsAPI = {
  getVehicleDetailsLayout: (userId) => axios.get(`${API_URL}/user-layouts/${userId}/vehicleDetails`),
  saveVehicleDetailsLayout: (userId, blocks) =>
    axios.put(`${API_URL}/user-layouts/${userId}/vehicleDetails`, {
      page: 'vehicleDetails',
      blocks,
    }),
};
