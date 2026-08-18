import nodemailer, { type Transporter } from 'nodemailer';
import { getSettings } from './settings';
import type { Db } from '../db';

// 邮件通知：SMTP 配置（host/from）齐备时发送，否则静默跳过。
// 发送失败不抛错——通知丢失可接受，绝不能拖垮评论等主流程。

let cachedTransport: { key: string; transporter: Transporter } | null = null;

/** 测试用：替换 transporter 工厂，便于断言"确实发出了邮件"而不真正触网。 */
export function __setCreateTransport(fn: typeof nodemailer.createTransport): void {
  cachedTransport = null;
  createTransport = fn;
}

let createTransport: typeof nodemailer.createTransport = nodemailer.createTransport;

function getTransporter(ctx: Db): Transporter | null {
  const cfg = getSettings(ctx, ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass']);
  const host = cfg.smtp_host?.trim();
  if (!host) return null;
  const port = Number(cfg.smtp_port) || 465;
  const key = `${host}|${port}|${cfg.smtp_user}`;
  if (!cachedTransport || cachedTransport.key !== key) {
    cachedTransport = {
      key,
      transporter: createTransport({
        host,
        port,
        secure: port === 465,
        auth: cfg.smtp_user ? { user: cfg.smtp_user, pass: cfg.smtp_pass } : undefined,
      }),
    };
  }
  return cachedTransport.transporter;
}

/** 发送一封邮件；SMTP 未配置或无收件人时直接跳过。 */
export function sendEmail(ctx: Db, to: string, subject: string, html: string): void {
  const from = getSettings(ctx, ['smtp_from']).smtp_from?.trim();
  if (!to || !from) return;
  const transporter = getTransporter(ctx);
  if (!transporter) return;
  transporter.sendMail({ from, to, subject, html }).catch(() => {
    // 通知邮件失败静默（网络/凭据问题不应影响博客主流程）
  });
}

/** 简单 HTML 转义：评论内容进邮件正文前清理。 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
