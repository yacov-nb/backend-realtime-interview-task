import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { io, Socket } from 'socket.io-client';
import { createValidationPipe } from '../src/common/validation';
import { Measurement } from '../src/measurements/measurement.entity';
import { MeasurementsModule } from '../src/measurements/measurements.module';

/**
 * Boots the real Nest application (HTTP + Socket.IO) with only the TypeORM
 * repository replaced by an in-memory fake, then drives it the way a wearable
 * and a web client would.
 */

// The payload documented for the wearable (note: no eventId).
const wearablePayload = {
  userId: 'user-123',
  timestamp: '2026-09-15T10:15:22.120Z',
  heartRate: 87,
  hrv: 42,
};

describe('measurement ingestion (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MeasurementsModule],
    })
      .overrideProvider(getRepositoryToken(Measurement))
      .useValue(repository)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(createValidationPipe());
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    repository.create.mockImplementation((input) => ({ ...input }));
    repository.save.mockImplementation(async (entity) => ({
      ...entity,
      id: `id-${entity.eventId}`,
      createdAt: new Date('2026-09-15T10:15:23.000Z'),
    }));
  });

  const post = (body: BodyInit) =>
    fetch(`${baseUrl}/measurements`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
  const postJson = (body: unknown) => post(JSON.stringify(body));

  describe('POST /measurements', () => {
    it('accepts the documented wearable payload and returns the persisted measurement', async () => {
      const response = await postJson(wearablePayload);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toMatchObject({
        userId: 'user-123',
        timestamp: '2026-09-15T10:15:22.120Z',
        heartRate: 87,
        hrv: 42,
      });
      expect(typeof body.eventId).toBe('string');
      expect(body.eventId).not.toBe('');
      expect(body.id).toBe(`id-${body.eventId}`);
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('keeps the eventId supplied by the device', async () => {
      const response = await postJson({ ...wearablePayload, eventId: 'evt-device-1' });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ eventId: 'evt-device-1' });
    });

    it('accepts a measurement without hrv and stores it as null', async () => {
      const { hrv: _omitted, ...withoutHrv } = wearablePayload;
      const response = await postJson(withoutHrv);

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ hrv: null });
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ hrv: null }));
    });

    it.each([
      ['a missing userId', { ...wearablePayload, userId: undefined }],
      ['a blank userId', { ...wearablePayload, userId: '   ' }],
      ['a non-string userId', { ...wearablePayload, userId: 123 }],
      ['a userId longer than the column', { ...wearablePayload, userId: 'x'.repeat(101) }],
      ['a blank eventId', { ...wearablePayload, eventId: '' }],
      ['a missing timestamp', { ...wearablePayload, timestamp: undefined }],
      ['a non-ISO timestamp', { ...wearablePayload, timestamp: 'yesterday' }],
      ['a date-only timestamp', { ...wearablePayload, timestamp: '2026-09-15' }],
      ['an impossible date', { ...wearablePayload, timestamp: '2026-02-30T10:00:00.000Z' }],
      ['a missing heartRate', { ...wearablePayload, heartRate: undefined }],
      ['a heartRate below range', { ...wearablePayload, heartRate: 10 }],
      ['a heartRate above range', { ...wearablePayload, heartRate: 300 }],
      ['a non-integer heartRate', { ...wearablePayload, heartRate: 87.5 }],
      ['a non-numeric heartRate', { ...wearablePayload, heartRate: 'fast' }],
      ['a negative hrv', { ...wearablePayload, hrv: -1 }],
      ['a non-numeric hrv', { ...wearablePayload, hrv: 'high' }],
      ['an unknown field', { ...wearablePayload, isAdmin: true }],
    ])('rejects %s with 400 and does not persist', async (_name, payload) => {
      const response = await postJson(payload);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toEqual(expect.arrayContaining([expect.any(String)]));
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects malformed JSON with 400', async () => {
      const response = await post('{"userId": "user-123",');

      expect(response.status).toBe(400);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('returns 500 and does not swallow the error when persistence fails', async () => {
      repository.save.mockRejectedValueOnce(new Error('database unavailable'));

      const response = await postJson(wearablePayload);

      expect(response.status).toBe(500);
    });
  });

  describe('realtime delivery over WebSocket', () => {
    const sockets: Socket[] = [];

    const connect = (): Promise<Socket> =>
      new Promise((resolve, reject) => {
        const socket = io(baseUrl, { transports: ['websocket'], forceNew: true });
        sockets.push(socket);
        socket.once('connect', () => resolve(socket));
        socket.once('connect_error', reject);
      });

    const request = (socket: Socket, event: string, payload: unknown): Promise<unknown> =>
      new Promise((resolve) => socket.emit(event, payload, resolve));

    const collect = (socket: Socket, event: string): unknown[] => {
      const received: unknown[] = [];
      socket.on(event, (payload) => received.push(payload));
      return received;
    };

    // Long enough for any emitted event to reach every socket on localhost.
    const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

    afterEach(() => {
      sockets.forEach((socket) => socket.disconnect());
      sockets.length = 0;
    });

    it('delivers a measurement to every subscriber of that user and to nobody else', async () => {
      const [alice, aliceDashboard, bob, lurker] = await Promise.all([
        connect(),
        connect(),
        connect(),
        connect(),
      ]);
      const aliceEvents = collect(alice, 'measurement');
      const aliceDashboardEvents = collect(aliceDashboard, 'measurement');
      const bobEvents = collect(bob, 'measurement');
      const lurkerEvents = collect(lurker, 'measurement');

      await expect(request(alice, 'subscribe', { userId: 'user-alice' })).resolves.toEqual({
        subscribed: true,
        userId: 'user-alice',
      });
      await request(aliceDashboard, 'subscribe', { userId: 'user-alice' });
      await request(bob, 'subscribe', { userId: 'user-bob' });
      // `lurker` is connected but never subscribes to anyone.

      const response = await postJson({ ...wearablePayload, userId: 'user-alice' });
      expect(response.status).toBe(201);
      const saved = await response.json();

      await settle();
      expect(aliceEvents).toEqual([saved]);
      expect(aliceDashboardEvents).toEqual([saved]);
      expect(bobEvents).toEqual([]);
      expect(lurkerEvents).toEqual([]);
    });

    it('lets one client follow several users', async () => {
      const clinician = await connect();
      const events = collect(clinician, 'measurement');
      await request(clinician, 'subscribe', { userId: 'user-a' });
      await request(clinician, 'subscribe', { userId: 'user-b' });

      await postJson({ ...wearablePayload, userId: 'user-a', eventId: 'evt-a' });
      await postJson({ ...wearablePayload, userId: 'user-b', eventId: 'evt-b' });
      await postJson({ ...wearablePayload, userId: 'user-c', eventId: 'evt-c' });

      await settle();
      expect(events.map((event: any) => event.eventId)).toEqual(['evt-a', 'evt-b']);
    });

    it('stops delivering after the client unsubscribes', async () => {
      const socket = await connect();
      const events = collect(socket, 'measurement');
      await request(socket, 'subscribe', { userId: 'user-123' });

      await postJson({ ...wearablePayload, eventId: 'evt-before' });
      await expect(request(socket, 'unsubscribe', { userId: 'user-123' })).resolves.toEqual({
        subscribed: false,
        userId: 'user-123',
      });
      await postJson({ ...wearablePayload, eventId: 'evt-after' });

      await settle();
      expect(events.map((event: any) => event.eventId)).toEqual(['evt-before']);
    });

    it('reports an invalid subscription on the exception event and joins nothing', async () => {
      const socket = await connect();
      const exceptions = collect(socket, 'exception');
      const events = collect(socket, 'measurement');
      let acknowledged = false;
      socket.emit('subscribe', { userId: '   ' }, () => {
        acknowledged = true;
      });

      await settle();
      expect(acknowledged).toBe(false);
      expect(exceptions).toEqual([
        expect.objectContaining({ status: 'error', message: 'userId is required' }),
      ]);

      await postJson(wearablePayload);
      await settle();
      expect(events).toEqual([]);
    });

    it('does not emit anything when the measurement could not be persisted', async () => {
      const socket = await connect();
      const events = collect(socket, 'measurement');
      await request(socket, 'subscribe', { userId: 'user-123' });
      repository.save.mockRejectedValueOnce(new Error('database unavailable'));

      const response = await postJson(wearablePayload);
      expect(response.status).toBe(500);

      await settle();
      expect(events).toEqual([]);
    });
  });
});
