import { describe, it, expect, beforeAll, vi } from 'vitest';
import { makeTestApp, loginAsAdmin, authHeaders } from './helpers';
import { generateTotpSecret, verifyTotp, totpUri, base32Decode } from '../src/lib/totp';
import { setSetting } from '../src/lib/settings';
import { posts } from '../src/db/schema';

// RFC 4226/6238 官方测试向量：ASCII secret "12345678901234567890" 的 base32
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totp lib', () => {
  it('base32 解码 RFC 向量', () => {
    expect(base32Decode(RFC_SECRET).toString('ascii')).toBe('12345678901234567890');
  });

  it('verifyTotp 命中 RFC 向量（t=59s → counter 1 → 287082）', () => {
    expect(verifyTotp(RFC_SECRET, '287082', 59_000)).toBe(true);
    // ±1 窗口：counter 2 的码（359152）在 t=59s 也应通过
    expect(verifyTotp(RFC_SECRET, '359152', 59_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, '123456', 59_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, 'abc', 59_000)).toBe(false);
  });

  it('生成密钥可通过 uri 与校验闭环', () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32,}$/);
    const uri = totpUri(s, 'admin', 'MBLOG');
    expect(uri).toContain('otpauth://totp/MBLOG%3Aadmin?');
    expect(uri).toContain(`secret=${s}`);
  });
});

describe('totp login & setup flows', () => {
  const { app, ctx } = makeTestApp();
  let token = '';

  beforeAll(async () => {
    token = await loginAsAdmin(app);
  });

  it('未启用时正常登录不受影响', async () => {
    const r = await app.request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    expect(r.status).toBe(200);
  });

  it('setup 生成密钥，enable 校验后登录强制 TOTP', async () => {
    const setup = await app.request('/api/admin/totp/setup', { method: 'POST', headers: authHeaders(token) });
    expect(setup.status).toBe(200);
    const { secret, uri } = (await setup.json()).data;
    expect(uri).toContain('secret=');

    // 用假时钟派生当前有效码
    const now = Date.now();
    const counter = Math.floor(now / 1000 / 30);
    const code = deriveCode(secret, counter);

    const enable = await app.request('/api/admin/totp/enable', {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    expect(enable.status).toBe(200);

    // 缺码 → TOTP_REQUIRED
    const noCode = await app.request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    expect(noCode.status).toBe(401);
    expect(((await noCode.json()) as any).error.code).toBe('TOTP_REQUIRED');

    // 带码 → 200
    const withCode = await app.request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123', totpCode: code }),
    });
    expect(withCode.status).toBe(200);

    // disable 需有效码；关闭后恢复无码登录
    const disable = await app.request('/api/admin/totp/disable', {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    expect(disable.status).toBe(200);
    const after = await app.request('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    expect(after.status).toBe(200);
  });
});

/** 与 lib/totp 相同算法派生指定 counter 的码（测试独立实现，避免同源假阳性） */
function deriveCode(secretBase32: string, counter: number): string {
  const { createHmac } = require('node:crypto') as typeof import('node:crypto');
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(buf).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}

describe('track beacon & admin stats', () => {
  const { app, ctx } = makeTestApp();
  let token = '';

  beforeAll(async () => {
    token = await loginAsAdmin(app);
    ctx.db.insert(posts).values({ title: 't', slug: 'trk-p', status: 'published', contentMd: '', contentHtml: '' }).run();
  });

  it('track 记录 PV 与去重 UV，admin/stats 汇总今日/本月', async () => {
    const prev = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = '1';
    try {
      const post = (body: string, ip: string) =>
        app.request('/api/track', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': ip }, body });
      await post('{}', '1.1.1.1');
      await post('{}', '1.1.1.1'); // 同 IP 重复：PV+1，UV 不变
      await post('{}', '2.2.2.2');
      const r = await app.request('/api/admin/stats', { headers: authHeaders(token) });
      const { data } = await r.json();
      expect(data.todayViews).toBe(3);
      expect(data.monthViews).toBe(3);
      const uv = ctx.sqlite.prepare('SELECT count(*) AS n FROM visit_log').get() as { n: number };
      expect(uv.n).toBe(2);
    } finally {
      if (prev === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = prev;
    }
  });
});
