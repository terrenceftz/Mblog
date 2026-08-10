import { Hono } from 'hono';
import { getSetting } from '../../lib/settings';
import type { Db } from '../../db';

export interface Project {
  name: string;
  description: string;
  url: string;
  language: string | null;
  stars: number;
  updatedAt: string;
}

interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  fork: boolean;
}

const TTL = 30 * 60 * 1000; // GitHub 匿名限流 60 次/小时，缓存 30 分钟
const MAX_REPOS = 20;

// 拉取 + 过滤（排除 fork）+ 按星数降序 + 截取前 20
export async function fetchGitHubProjects(username: string): Promise<Project[]> {
  const res = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
    { headers: { 'User-Agent': 'MBLOG', Accept: 'application/vnd.github+json' } },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const repos = (await res.json()) as GitHubRepo[];
  return repos
    .filter((r) => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, MAX_REPOS)
    .map((r) => ({
      name: r.name,
      description: r.description ?? '',
      url: r.html_url,
      language: r.language,
      stars: r.stargazers_count,
      updatedAt: r.updated_at,
    }));
}

export function githubRoutes(ctx: Db) {
  // 缓存按 app 隔离（每个测试 app 独立），键为用户名的全小写
  const cache = new Map<string, { time: number; data: Project[] }>();

  const app = new Hono();

  app.get('/projects', async (c) => {
    if (getSetting(ctx, 'github_enabled') !== '1') {
      return c.json({ data: { enabled: false, projects: [] } });
    }
    const username = getSetting(ctx, 'github_username').trim();
    if (!username) {
      return c.json({ data: { enabled: false, projects: [] } });
    }
    const key = username.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.time < TTL) {
      return c.json({ data: { enabled: true, username, projects: hit.data } });
    }
    try {
      const projects = await fetchGitHubProjects(username);
      cache.set(key, { time: Date.now(), data: projects });
      return c.json({ data: { enabled: true, username, projects } });
    } catch {
      if (hit) {
        return c.json({ data: { enabled: true, username, projects: hit.data, stale: true } });
      }
      return c.json({ data: { enabled: true, username, projects: [], error: 'GitHub 拉取失败，请稍后重试' } });
    }
  });

  return app;
}
