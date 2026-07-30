import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  authorizeInitialAdmin,
  hasValidBootstrapToken,
  normalizeEmail,
} from '../../cloud/parsefunction/AddAdmin.js';

const originalParse = globalThis.Parse;
const originalBootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
let existingAdmin;

class ParseError extends Error {
  static SESSION_MISSING = 206;
  static OPERATION_FORBIDDEN = 119;
  static DUPLICATE_VALUE = 137;

  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

class Query {
  equalTo() {}
  notEqualTo() {}
  async first() {
    return existingAdmin;
  }
}

function requestFor(email, token = 'bootstrap-secret') {
  return {
    params: { bootstrapToken: token },
    user: {
      id: 'user-1',
      get(field) {
        return field === 'email' ? email : undefined;
      },
      getSessionToken() {
        return 'session-1';
      },
    },
  };
}

beforeEach(() => {
  existingAdmin = undefined;
  process.env.ADMIN_BOOTSTRAP_TOKEN = 'bootstrap-secret';
  globalThis.Parse = { Error: ParseError, Query };
});

afterEach(() => {
  if (originalBootstrapToken === undefined) {
    delete process.env.ADMIN_BOOTSTRAP_TOKEN;
  } else {
    process.env.ADMIN_BOOTSTRAP_TOKEN = originalBootstrapToken;
  }
  globalThis.Parse = originalParse;
});

test('normalizes administrator email addresses', () => {
  assert.equal(normalizeEmail(' Admin@BDQHoldings.com '), 'admin@bdqholdings.com');
});

test('compares the bootstrap token without accepting missing or incorrect values', () => {
  assert.equal(hasValidBootstrapToken('bootstrap-secret'), true);
  assert.equal(hasValidBootstrapToken('wrong-secret'), false);
  assert.equal(hasValidBootstrapToken(), false);
});

test('requires an authenticated user', async () => {
  await assert.rejects(
    authorizeInitialAdmin({ params: { bootstrapToken: 'bootstrap-secret' } }, 'admin@bdqholdings.com'),
    error => error.code === ParseError.SESSION_MISSING
  );
});

test('requires the requested administrator to match the authenticated user', async () => {
  await assert.rejects(
    authorizeInitialAdmin(requestFor('other@bdqholdings.com'), 'admin@bdqholdings.com'),
    error => error.code === ParseError.OPERATION_FORBIDDEN
  );
});

test('requires the private bootstrap token', async () => {
  await assert.rejects(
    authorizeInitialAdmin(requestFor('admin@bdqholdings.com', 'wrong-secret'), 'admin@bdqholdings.com'),
    error => error.code === ParseError.OPERATION_FORBIDDEN
  );
});

test('refuses to create a second administrator', async () => {
  existingAdmin = { id: 'admin-1' };
  await assert.rejects(
    authorizeInitialAdmin(requestFor('admin@bdqholdings.com'), 'admin@bdqholdings.com'),
    error => error.code === ParseError.DUPLICATE_VALUE
  );
});

test('authorizes the first matching administrator', async () => {
  const result = await authorizeInitialAdmin(
    requestFor('Admin@BDQHoldings.com'),
    'admin@bdqholdings.com'
  );
  assert.deepEqual(result, { id: 'user-1', sessionToken: 'session-1' });
});
