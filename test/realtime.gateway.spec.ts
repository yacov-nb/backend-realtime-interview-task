import { WsException } from '@nestjs/websockets';
import { Measurement } from '../src/measurements/measurement.entity';
import { RealtimeGateway, userRoom } from '../src/realtime/realtime.gateway';

describe('RealtimeGateway', () => {
  const makeClient = () =>
    ({
      id: 'socket-1',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
    }) as any;

  describe('subscribe', () => {
    it('joins a user-specific room', async () => {
      const gateway = new RealtimeGateway();
      const client = { join: jest.fn().mockResolvedValue(undefined) } as any;

      await expect(
        gateway.subscribe(client, { userId: 'user-42' }),
      ).resolves.toEqual({ subscribed: true, userId: 'user-42' });

      expect(client.join).toHaveBeenCalledWith('user:user-42');
    });

    it('rejects an empty userId', async () => {
      const gateway = new RealtimeGateway();
      const client = { join: jest.fn() } as any;

      await expect(gateway.subscribe(client, { userId: '   ' })).rejects.toThrow();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('trims surrounding whitespace so the room matches the stored userId', async () => {
      const gateway = new RealtimeGateway();
      const client = makeClient();

      await expect(
        gateway.subscribe(client, { userId: '  user-42 ' }),
      ).resolves.toEqual({ subscribed: true, userId: 'user-42' });

      expect(client.join).toHaveBeenCalledWith('user:user-42');
    });

    it.each([
      ['a missing body', undefined],
      ['a body without userId', {}],
      ['a numeric userId', { userId: 42 }],
      ['an object userId', { userId: { $ne: null } }],
      ['an over-long userId', { userId: 'x'.repeat(101) }],
    ])('rejects %s with a WsException and does not join any room', async (_name, body) => {
      const gateway = new RealtimeGateway();
      const client = makeClient();

      await expect(gateway.subscribe(client, body as any)).rejects.toBeInstanceOf(
        WsException,
      );
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('leaves the user-specific room', async () => {
      const gateway = new RealtimeGateway();
      const client = makeClient();

      await expect(
        gateway.unsubscribe(client, { userId: 'user-42' }),
      ).resolves.toEqual({ subscribed: false, userId: 'user-42' });

      expect(client.leave).toHaveBeenCalledWith('user:user-42');
    });

    it('rejects an invalid userId', async () => {
      const gateway = new RealtimeGateway();
      const client = makeClient();

      await expect(gateway.unsubscribe(client, { userId: '' })).rejects.toBeInstanceOf(
        WsException,
      );
      expect(client.leave).not.toHaveBeenCalled();
    });
  });

  describe('publishMeasurement', () => {
    const measurement = {
      id: 'measurement-1',
      eventId: 'evt-1',
      userId: 'user-42',
      timestamp: new Date('2026-09-15T10:15:22.120Z'),
      heartRate: 87,
      hrv: 42,
      createdAt: new Date('2026-09-15T10:15:23.000Z'),
    } as Measurement;

    it("emits only to the room of the measurement's user", () => {
      const gateway = new RealtimeGateway();
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      (gateway as any).server = { to, emit: jest.fn() };

      gateway.publishMeasurement(measurement);

      expect(to).toHaveBeenCalledTimes(1);
      expect(to).toHaveBeenCalledWith(userRoom('user-42'));
      expect(emit).toHaveBeenCalledWith('measurement', measurement);
      // Never a server-wide broadcast.
      expect((gateway as any).server.emit).not.toHaveBeenCalled();
    });

    it('does not throw when the socket server has not been initialised', () => {
      const gateway = new RealtimeGateway();

      expect(() => gateway.publishMeasurement(measurement)).not.toThrow();
    });
  });
});
