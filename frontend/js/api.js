/* Shared API helper + auth-state utilities used across all pages. */

const API_BASE = '/api';

const Auth = {
  getToken() { return localStorage.getItem('aims_token'); },
  getUser() {
    const raw = localStorage.getItem('aims_user');
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem('aims_token', token);
    localStorage.setItem('aims_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('aims_token');
    localStorage.removeItem('aims_user');
  },
  logout() {
    Auth.clear();
    window.location.href = 'index.html';
  },
  /** Redirects to login if not authenticated; if role given, enforces it. */
  requireRole(role) {
    const token = Auth.getToken();
    const user = Auth.getUser();
    if (!token || !user) {
      window.location.href = 'index.html';
      return null;
    }
    if (role && user.role !== role) {
      window.location.href = user.role === 'hr' ? 'hr.html' : 'employee.html';
      return null;
    }
    return user;
  },
};

async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }

  let data = {};
  try { data = await response.json(); } catch (_) { /* no body */ }

  if (response.status === 401) {
    Auth.clear();
    window.location.href = 'index.html';
    throw new Error(data.message || 'Session expired. Please log in again.');
  }
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status}).`);
  }
  return data;
}

/* ---------- Toast ---------- */
function toast(message, type = 'default') {
  let el = document.getElementById('__toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '__toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}
function pillClass(status) {
  return status ? status.replace(/\s+/g, '') : 'Absent';
}
