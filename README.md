# Backend Realtime Interview Task

A small NestJS service that receives biometric measurements from wearable devices and exposes live updates to connected clients.

```
Wearable / Client  →  POST /measurements  →  Backend  →  PostgreSQL
                                                  ↓
                                   Socket.IO room "user:<userId>"
                                                  ↓
                                  clients subscribed to that user
```

## Stack

- Node.js + TypeScript
- NestJS
- PostgreSQL + TypeORM
- Socket.IO / WebSockets
- Redis is available in Docker, but is **not required for the initial task**

## Prerequisites

- Node.js 20+
- Docker + Docker Compose

## Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run migration:run
npm run start:dev
```

Health check:

```bash
curl http://localhost:3000/health
```

Run tests:

```bash
npm test
```

Listen for realtime events in one terminal:

```bash
npm run listen -- user-123
```

Generate sample events in another terminal:

```bash
npm run simulate -- user-123
```

## HTTP API

### `POST /measurements`

Accepts one measurement from a wearable, stores it in PostgreSQL and pushes it to every WebSocket client subscribed to that user.

```json
{
  "userId": "user-123",
  "timestamp": "2026-09-15T10:15:22.120Z",
  "heartRate": 87,
  "hrv": 42
}
```

| Field       | Rules                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------- |
| `userId`    | required string, 1–100 characters after trimming                                            |
| `timestamp` | required ISO-8601 date-time including the time part, e.g. `2026-09-15T10:15:22.120Z`        |
| `heartRate` | required integer, 20–250                                                                    |
| `hrv`       | optional number ≥ 0; stored as `null` when omitted                                          |
| `eventId`   | optional device-side event id, 1–100 characters; the server assigns a UUID when omitted     |

Responses:

- `201 Created` with the persisted measurement (adds `id`, `eventId`, `createdAt`).
- `400 Bad Request` for missing, invalid or unknown fields. `message` lists every violation. Nothing is stored or published.
- `500 Internal Server Error` when the database write fails. Nothing is published.

The database write is the source of truth. The realtime push happens only after the row is saved, and a push failure is logged instead of failing the request, because a failed request would make the device retry and store a duplicate.

### `GET /measurements/:userId?limit=20`

Most recent measurements for one user, newest first (`limit` is capped at 100).

## WebSocket protocol

Socket.IO on the same port as the HTTP API.

| Direction       | Event         | Payload                                      | Notes                                                                                  |
| --------------- | ------------- | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| client → server | `subscribe`   | `{ "userId": "user-123" }`                   | Ack: `{ "subscribed": true, "userId": "user-123" }`. A client may follow several users. |
| client → server | `unsubscribe` | `{ "userId": "user-123" }`                   | Ack: `{ "subscribed": false, "userId": "user-123" }`                                    |
| server → client | `measurement` | the persisted measurement (same shape as the `201` body) | Sent only to sockets subscribed to that `userId`.                          |
| server → client | `exception`   | `{ "status": "error", "message": "..." }`    | Invalid `subscribe` / `unsubscribe` payload. The ack is not called in this case.       |

Every user has a Socket.IO room named `user:<userId>`. A measurement is emitted to that room only, so sockets that never subscribed to the user, or subscribed to a different one, never receive it. Delivery is fire-and-forget: a client that connects later catches up through `GET /measurements/:userId`.

## Known limitations

- **No authentication.** Any client can subscribe to any `userId`. Rooms prevent accidental cross-user delivery, not a malicious subscriber. Production needs credentials in the Socket.IO handshake and an authorization check in `subscribe`.
- **No idempotency.** `eventId` is stored but not unique, so a retried `POST` creates a second row. A unique index on `(userId, eventId)` with an idempotent insert is the natural next step.
- **Single instance.** `RealtimeBus` calls the gateway in-process. Fan-out across instances would go through the Socket.IO Redis adapter (Redis is already in `docker-compose.yml`).
