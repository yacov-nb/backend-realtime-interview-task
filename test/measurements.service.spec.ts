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
});
