import { ref } from 'vue';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
}

export const toasts = ref<ToastItem[]>([]);

export function addToast(
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  title?: string,
  duration = 3500
) {
  const id = Math.random().toString(36).substring(2, 9);
  const toast: ToastItem = { id, type, title, message };
  toasts.value.push(toast);

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }
}

export function removeToast(id: string) {
  const index = toasts.value.findIndex((t) => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
}

export const toast = {
  success: (msg: string, title?: string) => addToast(msg, 'success', title),
  error: (msg: string, title?: string) => addToast(msg, 'error', title),
  info: (msg: string, title?: string) => addToast(msg, 'info', title),
  warning: (msg: string, title?: string) => addToast(msg, 'warning', title),
};
