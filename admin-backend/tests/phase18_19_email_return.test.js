jest.mock("../src/models/ReturnRequest");
const ReturnRequest = require("../src/models/ReturnRequest");
const { canTransition, transitionReturn } = require("../src/services/return.service");
const { render } = require("../src/services/emailTemplates.service");

describe("Phase 18–19 email and returns", () => {
  beforeEach(() => jest.clearAllMocks());
  test("renders refund template without storing message content", () => {
    const mail=render("refund",{orderId:"ORD-2",amount:149,status:"processed",refundId:"rfnd_1"});
    expect(mail.subject).toContain("ORD-2");
    expect(mail.html).toContain("rfnd_1");
  });
  test("validates return lifecycle",()=>{
    expect(canTransition("requested","approved")).toBe(true);
    expect(canTransition("requested","received")).toBe(false);
    expect(canTransition("received","refunded")).toBe(true);
    expect(canTransition("refunded","approved")).toBe(false);
  });
  test("rejects stale concurrent transition",async()=>{
    ReturnRequest.findOneAndUpdate.mockResolvedValueOnce(null);
    await expect(transitionReturn({_id:"r1",status:"requested"},"approved")).rejects.toMatchObject({statusCode:409});
  });
});
