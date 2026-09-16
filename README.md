# Backend Realtime Interview Task

A small NestJS service that receives biometric measurements from wearable devices and exposes live updates to connected clients.

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

## Candidate task

See [TASK.md](./TASK.md).

## Notes

This repository intentionally contains incomplete code. That is part of the exercise.
