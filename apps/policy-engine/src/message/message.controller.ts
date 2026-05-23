import { Body, Controller, Post, Headers, BadRequestException, Get, Param} from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { PrismaService } from 'src/prisma.service';

@Controller('message')
export class MessageController {
  constructor(private readonly messageService: MessageService,
		private readonly prisma: PrismaService
	) {}

  // 1. Проверка возможности отправки уведомления
  @Post('evaluate')
  async evaluate(
    @Body() body: any,
    @Headers('x-message-id') messageId: string, // Передаем UUID для проверки идемпотентности в Redis
  ) {
    if (!messageId) {
      throw new BadRequestException('Заголовок x-message-id обязателен для контроля идемпотентности запросов.');
    }
    return this.messageService.evaluateNotification(body, messageId);
  }

  // 2. Получение предпочтений конкретного пользователя
  @Get('users/:id/preferences')
  async getPreferences(@Param('id') userId: string) {
    const preference = await this.prisma.userPreference.findUnique({
      where: { userId },
    });
    if (!preference) {
      return { userId, msg: 'Используются дефолтные настройки системы', defaults: true };
    }
    return preference;
  }

  // 3. Изменение или создание настроек пользователя (Upsert)
  @Post('users/:id/preferences')
  async updatePreferences(@Param('id') userId: string, @Body() body: any) {
    return this.prisma.userPreference.upsert({
      where: { userId },
      update: {
        region: body.region,
        timezone: body.timezone,
        emailEnabled: body.emailEnabled ?? true,
        smsEnabled: body.smsEnabled ?? true,
        pushEnabled: body.pushEnabled ?? true,
        quietHoursStart: body.quietHoursStart ?? 22,
        quietHoursEnd: body.quietHoursEnd ?? 8,
      },
      create: {
        userId,
        region: body.region,
        timezone: body.timezone,
        emailEnabled: body.emailEnabled ?? true,
        smsEnabled: body.smsEnabled ?? true,
        pushEnabled: body.pushEnabled ?? true,
        quietHoursStart: body.quietHoursStart ?? 22,
        quietHoursEnd: body.quietHoursEnd ?? 8,
      },
    });
  }
}
