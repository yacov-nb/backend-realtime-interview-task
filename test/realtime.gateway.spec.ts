import { RealtimeGateway } from '../src/realtime/realtime.gateway';

describe('RealtimeGateway', () => {
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
});
