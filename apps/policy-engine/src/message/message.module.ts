import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { PrismaService } from 'src/prisma.service';
import { RedisService } from 'provider/redis/redis.service';

@Module({
	imports: [],
  controllers: [MessageController],
  providers: [MessageService, PrismaService, RedisService],
	exports: [MessageService]
})
export class MessageModule {}
