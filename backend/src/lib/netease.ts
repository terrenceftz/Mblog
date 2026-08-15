import { createCipheriv, randomBytes } from 'crypto';

// 网易云音乐网页端 weapi 签名（算法为公开实现，Node 内置 crypto 自实现，零第三方依赖）
// 仅用于以「用户自有账号权限」获取自己账号可播放的音乐源，不做版权绕过。

// 网易云固定 RSA 公钥（modulus 为 DER 前导 00 形式，raw 加密需去掉前导 00）
const MODULUS =
  '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';
const NONCE = '0CoJUm6Qyw8W8jud';
// 网易云 IV："0102030405060708" 16 字符 utf8 = 16 字节（对齐社区 CryptoJS 实现）
const IV = Buffer.from('0102030405060708', 'utf8');
const MODULUS_HEX = MODULUS.replace(/^00/, '');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export type NeteaseResp<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

function aesEncrypt(text: string, key: string): string {
  const cipher = createCipheriv('aes-128-cbc', Buffer.from(key, 'utf8'), IV);
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('base64');
}

/** 快速模幂（平方-乘），BigInt 无内置 modPow */
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return result;
}

/** RAW RSA 加密（无 PKCS1 填充）：网易云 weapi 对 encSecKey 的要求（对齐社区 node-forge 'NONE' scheme） */
function rsaEncrypt(key: string): string {
  const m = BigInt('0x' + Buffer.from(key, 'utf8').toString('hex'));
  const n = BigInt('0x' + MODULUS_HEX);
  const c = modPow(m, 65537n, n);
  // 输出固定 k=128 字节（256 hex），不足前置补零
  return c.toString(16).padStart(256, '0');
}

/** 构造 weapi 表单体：params + encSecKey */
function weapiBody(payload: Record<string, unknown>): string {
  const secret = randomBytes(8).toString('hex'); // 16 hex 字符 = 16 字节 AES-128 key
  const params = aesEncrypt(aesEncrypt(JSON.stringify(payload), NONCE), secret);
  // 网易云把 AES key 反转后再 RSA 加密（对齐社区实现）
  const encSecKey = rsaEncrypt(secret.split('').reverse().join(''));
  return `params=${encodeURIComponent(params)}&encSecKey=${encodeURIComponent(encSecKey)}`;
}

function csrfOf(cookie: string): string {
  const m = /__csrf=([0-9a-zA-Z]+)/.exec(cookie);
  return m ? m[1] : '';
}

/** 网易云需要 NMTID 匿名设备标识（网页版自动生成；缺失时验证码/部分接口 404） */
function withNmtid(cookie: string): string {
  if (/NMTID=/.test(cookie)) return cookie;
  const nmtid = [...randomBytes(16)].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join('');
  return cookie ? `${cookie}; NMTID=${nmtid}` : `NMTID=${nmtid}`;
}

async function weapiPost<T>(cookie: string, path: string, payload: Record<string, unknown>): Promise<NeteaseResp<T>> {
  const body = weapiBody({ ...payload, csrf_token: csrfOf(cookie) });
  let res: Response;
  try {
    res = await fetch(`https://music.163.com/weapi/${path}`, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        Referer: 'https://music.163.com/',
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: withNmtid(cookie),
      },
      body,
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return { ok: false, status: 0, message: '网易云接口请求失败（网络/超时）' };
  }
  if (!res.ok) return { ok: false, status: res.status, message: `网易云接口 ${res.status}` };
  const json = (await res.json().catch(() => null)) as T | null;
  if (!json) return { ok: false, status: 0, message: '网易云返回非 JSON' };
  return { ok: true, data: json };
}

export interface NeteasePlaylist {
  id: number;
  name: string;
  cover: string;
  count: number;
}
export interface NeteaseTrack {
  id: number;
  name: string;
  artists: string;
  album: string;
  cover: string;
  duration: number; // ms
}

/** 获取账号 uid（用于后续歌单请求） */
async function getUid(cookie: string): Promise<NeteaseResp<number>> {
  const r = await weapiPost<{ account: { id: number } | null }>(cookie, 'nuser/account/get', {});
  if (!r.ok) return r;
  const uid = r.data.account?.id;
  if (!uid) return { ok: false, status: 401, message: 'Cookie 无效或已过期，请到后台重新配置' };
  return { ok: true, data: uid };
}

