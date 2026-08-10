import 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    user: { username: string };
  }
}
