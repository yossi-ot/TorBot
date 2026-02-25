const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('torbot_token');
}

export function setToken(token: string) {
  localStorage.setItem('torbot_token', token);
}

export function clearToken() {
  localStorage.removeItem('torbot_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

/** Decode JWT payload without verification (client-side) */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

let refreshing: Promise<void> | null = null;

/** Auto-refresh token if expiring within 7 days */
async function maybeRefreshToken(): Promise<void> {
  const token = getToken();
  if (!token) return;

  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return;

  const sevenDays = 7 * 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp - now > sevenDays) return; // Still fresh

  // Avoid concurrent refreshes
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) setToken(data.token);
      }
    } catch {
      // Silently fail - will retry on next request
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Auto-refresh token before making request (skip for auth endpoints)
  if (!path.startsWith('/auth/')) {
    await maybeRefreshToken();
  }

  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/dashboard/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  login: (email: string, password: string) => request<{ token: string }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  }),

  register: (data: { email: string; password: string; businessName: string; phone: string }) =>
    request<{ token: string; tenantId: string }>('/auth/register', {
      method: 'POST', body: JSON.stringify(data),
    }),

  // Appointments
  getAppointments: (params?: { status?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const q = qs.toString();
    return request<any[]>(`/appointments${q ? '?' + q : ''}`);
  },
  updateAppointment: (id: string, data: { status?: string; notes?: string }) =>
    request<{ ok: boolean }>(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Services
  getServices: () => request<any[]>('/services'),
  createService: (data: any) => request<any>('/services', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id: string, data: any) => request<any>(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteService: (id: string) => request<{ ok: boolean }>(`/services/${id}`, { method: 'DELETE' }),

  // Working Hours
  getWorkingHours: () => request<any[]>('/working-hours'),
  updateWorkingHours: (data: any[]) => request<any[]>('/working-hours', { method: 'PUT', body: JSON.stringify(data) }),

  // Blocked Slots
  getBlockedSlots: () => request<any[]>('/blocked-slots'),
  createBlockedSlot: (data: any) => request<any>('/blocked-slots', { method: 'POST', body: JSON.stringify(data) }),
  deleteBlockedSlot: (id: string) => request<{ ok: boolean }>(`/blocked-slots/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => request<any>('/settings'),
  updateSettings: (data: any) => request<{ ok: boolean }>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // WhatsApp Embedded Signup
  getWhatsAppConfig: () => request<{ appId: string; configId: string }>('/whatsapp/config'),
  connectWhatsApp: (data: { accessToken: string; wabaId: string; phoneNumberId: string }) =>
    request<{ ok: boolean }>('/whatsapp/connect', { method: 'POST', body: JSON.stringify(data) }),
  getWhatsAppStatus: () => request<{ connected: boolean; phoneNumberId: string | null; wabaId: string | null; daysUntilExpiry: number | null; tokenExpiring: boolean }>('/whatsapp/status'),
  disconnectWhatsApp: () => request<{ ok: boolean }>('/whatsapp/disconnect', { method: 'POST', body: '{}' }),

  // Admin
  getTenants: () => request<any[]>('/admin/tenants'),

  // Stats
  getStats: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const q = qs.toString();
    return request<any>(`/stats${q ? '?' + q : ''}`);
  },
};
