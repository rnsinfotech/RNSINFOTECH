const { render } = require("../src/services/emailTemplates.service");

describe("Phase 18 — transactional emails", () => {
  test("renders branded transactional templates without requiring SMTP", () => {
    const mail = render("shipping", { orderId: "ORD-1", courier: "BlueDart", trackingId: "TRK-9" });
    expect(mail.subject).toContain("ORD-1");
    expect(mail.html).toContain("RNS INFOTECH");
    expect(mail.html).toContain("BlueDart");
  });
});
