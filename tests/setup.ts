import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// Redis isn't spun up for tests — ioredis-mock behaves like a real
// ioredis client for the Set/pub-sub commands this app actually uses, so
// the room/presence services under test don't need a real Redis server.
jest.mock("ioredis", () => require("ioredis-mock"));

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
