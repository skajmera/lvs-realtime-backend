# LVS Realtime — Live Streaming & Group Voice Chat Backend

Technical assignment for LVS Innovation Pvt. Ltd. (Backend Developer —
Real-Time Systems). A mini backend for a live streaming / group voice
chat app: auth, rooms, real-time events over Socket.IO, LiveKit-powered
audio/video rooms, Redis-backed presence and room state, MongoDB
persistence, Docker, and a CI pipeline.

Approximate time spent: ~7.5 hours.

## Project overview

Users register/log in, create or join "rooms" (a live room = a
LiveKit session), and the backend hands out a LiveKit access token so
the client can connect and publish/subscribe audio+video. Room
membership, join/leave, and lightweight in-room messaging happen over
Socket.IO in real time, broadcast only to the sockets actually in that
room. Redis holds the fast-changing state (who's online, who's in which
room right now) and powers the Socket.IO Redis adapter so the same
events stay correct across multiple server instances.

## Architecture

```
Client
  │  HTTP (REST)                    │  WebSocket (Socket.IO)
  ▼                                  ▼
Express app  ──────────────────  Socket.IO server
  │  auth / rooms / livekit           │  room:join, room:leave,
  │  routes → controllers →           │  room:message, presence
  │  services                         │  (same room.service.ts +
  ▼                                   │   redisState.service.ts)
MongoDB (Mongoose)              Redis (ioredis)
  User, Room,                    presence:online (Set)
  ParticipantLog                 room:<id>:participants (Set)
                                  + Socket.IO Redis adapter (pub/sub)
                                          │
                                          ▼
                                   LiveKit Cloud/Server
                                   (access tokens; actual media
                                   never touches this backend)
```

`src/services/room.service.ts` is the single place join/leave/create
logic lives — both the REST controllers and the Socket.IO handlers call
into it, so a socket-driven join and an HTTP-driven join behave
identically and can't drift apart.

## Technologies used

Node.js, TypeScript, Express, MongoDB (Mongoose), Redis (ioredis),
Socket.IO + `@socket.io/redis-adapter`, LiveKit (`livekit-server-sdk`),
JWT (`jsonwebtoken`), `bcryptjs`, `zod` for request validation, Docker,
GitHub Actions, Jest + Supertest + `mongodb-memory-server` +
`ioredis-mock` for tests.

## Setup instructions

```bash
npm install
cp .env.example .env   # fill in MongoDB/Redis/LiveKit values, see below
npm run dev             # ts-node-dev, hot reload
# or
npm run build && npm start
```

Or run everything (app + MongoDB + Redis) with Docker Compose:

```bash
cp .env.example .env    # at minimum set JWT_SECRET and the LIVEKIT_* values
docker compose up --build
```

