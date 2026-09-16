import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RealtimeBus } from '../src/realtime/realtime-bus.service';
import { Measurement } from '../src/measurements/measurement.entity';
import { MeasurementsService } from '../src/measurements/measurements.service';

describe('MeasurementsService', () => {
  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };
  const realtimeBus = {
    publish: jest.fn(),
  };

  let service: MeasurementsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        MeasurementsService,
        { provide: getRepositoryToken(Measurement), useValue: repository },
        { provide: RealtimeBus, useValue: realtimeBus },
      ],
    }).compile();

    service = module.get(MeasurementsService);
  });

  it('persists before publishing the realtime event', async () => {
    const dto = {
      eventId: 'evt-1',
      userId: 'user-1',
      timestamp: '2026-09-16T12:00:00.000Z',
      heartRate: 80,
      hrv: 40,
    };
    const entity = { ...dto, timestamp: new Date(dto.timestamp) } as Measurement;
    const saved = { ...entity, id: 'measurement-1' } as Measurement;

    repository.create.mockReturnValue(entity);
    repository.save.mockResolvedValue(saved);

    await expect(service.ingest(dto)).resolves.toEqual(saved);
    expect(repository.create).toHaveBeenCalledWith({
      ...dto,
      timestamp: new Date(dto.timestamp),
      hrv: 40,
    });
    expect(repository.save).toHaveBeenCalledWith(entity);
    expect(realtimeBus.publish).toHaveBeenCalledWith(saved);
    expect(repository.save.mock.invocationCallOrder[0]).toBeLessThan(
      realtimeBus.publish.mock.invocationCallOrder[0],
    );
  });

  it('does not publish when persistence fails', async () => {
    repository.create.mockReturnValue({});
    repository.save.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.ingest({
        eventId: 'evt-2',
        userId: 'user-1',
        timestamp: '2026-09-16T12:00:01.000Z',
        heartRate: 81,
      }),
    ).rejects.toThrow('database unavailable');

    expect(realtimeBus.publish).not.toHaveBeenCalled();
  });

  it('assigns an eventId when the device did not send one', async () => {
    repository.create.mockImplementation((input) => ({ ...input }));
    repository.save.mockImplementation(async (entity) => ({ ...entity, id: 'measurement-3' }));

    const saved = await service.ingest({
      userId: 'user-123',
      timestamp: '2026-09-15T10:15:22.120Z',
      heartRate: 87,
      hrv: 42,
    });

    expect(saved.eventId).toEqual(expect.any(String));
    expect(saved.eventId.length).toBeGreaterThan(0);
    expect(repository.create).toHaveBeenCalledWith({
      eventId: saved.eventId,
      userId: 'user-123',
      timestamp: new Date('2026-09-15T10:15:22.120Z'),
      heartRate: 87,
      hrv: 42,
    });
  });

  it('stores a missing hrv as null', async () => {
    repository.create.mockImplementation((input) => ({ ...input }));
    repository.save.mockImplementation(async (entity) => entity);

    await service.ingest({
      eventId: 'evt-4',
      userId: 'user-1',
      timestamp: '2026-09-16T12:00:02.000Z',
      heartRate: 82,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ hrv: null }),
    );
  });

  it('still returns the persisted measurement when realtime publishing fails', async () => {
    const saved = { id: 'measurement-5', userId: 'user-1' } as Measurement;
    repository.create.mockReturnValue({});
    repository.save.mockResolvedValue(saved);
    realtimeBus.publish.mockRejectedValue(new Error('socket server down'));
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(
      service.ingest({
        eventId: 'evt-5',
        userId: 'user-1',
        timestamp: '2026-09-16T12:00:03.000Z',
        heartRate: 83,
      }),
    ).resolves.toEqual(saved);

    expect(logError).toHaveBeenCalledTimes(1);
    logError.mockRestore();
  });
});
