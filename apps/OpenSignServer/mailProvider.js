import { smtpenable } from './Utils.js';
import { randomUUID } from 'node:crypto';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
// Resend's default account limit is 2 requests/second. Bulk send loops through
// signers fast enough to trip it, so a rejected request is retried rather than
// silently dropping that signer's mail.
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

/**
 * Resend delivers over HTTPS instead of SMTP. Hosts that block outbound SMTP
 * egress (Railway below the Pro plan, most serverless platforms) can still send
 * through it, so it takes precedence over the SMTP and Mailgun transports.
 */
export const resendenable = Boolean(process.env.RESEND_API_KEY);

/**
 * The address every transport sends from. Kept here so the three cloud
 * functions and the Parse mail adapter cannot drift apart.
 */
export const mailsender = resendenable
  ? process.env.RESEND_SENDER || process.env.SMTP_USER_EMAIL
  : smtpenable
    ? process.env.SMTP_USER_EMAIL
    : process.env.MAILGUN_SENDER;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Nodemailer accepts a comma-joined string or an array; Resend needs an array. */
function toRecipients(value) {
  if (!value) return undefined;
  const list = (Array.isArray(value) ? value : String(value).split(','))
    .map(entry => String(entry).trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

/**
 * Call sites build `from` as `"<name> <address>"`. When the display name is
 * empty that leaves a leading space and Resend rejects the header, so fall
 * back to the bare address.
 */
function toSender(from) {
  const value = String(from || '').trim();
  if (!value) return mailsender;
  if (value.startsWith('<') && value.endsWith('>')) return value.slice(1, -1).trim();
  return value;
}

/** Nodemailer attachments carry a Buffer in `content`; Resend wants base64. */
function toAttachments(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return undefined;
  const mapped = attachments
    .filter(file => file && (file.content || file.data))
    .map(file => {
      const raw = file.content ?? file.data;
      return {
        filename: file.filename,
        content: Buffer.isBuffer(raw)
          ? raw.toString('base64')
          : Buffer.from(raw).toString('base64'),
      };
    });
  return mapped.length ? mapped : undefined;
}

/**
 * Converts the nodemailer-shaped message the cloud functions already build into
 * a Resend payload. Keeping the input shape identical means call sites only
 * choose a transport; they do not build a second message format.
 */
export function toResendPayload(messageParams = {}) {
  return {
    from: toSender(messageParams.from),
    to: toRecipients(messageParams.to),
    cc: toRecipients(messageParams.cc),
    bcc: toRecipients(messageParams.bcc),
    reply_to: toRecipients(messageParams.replyTo),
    subject: messageParams.subject || '',
    html: messageParams.html || undefined,
    text: messageParams.text || undefined,
    attachments: toAttachments(messageParams.attachments),
  };
}

/**
 * Sends one message through Resend's HTTPS API.
 *
 * @returns {Promise<{status: 'success'|'error', id?: string, error?: string}>}
 */
export async function sendViaResend(messageParams) {
  const payload = toResendPayload(messageParams);
  if (!payload.to) {
    console.log('resend error: message has no recipient');
    return { status: 'error', error: 'no_recipient', provider: 'resend' };
  }

  // Reuse one key for transport retries, but allow a deliberate resend later.
  const idempotencyKey = randomUUID();
  let failure = { status: 'error', error: 'provider_unavailable', provider: 'resend' };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (typeof body?.id !== 'string' || !body.id.trim()) {
          failure = { status: 'error', error: 'invalid_provider_response', provider: 'resend' };
          break;
        }
        console.log('resend accepted: ', body.id);
        return { status: 'success', id: body.id, provider: 'resend', deliveryStatus: 'accepted' };
      }

      // Provider bodies can echo recipients/content. Return and log only codes.
      failure = {
        status: 'error',
        error: res.status === 429 ? 'rate_limited' : 'provider_rejected',
        provider: 'resend',
        httpStatus: res.status,
      };
      if (!RETRY_STATUSES.has(res.status) || attempt === MAX_ATTEMPTS) break;
    } catch (err) {
      failure = {
        status: 'error',
        error: ['TimeoutError', 'AbortError'].includes(err?.name)
          ? 'provider_timeout'
          : 'provider_unavailable',
        provider: 'resend',
      };
      if (attempt === MAX_ATTEMPTS) break;
    }
    await sleep(500 * attempt);
  }

  console.log('resend failure: ', JSON.stringify(failure));
  return failure;
}