`docker-compose.yml` wires the app to its own `mongo` and `redis`
containers automatically — you only need LiveKit credentials from a real
account (free tier at https://cloud.livekit.io) for the LiveKit-related
endpoints; everything else works without them.

## Environment variables

| Variable              | Purpose                                              |
| ---------------------- | ----------------------------------------------------- |
| `PORT`                 | HTTP port (default 4000)                              |
| `NODE_ENV`             | `development` / `production` / `test`                |
| `MONGODB_URI`          | Mongo connection string                                |
| `REDIS_URL`            | Redis connection string                                |
| `JWT_SECRET`           | Signing secret for auth tokens                         |
| `JWT_EXPIRES_IN`       | Token lifetime (e.g. `7d`)                             |
| `LIVEKIT_API_KEY`      | From your LiveKit project                              |
| `LIVEKIT_API_SECRET`   | From your LiveKit project                              |
| `LIVEKIT_SERVER_URL`   | `wss://<project>.livekit.cloud`                        |
| `CORS_ORIGIN`          | Allowed origin(s) for the REST API                     |

## API documentation

All authenticated routes expect `Authorization: Bearer <token>`. Full
request/response examples are in `postman/LVS-Realtime.postman_collection.json`
— import it and run Register → Login → Create room → Join → LiveKit token
in order (the collection auto-saves the token/roomId between requests).

### Auth

| Method | Path             | Auth | Body                                  |
| ------ | ---------------- | ---- | -------------------------------------- |
| POST   | `/api/auth/register` | –    | `{ name, email, password, profileImage? }` |
| POST   | `/api/auth/login`    | –    | `{ email, password }`                  |
| GET    | `/api/users/me`      | ✅    | –                                       |

### Rooms

| Method | Path                    | Auth | Body               |
| ------ | ----------------------- | ---- | -------------------- |
| POST   | `/api/rooms`             | ✅    | `{ name }`            |
| GET    | `/api/rooms`             | ✅    | – (active rooms only) |
| GET    | `/api/rooms/:id`         | ✅    | –                     |
| POST   | `/api/rooms/:id/join`    | ✅    | –                     |
| POST   | `/api/rooms/:id/leave`   | ✅    | –                     |

The room creator becomes both `host` and the first participant. If the
host leaves (or the last participant leaves), the room's `status`
becomes `ended` and its Redis participant set is cleared.

### LiveKit

`POST /api/livekit/token`

```json
// Request
{ "roomName": "<room id or name>", "role": "host" }

// Response
{ "token": "<livekit jwt>", "serverUrl": "wss://...", "roomName": "..." }
```

`role: "host"` grants `roomAdmin` (mute/remove others) in addition to
publish/subscribe; `"participant"` (the default) can still publish
audio/video (this is a group chat, not a broadcast-only webinar) but
can't moderate others.

## Socket events

Connect with `io(url, { auth: { token: "<jwt>" } })`.

| Event (client→server) | Payload                    | Effect                                      |
| ---------------------- | --------------------------- | --------------------------------------------- |
| `room:join`            | `{ roomId }`                 | Joins the room; ack returns the room state    |
| `room:leave`           | `{ roomId }`                 | Leaves the room; ack confirms                 |
| `room:message`         | `{ roomId, message }`        | Broadcasts a message to everyone in the room  |

| Event (server→client)         | Payload                                    |
| -------------------------------- | -------------------------------------------- |
| `user:online` / `user:offline`   | `{ userId }` (broadcast to everyone connected) |
| `room:participant-joined`        | `{ roomId, userId, participantCount }` (room only) |
| `room:participant-left`          | `{ roomId, userId, participantCount }` (room only) |
| `room:status-update`             | `{ roomId, status: "ended" }` (room only, when it ends) |
| `room:message`                   | `{ roomId, userId, message, sentAt }` (room only) |

Every room-scoped event is emitted to the Socket.IO room channel
(`room:<roomId>`) only, never a global broadcast — a client not in that
room never receives it. Disconnecting a socket (tab closed, network
drop) automatically runs the same leave logic for every room that socket
had joined, so state never goes stale from a client that vanished
without calling `room:leave`.

## Redis implementation

Two Sets per moving part:

- `presence:online` — every currently-connected user's id.
- `room:<roomId>:participants` — mirrors `Room.participants` for O(1)
  reads without hitting Mongo on every socket event.

Plus the **Socket.IO Redis adapter** (`@socket.io/redis-adapter`), using
a dedicated pub/sub connection pair (`getRedis()` and its `.duplicate()`).

**Why Redis, and why MongoDB alone wasn't enough:** presence and
room-membership change on *every* join/leave/heartbeat — that's a
disk-backed write on a busy system if it goes straight to Mongo, and it's
data nobody needs after the process restarts anyway (it's derived from
"who's currently connected", not a durable fact). Redis absorbs that
volume at in-memory speed. More importantly, once this runs as more than
one server process (which it has to, to reach the 10k-user target below),
each process only knows about *its own* connected sockets — Socket.IO's
Redis adapter is what lets `io.to(room).emit(...)` on one instance reach
a socket connected to a different instance, via Redis pub/sub. That's not
something MongoDB does at all; it's a distinct, real-time-messaging shaped
problem MongoDB isn't built for. MongoDB stays the source of truth for
everything that actually needs to survive a restart: `User.isOnline` gets
updated too (so a REST client asking "is this user online" doesn't need
Redis), and `ParticipantLog` is a durable join/leave history that outlives
the room ending.

## MongoDB

Three collections: `User`, `Room`, `ParticipantLog` (the "room history"
collection — every join/leave, kept even after the room ends or a
participant leaves; `Room.participants` only reflects who's in the room
*right now*).

- Unique index on `User.email` (also the login lookup key).
- Compound index on `Room.{status, createdAt}` — backs the "list active
  rooms, newest first" query directly.
- Indexes on `ParticipantLog.{room, user}` for history lookups.
- `User.password` is `select: false` — it's never returned by a normal
  query, only pulled in explicitly (with `.select("+password")`) for the
  login check.

## Docker

```bash
docker compose up --build
```

Multi-stage `Dockerfile`: dependencies + `tsc` build happen in a
`node:20-alpine` builder stage; the final image only carries the compiled
`dist/` output and production dependencies. `docker-compose.yml` runs the
app alongside its own MongoDB and Redis containers with named volumes for
persistence.

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`: install →
lint → build → test (against an in-memory MongoDB and a mocked Redis, so
CI needs no external services) → build the Docker image. It's a build
gate, not an auto-deploy — the assignment explicitly says not to use LVS
Innovation's production infrastructure, so there's deliberately no deploy
step wired to any real target.

## Server & deployment

Not deployed to a persistent public server for this assignment (per the
instruction not to use LVS Innovation's infrastructure) — `docker compose
up` reproduces the intended production shape (app + Mongo + Redis, each
in its own container) locally. For a real deployment on Ubuntu:

1. Install Docker + Docker Compose, `git clone` the repo, `.env` from
   `.env.example` with production secrets.
2. `docker compose up -d --build`, then put Nginx in front as a reverse
   proxy (HTTP → the app's port 4000, plus WebSocket upgrade headers for
   Socket.IO's `/socket.io/` path) with a Let's Encrypt (Certbot)
   certificate for SSL/HTTPS.
3. Application logs go to stdout/stderr (Docker's default logging
   driver) — `docker compose logs -f app`, or ship them to a log
   aggregator (e.g. Loki/CloudWatch) in a real deployment.
4. Basic monitoring: `GET /health` for a liveness probe, plus
   container-level CPU/memory via `docker stats` or a metrics agent.

## Scalability approach — 100 → 10,000+ concurrent users

- **Backend**: the app is stateless (all session state is the JWT itself,
  no server-side session store) — run N copies behind a load balancer.
  Nothing in `src/` assumes it's the only instance.
- **WebSocket**: this is the part that *isn't* stateless by default —
  Socket.IO rooms only exist per-process. The Redis adapter already wired
  in (`src/sockets/index.ts`) solves exactly this: every instance
  publishes room events through Redis pub/sub, so a client on instance A
  and a client on instance B in the same room both get the event. The
  load balancer needs sticky sessions (or Socket.IO's own session-affinity
  cookie) since a given socket's polling/upgrade handshake must land on
  the same instance for its duration.
- **Redis**: a single Redis instance is fine for a while, but at real
  scale move to Redis Cluster (or a managed cluster mode like
  ElastiCache/Upstash) so the pub/sub and presence load isn't a single
  point of failure or a single-core bottleneck — `ioredis` supports
  cluster mode with no application code changes.
- **MongoDB**: add read replicas for the read-heavy `GET /rooms` /
  `GET /rooms/:id` paths, and shard by a key like `roomId` if write volume
  on `ParticipantLog` ever becomes the bottleneck (it's an append-heavy
  collection by design).
- **LiveKit**: this is actually the part that scales the *least* through
  this backend — LiveKit's own SFU cluster handles all real media
  traffic; this backend only ever issues short-lived tokens, so LiveKit's
  horizontal scaling is LiveKit Cloud's/self-hosted cluster's concern, not
  something this Express app needs to solve.
- **Load balancing**: an L7 load balancer (Nginx, or a cloud ALB) in front
  of N app instances, health-checked via `GET /health`, with sticky
  sessions for the Socket.IO upgrade path specifically.
- **Server infrastructure**: containerize everything (already done),
  orchestrate with Kubernetes or ECS once instance count is manual-scaling
  hostile, and autoscale on CPU/connection-count rather than a fixed
  instance count.

## Known limitations

- LiveKit webhooks (participant/room events, bonus in the spec) aren't
  implemented — token issuance is, which is the mandatory part.
- No refresh-token rotation; a single long-lived JWT is used for
  simplicity, matching the assignment's stated auth scope.
- `room:message` is unpersisted (pure real-time relay) — no chat-history
  collection, since it wasn't in the required schema list.
- Rate limiting is in-memory (`express-rate-limit`) and per-instance, not
  shared across instances — fine for one process, would need a
  Redis-backed limiter store at the multi-instance scale described above.
