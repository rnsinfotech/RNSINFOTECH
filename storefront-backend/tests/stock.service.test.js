jest.mock("../src/models/Product");
jest.mock("../src/models/InventoryLog");
jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");
  return { ...actual, startSession: jest.fn() };
});

const mongoose = require("mongoose");
const Product = require("../src/models/Product");
const InventoryLog = require("../src/models/InventoryLog");
const { decrementStock, restoreStock } = require("../src/services/stock.service");

beforeEach(() => {
  jest.clearAllMocks();
  InventoryLog.create.mockResolvedValue({});
});

describe("decrementStock", () => {
  it("uses a session transaction when one is available and decrements every item", async () => {
    const withTransaction = jest.fn(async (fn) => fn());
    const endSession = jest.fn().mockResolvedValue();
    mongoose.startSession.mockResolvedValue({ withTransaction, endSession });
    Product.findOneAndUpdate.mockResolvedValue({ _id: "p1", stock: 3 });

    await decrementStock([{ product: "p1", name: "Wave Tablet", quantity: 2 }]);

    expect(withTransaction).toHaveBeenCalled();
    expect(endSession).toHaveBeenCalled();
    expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "p1", stock: { $gte: 2 } },
      { $inc: { stock: -2 } },
      expect.objectContaining({ new: true })
    );
  });

  it("falls back to sequential per-item updates when transactions aren't supported", async () => {
    mongoose.startSession.mockRejectedValue(new Error("Transaction numbers are only allowed on a replica set"));
    Product.findOneAndUpdate.mockResolvedValue({ _id: "p1", stock: 3 });

    await decrementStock([{ product: "p1", name: "Wave Tablet", quantity: 2 }]);

    expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "p1", stock: { $gte: 2 } },
      { $inc: { stock: -2 } },
      { new: true }
    );
  });

  it("compensates already-decremented items when a later item is out of stock (fallback path)", async () => {
    mongoose.startSession.mockRejectedValue(new Error("not supported"));
    Product.findOneAndUpdate
      .mockResolvedValueOnce({ _id: "p1", stock: 1 }) // first item succeeds
      .mockResolvedValueOnce(null); // second item out of stock
    Product.updateOne.mockResolvedValue({});

    await expect(
      decrementStock([
        { product: "p1", name: "Wave Tablet", quantity: 1 },
        { product: "p2", name: "Stylus", quantity: 5 },
      ])
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(Product.updateOne).toHaveBeenCalledWith({ _id: "p1" }, { $inc: { stock: 1 } });
  });

  it("raises a 409 without touching stock.service's own retry when the transaction path itself reports insufficient stock", async () => {
    const withTransaction = jest.fn(async (fn) => fn());
    const endSession = jest.fn().mockResolvedValue();
    mongoose.startSession.mockResolvedValue({ withTransaction, endSession });
    Product.findOneAndUpdate.mockResolvedValue(null);

    await expect(decrementStock([{ product: "p1", name: "Wave Tablet", quantity: 99 }])).rejects.toMatchObject({
      statusCode: 409,
    });

    // Only the transaction path's single call — no fallback re-attempt.
    expect(Product.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("restoreStock", () => {
  it("increments stock back for every item", async () => {
    Product.updateOne.mockResolvedValue({});

    await restoreStock([
      { product: "p1", quantity: 2 },
      { product: "p2", quantity: 1 },
    ]);

    expect(Product.updateOne).toHaveBeenCalledWith({ _id: "p1" }, { $inc: { stock: 2 } });
    expect(Product.updateOne).toHaveBeenCalledWith({ _id: "p2" }, { $inc: { stock: 1 } });
  });
});
