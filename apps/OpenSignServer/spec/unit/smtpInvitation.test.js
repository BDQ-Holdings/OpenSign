import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

// Isolate module-level transport selection and replace SMTP before importing
// the cloud function. These child processes never open a network connection.
function smtpResult(response) {
  const script = `
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    require('nodemailer').createTransport = () => ({
      async sendMail() { return ${JSON.stringify(response)}; }, close() {}
    });
    const { default: send } = await import('./cloud/parsefunction/sendMailv3.js');
    const result = await send({ params: { recipient: 'recipient@example.test' } });
    console.log('RESULT:' + JSON.stringify(result));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('../../', import.meta.url),
    env: { ...process.env, RESEND_API_KEY: '', SMTP_ENABLE: 'true', MAILGUN_API_KEY: '' },
    encoding: 'utf8',
  });
  return JSON.parse(output.split('RESULT:')[1].trim());
}

test('a resolved SMTP response with rejected recipients is a send failure', () => {
  assert.equal(smtpResult({ rejected: ['recipient@example.test'], accepted: [] }).status, 'error');
});

test('SMTP acceptance is reported as acceptance, never inbox delivery', () => {
  assert.deepEqual(smtpResult({ rejected: [], accepted: ['recipient@example.test'] }), {
    status: 'success',
    provider: 'smtp',
    deliveryStatus: 'accepted',
  });
});
