import { resolveBackendBase } from './backendBase';
export const resolveBackendBase = () => {
  const raw =
    (typeof process !== 'undefined' && process.env && resolveBackendBase()) || '';
  if (raw && /^https?:\/\//i.test(raw)) {
    return raw.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
};

export const API_BASE = `${resolveBackendBase()}/api`;