import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

async function registerAndGetToken(email: string): Promise<string> {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "User", email, password: "password123" });
  return res.body.token;
}

describe("Rooms", () => {
  it("creates a room with the creator as host and sole participant", async () => {
    const token = await registerAndGetToken("host@example.com");

    const res = await request(app)
      .post("/api/rooms")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "My Live Room" });

    expect(res.status).toBe(201);
    expect(res.body.room.name).toBe("My Live Room");
    expect(res.body.room.participantCount).toBe(1);
    expect(res.body.room.status).toBe("active");
  });

  it("rejects room creation without auth", async () => {
    const res = await request(app).post("/api/rooms").send({ name: "No Auth Room" });
    expect(res.status).toBe(401);
  });

  it("lists only active rooms", async () => {
    const token = await registerAndGetToken("lister@example.com");
    await request(app).post("/api/rooms").set("Authorization", `Bearer ${token}`).send({ name: "Room A" });

    const res = await request(app).get("/api/rooms").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rooms.length).toBeGreaterThanOrEqual(1);
    expect(res.body.rooms.every((r: { status: string }) => r.status === "active")).toBe(true);
  });

  it("lets a second user join and increases participant count", async () => {
    const hostToken = await registerAndGetToken("host2@example.com");
    const guestToken = await registerAndGetToken("guest@example.com");

    const createRes = await request(app)
      .post("/api/rooms")
      .set("Authorization", `Bearer ${hostToken}`)
      .send({ name: "Joinable Room" });
    const roomId = createRes.body.room.id;

    const joinRes = await request(app)
      .post(`/api/rooms/${roomId}/join`)
      .set("Authorization", `Bearer ${guestToken}`);

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.room.participantCount).toBe(2);
  });

  it("ends the room when the host leaves", async () => {
    const hostToken = await registerAndGetToken("host3@example.com");

    const createRes = await request(app)
      .post("/api/rooms")
      .set("Authorization", `Bearer ${hostToken}`)
      .send({ name: "Room To End" });
    const roomId = createRes.body.room.id;

    const leaveRes = await request(app)
      .post(`/api/rooms/${roomId}/leave`)
      .set("Authorization", `Bearer ${hostToken}`);

    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body.room.status).toBe("ended");
  });

  it("returns 404 for a non-existent room", async () => {
    const token = await registerAndGetToken("notfound@example.com");
    const res = await request(app)
      .get("/api/rooms/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
