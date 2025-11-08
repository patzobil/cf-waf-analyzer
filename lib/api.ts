import { 
  Summary, 
  EventsQuery
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem('auth_token') || process.env.NEXT_PUBLIC_AUTH_TOKEN
    : process.env.NEXT_PUBLIC_AUTH_TOKEN;
  
  const headers = new Headers(options.headers);
  
  // Only set Content-Type for JSON requests (not for FormData)
  if (!(options.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }
  
  // Add Authorization header if token is available
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  return response.json();
}

export const api = {
  // Upload endpoints
  async uploadFiles(files: File[]) {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    
    return fetchAPI('/upload', {
      method: 'POST',
      // Don't set Content-Type header - browser will set it with boundary for multipart/form-data
      body: formData,
    });
  },

  // Events endpoints
  async getEvents(query: EventsQuery) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    
    return fetchAPI(`/events?${params}`);
  },

  // Summary endpoint
  async getSummary(startTime?: number, endTime?: number): Promise<Summary> {
    const params = new URLSearchParams();
    if (startTime) params.append('start_time', startTime.toString());
    if (endTime) params.append('end_time', endTime.toString());
    
    return fetchAPI(`/summary?${params}`);
  },

  // Trends endpoint
  async getTrends(startTime?: number, endTime?: number, bucket?: string) {
    const params = new URLSearchParams();
    if (startTime) params.append('start_time', startTime.toString());
    if (endTime) params.append('end_time', endTime.toString());
    if (bucket) params.append('bucket', bucket);
    
    return fetchAPI(`/trends?${params}`);
  },

  // Top endpoints
  async getTopRules(limit?: number, startTime?: number, endTime?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (startTime) params.append('start_time', startTime.toString());
    if (endTime) params.append('end_time', endTime.toString());
    
    return fetchAPI(`/rules/top?${params}`);
  },

  async getTopIPs(limit?: number, startTime?: number, endTime?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (startTime) params.append('start_time', startTime.toString());
    if (endTime) params.append('end_time', endTime.toString());
    
    return fetchAPI(`/ips/top?${params}`);
  },

  async getTopPaths(limit?: number, startTime?: number, endTime?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (startTime) params.append('start_time', startTime.toString());
    if (endTime) params.append('end_time', endTime.toString());
    
    return fetchAPI(`/paths/top?${params}`);
  },

  // Reindex endpoint
  async reindex(checksum?: string, fileId?: number) {
    return fetchAPI('/reindex', {
      method: 'POST',
      body: JSON.stringify({ checksum, file_id: fileId }),
    });
  },
};
