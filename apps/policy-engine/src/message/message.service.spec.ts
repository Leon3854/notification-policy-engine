import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../../provider/redis/redis.service';
import { ConflictException } from '@nestjs/common';
import { MessageService } from './message.service';

describe('MessageService - Unit Tests', () => {
  let service: MessageService;
  let redisService: jest.Mocked<RedisService>;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const mockRedisService = {
      setIdempotencyKey: jest.fn(),
      deleteIdempotencyKey: jest.fn(),
    };
    const mockPrismaService = {
      userPreference: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    redisService = module.get(RedisService) as any;
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('должен выкинуть ConflictException, если сработал дубликат UUID пакета (Идемпотентность)', async () => {
    // Redis говорит: этот ключ уже занят!
    redisService.setIdempotencyKey.mockResolvedValue(false);

    const dto = {
      userId: 'user-100',
      notificationType: 'marketing_email',
      channel: 'email',
      region: 'RU',
      datetime: '2026-05-21T12:00:00Z',
    };

    await expect(service.evaluateNotification(dto, 'duplicate-uuid')).rejects.toThrow(ConflictException);
    expect(prismaService.userPreference.findUnique as jest.Mock).not.toHaveBeenCalled();
  });

  it('должен применить дефолтные настройки и РАЗРЕШИТЬ отправку, если пользователя нет в базе', async () => {
    redisService.setIdempotencyKey.mockResolvedValue(true);
    // Имитируем, что пользователя нет в Postgres
    (prismaService.userPreference.findUnique as jest.Mock).mockResolvedValue(null);

    const dto = {
      userId: 'new-user',
      notificationType: 'marketing_email',
      channel: 'email',
      region: 'RU',
      datetime: '2026-05-21T12:00:00Z', // Полдень по UTC
    };

    const result = await service.evaluateNotification(dto, 'unique-uuid-1');
    expect(result.decision).toBe('allow');
    expect(result.reason).toBe('all_policies_passed');
  });

  it('должен ЗАБЛОКИРОВАТЬ отправку, если локальное время пользователя попадает в Quiet Hours', async () => {
    redisService.setIdempotencyKey.mockResolvedValue(true);
    
    // Пользователь живет в Париже (Europe/Paris). Тихие часы с 22:00 до 08:00
    (prismaService.userPreference.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-paris',
      region: 'EU',
      timezone: 'Europe/Paris',
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      quietHoursStart: 22,
      quietHoursEnd: 8,
    });

    const dto = {
      userId: 'user-paris',
      notificationType: 'marketing_email',
      channel: 'email',
      region: 'EU',
      datetime: '2026-05-21T21:30:00Z', // В UTC это 21:30, но в Париже (UTC+2) это уже 23:30!
    };

    const result = await service.evaluateNotification(dto, 'unique-uuid-2');
    
    // Броня сработала! Человек спит, отправка запрещена!
    expect(result.decision).toBe('deny');
    expect(result.reason).toBe('blocked_by_quiet_hours');
  });
});
