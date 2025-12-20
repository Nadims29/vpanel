import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth';

// API response type
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
  };
}

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Extended config type to track retry state
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as ExtendedAxiosRequestConfig | undefined;

    // Handle 401 Unauthorized - only retry once
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const authStore = useAuthStore.getState();
      
      // Try to refresh token only if we have one
      if (authStore.refreshToken) {
        originalRequest._retry = true; // Mark as retried to prevent infinite loop
        try {
          await authStore.refreshAuth();
          // Update the Authorization header with new token
          const newToken = useAuthStore.getState().token;
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          // Retry original request
          return api(originalRequest);
        } catch {
          // Refresh failed, logout
          authStore.logout();
        }
      } else {
        authStore.logout();
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// Extract error message from API response or AxiosError
function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiResponse>;
    const data = axiosError.response?.data;
    // Try to get message from response body (structured error)
    if (data?.error?.message) {
      return data.error.message;
    }
    // Fallback to status text
    if (axiosError.response?.statusText) {
      return axiosError.response.statusText;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Request failed';
}

// Helper functions
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  try {
    const response = await api.get<ApiResponse<T>>(url, { params });
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Request failed');
    }
    return response.data.data as T;
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  try {
    const response = await api.post<ApiResponse<T>>(url, data);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Request failed');
    }
    return response.data.data as T;
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}

export async function put<T>(url: string, data?: unknown): Promise<T> {
  try {
    const response = await api.put<ApiResponse<T>>(url, data);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Request failed');
    }
    return response.data.data as T;
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}

export async function del<T>(url: string): Promise<T> {
  try {
    const response = await api.delete<ApiResponse<T>>(url);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Request failed');
    }
    return response.data.data as T;
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}

