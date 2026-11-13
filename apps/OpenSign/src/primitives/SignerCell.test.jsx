import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import SignerCell from "./SignerCell";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key })
}));
vi.mock("../constant/Utils", () => ({
  formatDateTime: () => "date",
  getSignerEmail: () => "recipient@example.test"
}));
vi.mock("./ModalUi", () => ({ default: () => null }));

it.each([
  [undefined, "PENDING"],
  ["Viewed", "VIEWED"],
  ["Signed", "SIGNED"]
])(
  "uses an actual audit event, or pending when none exists (%s)",
  (activity, label) => {
    const item = {
      objectId: "doc",
      Placeholders: [{ signerObjId: "recipient" }],
      AuditTrail: activity
        ? [{ UserPtr: { objectId: "recipient" }, Activity: activity }]
        : []
    };
    render(
      <table>
        <tbody>
          <tr>
            <SignerCell
              reportName="In-progress documents"
              item={item}
              handleRemovePrefill={() => true}
            />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText("SENT")).not.toBeInTheDocument();
  }
);
