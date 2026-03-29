const BASE_URL = "https://location-tracker-epqf.onrender.com";

export const API_BASE_URL = `${BASE_URL}/api`;
export const SOCKET_URL = BASE_URL;

export const ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
    LOGOUT: `${API_BASE_URL}/auth/logout`,
    ME: `${API_BASE_URL}/auth/me`,
  },
  SESSION: {
    CREATE: `${API_BASE_URL}/sessions/create`,
    VERIFY: (code) => `${API_BASE_URL}/sessions/verify/${code}`,
    STOP: (code) => `${API_BASE_URL}/sessions/stop/${code}`,
  }
};
