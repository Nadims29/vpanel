// VPanel Plugin SDK for JavaScript/TypeScript

// Types
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon?: string;
  category?: string;
  permissions?: string[];
  dependencies?: string[];
  menus?: MenuItem[];
  routes?: RouteDefinition[];
}

export interface MenuItem {
  id: string;
  title: string;
  icon?: string;
  path: string;
  order?: number;
  children?: MenuItem[];
  badge?: string;
  badgeVariant?: 'info' | 'warning' | 'error' | 'success';
}

export interface RouteDefinition {
  path: string;
  component: string;
  title?: string;
  permissions?: string[];
}

// API Client
export interface APIClientOptions {
  baseURL?: string;
  token?: string;
}

export class APIClient {
  private baseURL: string;
  private token?: string;

  constructor(options: APIClientOptions = {}) {
    this.baseURL = options.baseURL || '/api';
    this.token = options.token;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(method: string, path: string, data?: any): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseURL}${path}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, data?: any): Promise<T> {
    return this.request<T>('POST', path, data);
  }

  async put<T>(path: string, data?: any): Promise<T> {
    return this.request<T>('PUT', path, data);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

// Plugin Context
export interface PluginContext {
  pluginId: string;
  api: APIClient;
  navigate: (path: string) => void;
  showNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

// Plugin Base Class
export abstract class Plugin {
  protected context!: PluginContext;

  abstract id: string;
  abstract name: string;
  abstract version: string;

  initialize(context: PluginContext) {
    this.context = context;
  }

  get api() {
    return this.context.api;
  }

  navigate(path: string) {
    this.context.navigate(path);
  }

  notify(message: string, type?: 'success' | 'error' | 'warning' | 'info') {
    this.context.showNotification(message, type);
  }
}

// Hooks
import { useState, useEffect, useCallback } from 'react';

export function usePluginAPI<T>(
  fetcher: () => Promise<T>,
  dependencies: any[] = []
): { data: T | null; loading: boolean; error: Error | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// Export utilities
export { cn } from './utils';
