const request = require("supertest");

jest.mock("../src/models/AdminUser");
jest.mock("../src/models/AdminInvitation");
jest.mock("../src/models/AdminAuditLog");
jest.mock("../src/services/email.service");

const createApp = require("../src/app");
const AdminUser = require("../src/models/AdminUser");
const AdminInvitation = require("../src/models/AdminInvitation");
const { sendAdminInvitationEmail } = require("../src/services/email.service");
const { signAccessToken } = require("../src/services/token.service");

const app = createApp();
const owner = `Bearer ${signAccessToken("owner1", "Owner")}`;
const manager = `Bearer ${signAccessToken("manager1", "Manager")}`;
const staff = `Bearer ${signAccessToken("staff1", "Staff")}`;

beforeEach(() => {
  jest.clearAllMocks();
  AdminUser.findById.mockImplementation((id) => Promise.resolve({ _id: id, name: "Admin", email: `${id}@test.com`, role: id === "staff1" ? "Staff" : id === "manager1" ? "Manager" : "Owner", isActive: true, sessionVersion: 0 }));
  AdminUser.exists.mockResolvedValue(false);
  AdminInvitation.updateMany.mockResolvedValue({});
  AdminInvitation.create.mockResolvedValue({ _id: "inv1", email: "new@test.com", name: "New Staff", role: "Staff", expiresAt: new Date() });
  sendAdminInvitationEmail.mockResolvedValue(true);
});

describe("Phase 12/13 chat and admin role security", () => {
  it("denies staff access to staff management", async () => {
    const res = await request(app).get("/api/staff").set("Authorization", staff);
    expect(res.status).toBe(403);
  });

  it("lets managers invite Staff but not Owner", async () => {
    const allowed = await request(app).post("/api/staff/invitations").set("Authorization", manager).send({ name: "New Staff", email: "new@test.com", role: "Staff" });
    expect(allowed.status).toBe(201);
    const denied = await request(app).post("/api/staff/invitations").set("Authorization", manager).send({ name: "New Owner", email: "owner@test.com", role: "Owner" });
    expect(denied.status).toBe(403);
  });

  it("requires authenticated admin chat APIs for mutations", async () => {
    const res = await request(app).post("/api/chat/threads/t1/messages").send({ text: "hello" });
    expect(res.status).toBe(401);
  });
});
