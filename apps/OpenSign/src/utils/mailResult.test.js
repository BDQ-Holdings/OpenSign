import { mailFailureMessage } from "./mailResult";
it.each([
  ["no_recipient", "mail-no-recipient"],
  ["rate_limited", "mail-provider-busy"],
  ["provider_rejected", "mail-provider-rejected"],
  ["mail_not_configured", "mail-provider-rejected"],
  ["provider_timeout", "mail-acceptance-unconfirmed"],
  ["untrusted provider content", "mail-acceptance-unconfirmed"]
])("shows a safe actionable message for %s", (error, expected) => {
  expect(mailFailureMessage({ error }, (key) => key)).toBe(expected);
});
