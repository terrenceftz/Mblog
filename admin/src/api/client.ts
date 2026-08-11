const BASE = '/api';
const TOKEN_KEY = 'admin_token';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// 会话过期（token 失效）：清除本地 token 并整页跳转到登录页。
// 应用以 base=/admin/ 部署，登录页完整路径是 /admin/login。
// 已在登录页时不重复跳转（登录失败本身也是 401）。
function handleUnauthorized() {
  localStorage.removeItem(TOKEN_KEY);
  const loginPath = `${import.meta.env.BASE_URL}login`;
  const current = window.location.pathname;
  if (current !== loginPath && !current.endsWith('/login')) {
    window.location.href = loginPath;
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, { ...options, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // 401 集中处理：改密码时旧密码错误（INVALID_PASSWORD）属凭据错误而非会话过期，不强制登出
    if (res.status === 401 && body?.error?.code !== 'INVALID_PASSWORD') {
      handleUnauthorized();
    }
    throw new ApiError(res.status, body?.error?.message ?? `请求失败 (${res.status})`);
  }
  return body.data as T;
}
