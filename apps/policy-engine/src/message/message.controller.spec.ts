import { Test, TestingModule } from '@nestjs/testing';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../../provider/redis/redis.service';

describe('MessageController', () => {
  let controller: MessageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessageController],
      providers: [
        MessageService,
        {
          provide: PrismaService,
          useValue: { userPreference: { findUnique: jest.fn() } },
        },
        {
          provide: RedisService,
          useValue: { setIdempotencyKey: jest.fn(), deleteIdempotencyKey: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<MessageController>(MessageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});