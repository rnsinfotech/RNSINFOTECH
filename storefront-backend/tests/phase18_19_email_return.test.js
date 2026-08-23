jest.mock("../src/models/ReturnRequest");
const ReturnRequest = require("../src/models/ReturnRequest");
const { canTransition, transitionReturn } = require("../src/services/return.service");
const { render } = require("../src/services/emailTemplates.service");

describe("Phase 18–19 email and returns", () => {
  test("renders branded transactional templates without requiring SMTP", () => {
    const mail = render("shipping", { orderId:"ORD-1", courier:"BlueDart", trackingId:"TRK-9" });
    expect(mail.subject).toContain("ORD-1");
    expect(mail.html).toContain("RNS INFOTECH");
    expect(mail.html).toContain("BlueDart");
  });

  test("return lifecycle only permits valid transitions", () => {
    expect(canTransition("requested","approved")).toBe(true);
    expect(canTransition("requested","received")).toBe(false);
    expect(canTransition("received","refunded")).toBe(true);
    expect(canTransition("refunded","approved")).toBe(false);
  });

  test("return transition is concurrency safe", async () => {
    const updated = { _id:"r1", status:"approved" };
    ReturnRequest.findOneAndUpdate.mockResolvedValueOnce(updated);
    const result = await transitionReturn({ _id:"r1", status:"requested" }, "approved", { actorType:"admin", actorId:"a1" });
    expect(result).toBe(updated);
    expect(ReturnRequest.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({_id:"r1",status:"requested"}),
      expect.objectContaining({$set:{status:"approved"},$push:expect.any(Object)}),
      {new:true}
    );
  });

  test("return transition rejects stale concurrent state", async () => {
    ReturnRequest.findOneAndUpdate.mockResolvedValueOnce(null);
    await expect(transitionReturn({ _id:"r1", status:"requested" }, "approved")).rejects.toMatchObject({statusCode:409});
  });
});
