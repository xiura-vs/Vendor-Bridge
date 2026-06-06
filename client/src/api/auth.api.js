import api from './axios';

export const loginAPI = (data) => api.post('/auth/login', data);
export const registerAPI = (data) => api.post('/auth/register', data);
export const forgotPasswordAPI = (email) => api.post('/auth/forgot-password', { email });
export const resetPasswordAPI = (token, new_password) => api.post(`/auth/reset-password/${token}`, { new_password });
export const getMeAPI = () => api.get('/auth/me');