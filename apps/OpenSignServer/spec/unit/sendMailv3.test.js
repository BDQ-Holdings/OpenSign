import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

process.env.RESEND_API_KEY = 'test_key';
process.env.SMTP_USER_EMAIL = 'signatures@example.test';
const { default: sendmailv3 } = await import('../../cloud/parsefunction/sendMailv3.js');
const originalFetch = globalThis.fetch;
const originalParse = globalThis.Parse;
let calls;
let count;

beforeEach(() => {
  calls = [];
  count = 0;
  globalThis.Parse = {
    Query: class {
      equalTo() {}
      async first() {
        return {
          increment() {
            count++;
          },
          async save() {},
        };
      }
    },
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.Parse = originalParse;
});

function transport(status, body) {
  globalThis.fetch = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return {
      ok: status === 200,
      status,
      async json() {
        return body;
      },
    };
  };
}
const request = () => ({
  params: {
    recipient: 'recipient@example.test',
    from: 'Sender',
    replyto: 'owner@example.test',
    subject: 'Test invitation',
    html: '<p>Mock invitation</p>',
    extUserId: 'owner-id',
  },
});

test('initial send and resend both return provider acceptance evidence and count accepted mail', async () => {
  transport(200, { id: 'provider-message-id' });
  for (let i = 0; i < 2; i++) {
    const result = await sendmailv3(request());
    assert.deepEqual(result, {
      status: 'success',
      id: 'provider-message-id',
      provider: 'resend',
      deliveryStatus: 'accepted',
    });
  }
  assert.equal(calls.length, 2);
  assert.equal(count, 2);
  assert.equal(calls[0].to[0], 'recipient@example.test');
  assert.equal(calls[0].reply_to[0], 'owner@example.test');
});

test('provider rejection survives the cloud function without counting failed mail', async () => {
  transport(422, {});
  const result = await sendmailv3(request());
  assert.deepEqual(result, {
    status: 'error',
    error: 'provider_rejected',
    provider: 'resend',
    httpStatus: 422,
  });
  assert.equal(count, 0);
});

test('missing recipient fails before any provider call', async () => {
  transport(200, { id: 'unused' });
  const req = request();
  delete req.params.recipient;
  const result = await sendmailv3(req);
  assert.equal(result.error, 'no_recipient');
  assert.equal(calls.length, 0);
  assert.equal(count, 0);
});

test('accounting failure cannot turn an accepted invitation into a reported send failure', async () => {
  transport(200, { id: 'accepted-before-accounting-failure' });
  globalThis.Parse.Query = class {
    constructor() {
      throw new Error('database unavailable');
    }
  };
  assert.equal((await sendmailv3(request())).status, 'success');
});

test('correlates acceptance with opaque IDs without logging recipient or invitation content', async () => {
  transport(200, { id: 'provider-message-id' });
  const req = request();
  req.params.documentId = 'document-1';
  req.params.signerId = 'signer-1';
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args);
  try {
    await sendmailv3(req);
    const log = JSON.stringify(logs);
    assert.ok(log.includes('document-1'));
    assert.ok(log.includes('signer-1'));
    assert.ok(log.includes('provider-message-id'));
    assert.equal(log.includes('recipient@example.test'), false);
    assert.equal(log.includes('Mock invitation'), false);
  } finally {
    console.log = originalLog;
  }
});
