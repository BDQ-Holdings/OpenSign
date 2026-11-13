import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { smtpenable, smtpsecure, updateMailCount } from '../../Utils.js';
import { createTransport } from 'nodemailer';
import { mailsender, resendenable, sendViaResend } from '../../mailProvider.js';
async function sendMailProvider(req) {
  const extUserId = req.params?.extUserId || '';
  const reportMsg = `<p style="font-size: 13px; color:grey; text-align: center;">If you did not expect this message, contact the sender directly and use your email provider's spam controls.</p>`;

  const mailgunApiKey = process.env.MAILGUN_API_KEY;
  let transporterSMTP;
  try {
    let mailgunClient;
    let mailgunDomain;
    if (!resendenable) {
      if (smtpenable) {
        let transporterConfig = {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 465,
          secure: smtpsecure,
        };

        // ✅ Add auth only if BOTH username & password exist
        const smtpUser = process.env.SMTP_USERNAME;
        const smtpPass = process.env.SMTP_PASS;

        if (smtpUser && smtpPass) {
          transporterConfig.auth = {
            user: process.env.SMTP_USERNAME
              ? process.env.SMTP_USERNAME
              : process.env.SMTP_USER_EMAIL,
            pass: smtpPass,
          };
        }
        transporterSMTP = createTransport(transporterConfig);
      } else {
        if (mailgunApiKey) {
          const mailgun = new Mailgun(formData);
          mailgunClient = mailgun.client({ username: 'api', key: mailgunApiKey });
          mailgunDomain = process.env.MAILGUN_DOMAIN;
        }
      }
    }

    const from = req.params.from || '';
    const replyto = req.params?.replyto || '';
    const messageParams = {
      from: from + ' <' + mailsender + '>',
      to: req.params.recipient,
      subject: req.params.subject,
      text: req.params.text || 'mail',
      html: req.params?.html ? req.params.html + reportMsg : '',
      bcc: req.params.bcc ? req.params.bcc : undefined,
      cc: req.params.cc ? req.params.cc : undefined,
      replyTo: replyto ? replyto : undefined,
    };

    if (resendenable) {
      const res = await sendViaResend(messageParams);
      if (res.status === 'success') {
        if (extUserId) {
          // Accounting failure must not turn an accepted send into a retry.
          try {
            await updateMailCount(extUserId);
          } catch {
            console.log('sendmailv3 mail count update failed after acceptance');
          }
        }
        return res;
      }
      return res;
    }

    if (transporterSMTP) {
      const res = await transporterSMTP.sendMail(messageParams);
      console.log('smtp transporter res: ', res?.response);
      if (!res.err && !res.rejected?.length && res.accepted?.length) {
        if (extUserId) {
          await updateMailCount(extUserId);
        }
        return { status: 'success', provider: 'smtp', deliveryStatus: 'accepted' };
      }
    } else {
      if (mailgunApiKey) {
        const res = await mailgunClient.messages.create(mailgunDomain, messageParams);
        console.log('mailgun res: ', res?.status);
        if (res.status === 200) {
          if (extUserId) {
            await updateMailCount(extUserId);
          }
          return { status: 'success' };
        }
      } else {
        return { status: 'error', error: 'mail_not_configured' };
      }
    }
  } catch (err) {
    console.log('sendmailv3 transport failure');
    if (err) {
      return { status: 'error', error: 'provider_unavailable' };
    }
  } finally {
    if (transporterSMTP) {
      transporterSMTP?.close?.();
    }
  }
  return { status: 'error', error: 'provider_rejected' };
}

async function sendmailv3(req) {
  const nonCustomMail = await sendMailProvider(req);
  const safeId = value =>
    typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : undefined;
  console.log(
    'invitation mail result: ',
    JSON.stringify({
      documentId: safeId(req.params?.documentId),
      signerId: safeId(req.params?.signerId),
      ...nonCustomMail,
    })
  );
  return nonCustomMail;
}

export default sendmailv3;
