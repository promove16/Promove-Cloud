import axiosClient from '../../services/axiosClient';

export async function loginUser(email, password) {
  const response = await axiosClient.post('/auth/login', { email, password });
  return response.data;
}

export async function registerUser(name, email, password, role) {
  const response = await axiosClient.post('/auth/register', { name, email, password, role });
  return response.data;
}

export async function logoutUser() {
  const response = await axiosClient.post('/auth/logout');
  return response.data;
}

export async function refreshSession() {
  const response = await axiosClient.post('/auth/refresh');
  return response.data;
}

export async function forgotPassword(email) {
  const response = await axiosClient.post('/auth/forgot-password', { email });
  return response.data;
}

export async function resetPassword(token, newPassword) {
  const response = await axiosClient.post('/auth/reset-password', { token, newPassword });
  return response.data;
}

export async function verifyEmail(token) {
  const response = await axiosClient.get('/auth/verify-email', { params: { token } });
  return response.data;
}
