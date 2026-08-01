import { mailModalHead } from "./widgetUtils";

const SUCCESS_HEADS = ["mails-sent", "mail-status-head"];
const FAILURE_STATUSES = [
  "failed",
  "quotareached",
  "dailyquotareached",
  "emailnotverified"
];

describe("mailModalHead", () => {
  describe("a send that did not succeed is never reported as success", () => {
    // Regression: send-in-order used to hardcode its heading, so a failed
    // send was announced as "Mails Sent" to non-owners and as "Next step:
    // Sign your document?" to owners. Both hid the failure from the sender.
    it.each(FAILURE_STATUSES)(
      "does not claim success for %s in any flow",
      (status) => {
        for (const sendinOrder of [true, false]) {
          for (const isOwner of [true, false]) {
            expect(SUCCESS_HEADS).not.toContain(
              mailModalHead(sendinOrder, status, isOwner)
            );
          }
        }
      }
    );

    it("surfaces a failed send-in-order request to a non-owner", () => {
      expect(mailModalHead(true, "failed", false)).toBe("mail-not-delivered");
    });

    it("surfaces a failed send-in-order request to the owner", () => {
      expect(mailModalHead(true, "failed", true)).toBe("mail-not-delivered");
    });

    it("reports a quota failure as a quota problem, not a generic one", () => {
      expect(mailModalHead(true, "quotareached", false)).toBe(
        "quota-mail-head"
      );
      expect(mailModalHead(false, "dailyquotareached", true)).toBe(
        "quota-mail-head"
      );
    });

    it("keeps the unverified-email heading in every flow", () => {
      expect(mailModalHead(true, "emailnotverified", true)).toBe(
        "email-not-verified-head"
      );
      expect(mailModalHead(false, "emailnotverified", false)).toBe(
        "email-not-verified-head"
      );
    });

    it("falls back to not-delivered for an unrecognised status", () => {
      expect(mailModalHead(true, "some-new-status", false)).toBe(
        "mail-not-delivered"
      );
    });
  });

  describe("successful and pending sends keep their existing headings", () => {
    it("prompts the owner to sign when they are first in a send-in-order flow", () => {
      expect(mailModalHead(true, "success", true)).toBe("mail-status-head");
    });

    it("confirms delivery to a non-owner in a send-in-order flow", () => {
      expect(mailModalHead(true, "success", false)).toBe("mails-sent");
    });

    it("confirms delivery when signers are emailed at once", () => {
      expect(mailModalHead(false, "success", true)).toBe("mails-sent");
      expect(mailModalHead(false, "success", false)).toBe("mails-sent");
    });

    it("leaves the pre-send heading untouched", () => {
      expect(mailModalHead(true, "", true)).toBe("mail-status-head");
      expect(mailModalHead(true, "", false)).toBe("mails-sent");
      expect(mailModalHead(false, "", false)).toBe("mail-not-delivered");
    });
  });
});
