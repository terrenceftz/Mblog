import { reactive } from 'vue';

interface ToastItem { id: number; message: string; type: 'info' | 'success' | 'error' }

export const toasts = reactive<ToastItem[]>([]);
let seed = 0;

/** 轻提示：toast(message, type, duration?) */
export function toast(message: string, type: ToastItem['type'] = 'info', duration = 2600) {
  const id = ++seed;
  toasts.push({ id, message, type });
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id);
    if (i >= 0) toasts.splice(i, 1);
  }, duration);
}
