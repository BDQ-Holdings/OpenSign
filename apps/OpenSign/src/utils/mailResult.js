// Only translate known codes; provider responses may contain private content.
export function mailFailureMessage(result, t) {
  switch (result?.error) {
    case "no_recipient":
      return t("mail-no-recipient");
    case "rate_limited":
      return t("mail-provider-busy");
    case "provider_rejected":
    case "mail_not_configured":
      return t("mail-provider-rejected");
    default:
      return t("mail-acceptance-unconfirmed");
  }
}
