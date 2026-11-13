import { vi } from "vitest";
import axios from "axios";
import { sendEmailToSigners } from "./Utils";

vi.mock("axios", () => ({ default: { post: vi.fn(), put: vi.fn() } }));
vi.mock("../i18n", () => ({ default: { t: (key) => key } }));
vi.mock("../utils", () => ({}));
vi.mock("print-js", () => ({ default: vi.fn() }));

const signers = [
  { objectId: "first", Email: "first@example.test" },
  { objectId: "second", Email: "second@example.test" }
];
const document = [
  {
    objectId: "test-document",
    Name: "Test",
    createdAt: "2026-11-13T00:00:00Z",
    ExtUserPtr: {
      objectId: "owner",
      Email: "owner@example.test",
      Name: "Owner"
    }
  }
];
const response = (status) => ({ data: { result: { status } } });
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.setItem("accesstoken", "mock-session");
  localStorage.setItem("baseUrl", "https://example.test/app/");
});

it.each(["error", undefined])(
  "does not let a final success hide an earlier %s",
  async (status) => {
    axios.post
      .mockResolvedValueOnce(response(status))
      .mockResolvedValueOnce(response("success"));
    const result = await sendEmailToSigners(document, signers);
    expect(result.status).toBe("partial");
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.put).not.toHaveBeenCalled();
  }
);

it("does not let a final success hide an earlier network failure", async () => {
  axios.post
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(response("success"));
  const result = await sendEmailToSigners(document, signers);
  expect(result.status).toBe("partial");
  expect(result.results[0]).toEqual({
    recipient: "first@example.test",
    status: "error"
  });
  expect(axios.put).not.toHaveBeenCalled();
});

it("records SendMail only after every targeted recipient is accepted", async () => {
  axios.post.mockResolvedValue(response("success"));
  const result = await sendEmailToSigners(document, signers);
  expect(result.status).toBe("success");
  expect(axios.put).toHaveBeenCalledWith(
    "https://example.test/app/classes/contracts_Document/test-document",
    { SendMail: true },
    expect.any(Object)
  );
});

it("does not report success when no recipients are targeted", async () => {
  expect((await sendEmailToSigners(document, [])).status).toBe("error");
  expect(axios.put).not.toHaveBeenCalled();
});

it("keeps the first-recipient-only behavior for send in order", async () => {
  axios.post.mockResolvedValue(response("success"));
  const result = await sendEmailToSigners(
    [{ ...document[0], SendinOrder: true }],
    signers
  );
  expect(result.status).toBe("success");
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0][1].recipient).toBe("first@example.test");
});