/** 发送短信验证码（网易云现行接口 /sms/captcha/sent，旧 /sms/sendcode 已废弃返回 404） */
export async function sendSmsCode(cookie: string, phone: string): Promise<NeteaseResp<boolean>> {
  const r = await weapiPost<{ code: number; msg?: string }>(cookie, 'sms/captcha/sent', {
    ctcode: '86',
    secrete: 'music_middleuser_pclogin',
    cellphone: phone,
  });
  if (!r.ok) return r;
  if (r.data.code !== 200) {
    return { ok: false, status: r.data.code, message: r.data.msg || '验证码发送失败（可能发送过于频繁）' };
  }
  return { ok: true, data: true };
}

/** 手机号 + 验证码登录，返回完整登录 Cookie（含 httpOnly 的 MUSIC_U） */
export async function loginByPhone(phone: string, code: string): Promise<NeteaseResp<string>> {
  const body = weapiBody({
    type: '1',
    https: 'true',
    phone,
    countrycode: '86',
    captcha: code,
    remember: 'true',
    csrf_token: '',
  });
  let res: Response;
  try {
    res = await fetch('https://music.163.com/weapi/w/login/cellphone', {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        Referer: 'https://music.163.com/',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return { ok: false, status: 0, message: '登录接口请求失败（网络/超时）' };
  }
  const json = (await res.json().catch(() => null)) as { code?: number; msg?: string } | null;
  if (!json || json.code !== 200) {
    const msg = json?.msg || (json?.code ? `网易云错误码 ${json.code}` : '登录响应异常');
    return { ok: false, status: json?.code ?? 0, message: msg };
  }
  // 合并 set-cookie（含 MUSIC_U 等登录态）
  const setCookies = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0].trim()).filter(Boolean);
  if (!setCookies.some((c) => c.startsWith('MUSIC_U='))) {
    return { ok: false, status: 0, message: '登录成功但未返回登录态 Cookie，请稍后重试' };
  }
  return { ok: true, data: setCookies.join('; ') };
}

/** 用户收藏歌单列表（含自己创建的） */
export async function getUserPlaylists(cookie: string): Promise<NeteaseResp<NeteasePlaylist[]>> {
  const uid = await getUid(cookie);
  if (!uid.ok) return uid;
  const r = await weapiPost<{ playlist?: { id: number; name: string; coverImgUrl: string; trackCount: number }[] }>(
    cookie,
    'user/playlist',
    { uid: uid.data, limit: 60, offset: 0 },
  );
  if (!r.ok) return r;
  const list = (r.data.playlist || [])
    .filter((p) => p.trackCount > 0)
    .map((p) => ({ id: p.id, name: p.name, cover: p.coverImgUrl, count: p.trackCount }));
  return { ok: true, data: list };
}

/** 歌单详情（曲目列表） */
export async function getPlaylistDetail(cookie: string, id: number): Promise<NeteaseResp<{ name: string; cover: string; tracks: NeteaseTrack[] }>> {
  const r = await weapiPost<{
    playlist?: { name: string; coverImgUrl: string; tracks: { id: number; name: string; ar: { name: string }[]; al: { name: string; picUrl: string }; dt: number }[] } | null;
  }>(cookie, 'v6/playlist/detail', { id, n: 100000, s: 8 });
  if (!r.ok) return r;
  const pl = r.data.playlist;
  if (!pl) return { ok: false, status: 404, message: '歌单不存在或已删除' };
  const tracks: NeteaseTrack[] = (pl.tracks || []).map((t) => ({
    id: t.id,
    name: t.name,
    artists: (t.ar || []).map((a) => a.name).join(' / '),
    album: t.al?.name || '',
    cover: t.al?.picUrl || '',
    duration: t.dt || 0,
  }));
  return { ok: true, data: { name: pl.name, cover: pl.coverImgUrl, tracks } };
}

/** 获取单曲播放 URL（320kbps；无版权/需会员时返回错误） */
export async function getSongUrl(cookie: string, id: number): Promise<NeteaseResp<string>> {
  const r = await weapiPost<{ data: { url: string | null; code: number }[] }>(cookie, 'song/enhance/player/url', {
    ids: [id],
    br: 320000,
  });
  if (!r.ok) return r;
  const d = r.data.data?.[0];
  if (!d || !d.url || d.code !== 200) {
    return { ok: false, status: d?.code ?? 0, message: '无版权或需会员，已跳过' };
  }
  return { ok: true, data: d.url };
}
