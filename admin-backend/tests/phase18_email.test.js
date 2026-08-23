const { render } = require("../src/services/emailTemplates.service");

describe("Phase 18 — transactional emails", () => {
  test("renders refund template without storing message content", () => {
    const mail = render("refund", { orderId: "ORD-2", amount: 149, status: "processed", refundId: "rfnd_1" });
    expect(mail.subject).toContain("ORD-2");
    expect(mail.html).toContain("rfnd_1");
  });
});
