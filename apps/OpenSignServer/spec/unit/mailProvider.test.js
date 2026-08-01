import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test_key';
process.env.SMTP_USER_EMAIL = process.env.SMTP_USER_EMAIL || 'signatures@example.com';

const { mailsender, resendenable, sendViaResend, toResendPayload } =
  await import('../../mailProvider.js');

const originalFetch = globalThis.fetch;
let calls;

/** Replaces global fetch with a queue of canned responses. */
function stubFetch(responses) {
  calls = [];
  const queue = [...responses];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const next = queue.shift() ?? responses[responses.length - 1];
    if (next instanceof Error) throw next;
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body ?? {},
      text: async () => JSON.stringify(next.body ?? {}),
    };
  };
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('module configuration', () => {
  test('an api key selects Resend as the transport', () => {
    assert.equal(resendenable, true);
  });

  test('falls back to the SMTP sender address when RESEND_SENDER is unset', () => {
    assert.equal(mailsender, 'signatures@example.com');
  });
});

describe('toResendPayload', () => {
  test('splits a comma-joined recipient string into a list', () => {
    const payload = toResendPayload({ to: 'a@b.com, c@d.com' });
    assert.deepEqual(payload.to, ['a@b.com', 'c@d.com']);
  });

  test('accepts a recipient array unchanged', () => {
    const payload = toResendPayload({ to: ['a@b.com'] });
    assert.deepEqual(payload.to, ['a@b.com']);
  });

  test('omits recipient fields that were never set', () => {
    const payload = toResendPayload({ to: 'a@b.com' });
    assert.equal(payload.cc, undefined);
    assert.equal(payload.bcc, undefined);
    assert.equal(payload.reply_to, undefined);
  });

  test('renames replyTo to the reply_to key Resend expects', () => {
    const payload = toResendPayload({ to: 'a@b.com', replyTo: 'r@e.com' });
    assert.deepEqual(payload.reply_to, ['r@e.com']);
  });

  test('keeps a display name on the sender', () => {
    const payload = toResendPayload({ from: 'Dr B <sig@example.com>', to: 'a@b.com' });
    assert.equal(payload.from, 'Dr B <sig@example.com>');
  });

  // Call sites build `from` as `name + ' <' + address + '>'`. An anonymous
  // sender leaves a leading space, which Resend rejects as a malformed header.
  test('strips the empty display name an anonymous sender produces', () => {
    const payload = toResendPayload({ from: ' <sig@example.com>', to: 'a@b.com' });
    assert.equal(payload.from, 'sig@example.com');
  });

  test('falls back to the configured sender when from is blank', () => {
    const payload = toResendPayload({ from: '', to: 'a@b.com' });
    assert.equal(payload.from, mailsender);
  });

  test('base64 encodes a nodemailer buffer attachment', () => {
    const payload = toResendPayload({
      to: 'a@b.com',
      attachments: [{ filename: 'signed.pdf', content: Buffer.from('pdf-bytes') }],
    });
    assert.deepEqual(payload.attachments, [
      { filename: 'signed.pdf', content: Buffer.from('pdf-bytes').toString('base64') },
    ]);
  });

  test('also accepts the mailgun-style data field', () => {
    const payload = toResendPayload({
      to: 'a@b.com',
      attachments: [{ filename: 'cert.pdf', data: Buffer.from('cert') }],
    });
    assert.equal(payload.attachments[0].content, Buffer.from('cert').toString('base64'));
  });

  test('omits attachments entirely when there are none', () => {
    assert.equal(toResendPayload({ to: 'a@b.com', attachments: [] }).attachments, undefined);
    assert.equal(toResendPayload({ to: 'a@b.com' }).attachments, undefined);
  });
});

describe('sendViaResend', () => {
  test('reports success and surfaces the message id', async () => {
    stubFetch([{ status: 200, body: { id: 'msg_1' } }]);
    const res = await sendViaResend({ to: 'a@b.com', subject: 's' });
    assert.deepEqual(res, { status: 'success', id: 'msg_1' });
    assert.equal(calls.length, 1);
  });

  test('authenticates with the api key as a bearer token', async () => {
    stubFetch([{ status: 200, body: { id: 'msg_1' } }]);
    await sendViaResend({ to: 'a@b.com' });
    assert.equal(calls[0].init.headers.Authorization, `Bearer ${process.env.RESEND_API_KEY}`);
  });

  // A message with no recipient is a caller bug, not a transport failure;
  // spending an API call and a rate-limit slot on it helps nobody.
  test('refuses to call the API when there is no recipient', async () => {
    stubFetch([{ status: 200, body: { id: 'msg_1' } }]);
    const res = await sendViaResend({ subject: 'nobody' });
    assert.equal(res.status, 'error');
    assert.equal(calls.length, 0);
  });

  test('does not retry a rejection the server will repeat', async () => {
    stubFetch([{ status: 422, body: { message: 'domain not verified' } }]);
    const res = await sendViaResend({ to: 'a@b.com' });
    assert.equal(res.status, 'error');
    assert.equal(calls.length, 1);
  });

  // Resend allows 2 requests/second by default and bulk send exceeds that.
  test('retries a rate-limited send instead of dropping the mail', async () => {
    stubFetch([
      { status: 429, body: {} },
      { status: 200, body: { id: 'msg_2' } },
    ]);
    const res = await sendViaResend({ to: 'a@b.com' });
    assert.equal(res.status, 'success');
    assert.equal(calls.length, 2);
  });

  test('gives up with an error once retries are exhausted', async () => {
    stubFetch([{ status: 503, body: {} }]);
    const res = await sendViaResend({ to: 'a@b.com' });
    assert.equal(res.status, 'error');
    assert.equal(calls.length, 4);
  });

  test('turns a thrown network error into an error result', async () => {
    stubFetch([new Error('ECONNRESET')]);
    const res = await sendViaResend({ to: 'a@b.com' });
    assert.equal(res.status, 'error');
  });
});
