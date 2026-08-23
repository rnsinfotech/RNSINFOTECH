const mongoose = require("mongoose");

jest.mock("../src/models/Order");

const Order = require("../src/models/Order");
const { canTransition, transitionOrder } = require("../src/services/orderLifecycle.service");

// Simplified 4-state order lifecycle — see PROGRESS_ORDER_SIMPLIFICATION.md.
// pending -> confirmed -> shipped (terminal), or pending/confirmed ->
// cancelled (terminal). Nothing else exists anymore.
describe("Order lifecycle", () => {
  beforeEach(() => jest.clearAllMocks());

  test("allows only the canonical next transition", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("pending", "cancelled")).toBe(true);
    expect(canTransition("confirmed", "shipped")).toBe(true);
    expect(canTransition("confirmed", "cancelled")).toBe(true);
    expect(canTransition("pending", "shipped")).toBe(false);
    expect(canTransition("shipped", "cancelled")).toBe(false);
    expect(canTransition("shipped", "confirmed")).toBe(false);
    expect(canTransition("cancelled", "pending")).toBe(false);
  });

  test("transition records timestamp/history and saves when using a mocked model", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const order = { _id: new mongoose.Types.ObjectId(), status: "confirmed", statusHistory: [], save };
    Order.findOneAndUpdate.mockResolvedValue(undefined);

    const updated = await transitionOrder(order, "shipped", { actorType: "admin", actorId: order._id, note: "Shipped" });

    expect(updated.status).toBe("shipped");
    expect(updated.shippedAt).toBeInstanceOf(Date);
    expect(updated.statusHistory).toHaveLength(1);
    expect(updated.statusHistory[0].status).toBe("shipped");
    expect(save).toHaveBeenCalled();
  });

  test("rejects an invalid transition", async () => {
    const order = { _id: new mongoose.Types.ObjectId(), status: "pending", statusHistory: [], save: jest.fn() };

    await expect(transitionOrder(order, "shipped", { actorType: "admin" })).rejects.toMatchObject({ statusCode: 409 });
    expect(order.save).not.toHaveBeenCalled();
  });
});
