import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { MessageService } from './message.service';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../../provider/redis/redis.service';
import { CreateMessageDto } from './dto/create-message.dto';

describe('MessageService', () => {
  let service: MessageService;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;

  const mockPrismaService = {
    userPreference: {
      findUnique: jest.fn(),
    },
  };

  const mockRedisService = {
    setIdempotencyKey: jest.fn(),
    deleteIdempotencyKey: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);

    // Сбрасываем все моки перед каждым тестом
    jest.clearAllMocks();
  });

  describe('Идемпотентность', () => {
    it('✅ Должен выбросить ConflictException при повторном запросе с тем же messageId', async () => {
      // Arrange
      mockRedisService.setIdempotencyKey.mockResolvedValue(false);

      const dto: CreateMessageDto = {
        userId: 'user-1',
        notificationType: 'marketing_email',
        channel: 'email',
        region: 'US',
        datetime: '2026-05-21T14:30:00Z',
      };

      // Act & Assert
      await expect(
        service.evaluateNotification(dto, 'duplicate-message-id'),
      ).rejects.toThrow(ConflictException);
      
      expect(mockRedisService.setIdempotencyKey).toHaveBeenCalledWith('duplicate-message-id');
    });
  });

  describe('Глобальные политики', () => {
    it('✅ Должен запретить marketing_sms в регионе EU', async () => {
      // Arrange
      mockRedisService.setIdempotencyKey.mockResolvedValue(true);

      const dto: CreateMessageDto = {
        userId: 'user-2',
        notificationType: 'marketing_sms',
        channel: 'sms',
        region: 'EU',
        datetime: '2026-05-21T10:00:00Z',
      };

      // Act
      const result = await service.evaluateNotification(dto, 'msg-1');

      // Assert
      expect(result).toEqual({
        decision: 'deny',
        reason: 'blocked_by_global_policy',
      });
    });

    it('✅ Должен разрешить transactional_sms в регионе EU (не подпадает под глобальную политику)', async () => {
      // Arrange
      mockRedisService.setIdempotencyKey.mockResolvedValue(true);
      mockPrismaService.userPreference.findUnique.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-3',
        region: 'EU',
        timezone: 'Europe/Paris',
        marketingEmail: true,
        marketingPush: true,
        transactionalSms: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const dto: CreateMessageDto = {
        userId: 'user-3',
        notificationType: 'transactional_sms',
        channel: 'sms',
        region: 'EU',
        datetime: '2026-05-21T12:00:00Z',
      };

      // Act
      const result = await service.evaluateNotification(dto, 'msg-2');

      // Assert
      expect(result.decision).toBe('allow');
      expect(result.reason).toBe('all_policies_passed');
    });
  });

  describe('Дефолтные настройки для нового пользователя', () => {
    it('✅ Должен применить дефолтные настройки, если пользователь не найден в БД', async () => {
      // Arrange
      mockRedisService.setIdempotencyKey.mockResolvedValue(true);
      mockPrismaService.userPreference.findUnique.mockResolvedValue(null);

      const dto: CreateMessageDto = {
        userId: 'new-user',
        notificationType: 'marketing_email',
        channel: 'email',
        region: 'US',
        datetime: '2026-05-21T15:00:00Z',
      };

      // Act
      const result = await service.evaluateNotification(dto, 'msg-3');

      // Assert
      expect(result.decision).toBe('allow');
      expect(mockPrismaService.userPreference.findUnique).toHaveBeenCalledWith({
        where: { userId: 'new-user' },
      });
    });

    it('✅ Должен корректно определить таймзону для US региона по дефолту', async () => {
      // Arrange
      mockRedisService.setIdempotencyKey.mockResolvedValue(true);
      mockPrismaService.userPreference.findUnique.mockResolvedValue(null);

      const dto: CreateMessageDto = {
        userId: 'new-user-us',
        notificationType: 'marketing_email',
        channel: 'email',
        region: 'US',
        datetime: '2026-05-21T16:00:00Z', // 16:00 UTC = 12:00 New York (дневное время)
      };

      // Act
      const result = await service.evaluateNotification(dto, 'msg-4');

      // Assert
      expect(result.decision).toBe('allow');
    });
  });

  describe('Изменение настроек пользователем', () => {
    it('✅ Должен запретить marketing_email, если пользователь его отключил', async () => {
      // Arrange
      mockRedisService.setIdempotencyKey.mockResolvedValue(true);
      mockPrismaService.userPreference.findUnique.mockResolvedValue({
        id: 'pref-2',
        userId: 'user-4',
        region: 'US',
        timezone: 'America/New_York',
        marketingEmail: false, // Отключено
        marketingPush: true,
        transactionalSms: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const dto: CreateMessageDto = {
        userId: 'user-4',
        notificationType: 'marketing_email',
        channel: 'email',
        region: 'US',
        datetime: '2026-05-21T15:00:00Z',
      };

      // Act
      const result = await service.evaluateNotification(dto, 'msg-5');

      // Assert
      expect(result).toEqual({
        decision: 'deny',
        reason: 'blocked_by_user_preferences',
      });
    });

    it('✅ Должен разрешить transactional_sms, даже если marketing отключен', async () => {
      // Arrange
      mockRedisService.setIdempotencyKey.mockResolvedValue(true);
      mockPrismaService.userPreference.findUnique.mockResolvedValue({
        id: 'pref-3',
        userId: 'user-5',
        region: 'US',
        timezone: 'America/New_York',
        marketingEmail: false,
        marketingPush: false,
        transactionalSms: true, // Транзакционные разрешены
        quietHoursStart: 22,
        quietHoursEnd: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const dto: CreateMessageDto = {
        userId: 'user-5',
        notificationType: 'transactional_sms',
        channel: 'sms',
        region: 'US',
        datetime: '2026-05-21T15:00:00Z',
      };

      // Act
      const result = await service.evaluateNotification(dto, 'msg-6');

      // Assert
      expect(result.decision).toBe('allow');
      expect(result.reason).toBe('all_policies_passed');
    });
  });

  describe('Quiet Hours с учётом таймзоны', () => {
    it('✅ Должен заблокировать marketing_push в quiet hours (ночь в Париже)', async () => {
      // Arrange
      mockRedisService.setIdempotencyKey.mockResolvedValue(true);
      mockPrismaService.userPreference.findUnique.mockResolvedValue({
        id: 'pref-4',
        userId: 'user-6',
        region: 'EU',
        timezone: 'Europe/Paris',
        marketingEmail: true,
        marketingPush: true,
        transactionalSms: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 23:00 UTC = 01:00 следующего дня в Париже (UTC+2 летом)
      const dto: CreateMessageDto = {
        userId: 'user-6',
        notificationType: 'marketing_push',
        channel: 'push',
        region: 'EU',
        datetime: '2026-05-21T23:00:00Z',
      };

      // Act
      const result = await service.evaluateNotification(dto, 'msg-7');

      // Assert
      expect(result).toEqual({
        decision: 'deny',
        reason: 'blocked_by_quiet_hours',
      });
    });

    it('✅ Должен разрешить marketing_push в рабочее время (день в Париже)', async () => {
      // Arrange
      mockRedisService.setIdempotencyKey.mockResolvedValue(true);
      mockPrismaService.userPreference.findUnique.mockResolvedValue({
        id: 'pref-5',
        userId: 'user-7',
        region: 'EU',
        timezone: 'Europe/Paris',
        marketingEmail: true,
        marketingPush: true,
        transactionalSms: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 12:00 UTC = 14:00 в Париже (UTC+2 летом)
      const dto: CreateMessageDto = {
        userId: 'user-7',
        notificationType: 'marketing_push',
        channel: 'push',
        region: 'EU',
        datetime: '2026-05-21T12:00:00Z',
      };

      // Act
      const result = await service.evaluateNotification(dto, 'msg-8');

      // Assert
      expect(result).toEqual({
        decision: 'allow',
        reason: 'all_policies_passed',
      });
    });

    it('✅ Должен разрешить transactional_sms даже в quiet hours', async () => {
      // Arrange
      mockRedisService.setIdempotencyKey.mockResolvedValue(true);
      mockPrismaService.userPreference.findUnique.mockResolvedValue({
        id: 'pref-6',
        userId: 'user-8',
        region: 'EU',
        timezone: 'Europe/Paris',
        marketingEmail: true,
        marketingPush: true,
        transactionalSms: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 23:00 UTC = 01:00 в Париже (ночное время)
      const dto: CreateMessageDto = {
        userId: 'user-8',
        notificationType: 'transactional_sms',
        channel: 'sms',
        region: 'EU',
        datetime: '2026-05-21T23:00:00Z',
      };

      // Act
      const result = await service.evaluateNotification(dto, 'msg-9');

      // Assert
      // Транзакционные уведомления проходят даже в quiet hours
      expect(result.decision).toBe('allow');
    });

    it('✅ Должен корректно работать с московской таймзоной (UTC+3)', async () => {
      // Arrange
      mockRedisService.setIdempotencyKey.mockResolvedValue(true);
      mockPrismaService.userPreference.findUnique.mockResolvedValue({
        id: 'pref-7',
        userId: 'user-9',
        region: 'RU',
        timezone: 'Europe/Moscow',
        marketingEmail: true,
        marketingPush: true,
        transactionalSms: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 19:00 UTC = 22:00 в Москве — попадает в quiet hours
      const dto: CreateMessageDto = {
        userId: 'user-9',
        notificationType: 'marketing_email',
        channel: 'email',
        region: 'RU',
        datetime: '2026-05-21T19:00:00Z',
      };

      // Act
      const result = await service.evaluateNotification(dto, 'msg-10');

      // Assert
      expect(result.decision).toBe('deny');
      expect(result.reason).toBe('blocked_by_quiet_hours');
    });
  });

  describe('Комплексные сценарии', () => {
    it('✅ Глобальная политика должна иметь приоритет над пользовательскими настройками', async () => {
      // Arrange
      mockRedisService.setIdempotencyKey.mockResolvedValue(true);
      mockPrismaService.userPreference.findUnique.mockResolvedValue({
        id: 'pref-8',
        userId: 'user-10',
        region: 'EU',
        timezone: 'Europe/Paris',
        marketingEmail: true,
        marketingPush: true,
        transactionalSms: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // marketing_sms в EU должно быть запрещено глобально
      const dto: CreateMessageDto = {
        userId: 'user-10',
        notificationType: 'marketing_sms',
        channel: 'sms',
        region: 'EU',
        datetime: '2026-05-21T12:00:00Z',
      };

      // Act
      const result = await service.evaluateNotification(dto, 'msg-11');

      // Assert
      expect(result).toEqual({
        decision: 'deny',
        reason: 'blocked_by_global_policy',
      });
    });

    it('✅ Должен обработать ошибку таймзоны и очистить ключ идемпотентности', async () => {
      // Arrange
      mockRedisService.setIdempotencyKey.mockResolvedValue(true);
      mockPrismaService.userPreference.findUnique.mockResolvedValue({
        id: 'pref-9',
        userId: 'user-11',
        region: 'XX',
        timezone: 'Invalid/Timezone',
        marketingEmail: true,
        marketingPush: true,
        transactionalSms: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const dto: CreateMessageDto = {
        userId: 'user-11',
        notificationType: 'marketing_email',
        channel: 'email',
        region: 'XX',
        datetime: '2026-05-21T12:00:00Z',
      };

      // Act & Assert
      await expect(
        service.evaluateNotification(dto, 'msg-12'),
      ).rejects.toThrow(InternalServerErrorException);
      
      expect(mockRedisService.deleteIdempotencyKey).toHaveBeenCalledWith('msg-12');
    });
  });
});