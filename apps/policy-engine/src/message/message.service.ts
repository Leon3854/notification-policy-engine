import { ConflictException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { PrismaService } from 'src/prisma.service';
import { RedisService } from 'provider/redis/redis.service';

@Injectable()
export class MessageService {
	private readonly logger = new Logger(MessageService.name);
	
	constructor(
		private readonly prisma: PrismaService,
		private readonly redis: RedisService
	){}

	async evaluateNotification(dto: CreateMessageDto, messageId: string) {
    this.logger.log(`Evaluating notification policy for user: ${dto.userId}`);

    // 1. ИДЕМПОТЕНТНОСТЬ (Ключ message:UUID в Redis)
    const isNewRequest = await this.redis.setIdempotencyKey(messageId);
    if (!isNewRequest) {
      throw new ConflictException(`Дубликат запроса. Пакет с ID ${messageId} уже в работе.`);
    }

    // 2. ГЛОБАЛЬНАЯ ПОЛИТИКА (Запрет маркетинговых SMS в Евросоюзе по ТЗ)
    if (dto.region === 'EU' && dto.notificationType.startsWith('marketing') && dto.channel === 'sms') {
      return { decision: 'deny', reason: 'blocked_by_global_policy' };
    }

    // 3. ПОЛУЧАЕМ НАСТРОЙКИ ИЗ POSTGRESQL ИЛИ ПРИМЕНЯЕМ ДЕФОЛТ (Требование ТЗ)
    let preference = await this.prisma.userPreference.findUnique({
      where: { userId: dto.userId },
    });

    if (!preference) {
      this.logger.log(`User ${dto.userId} not found, applying default system preferences`);
      preference = {
        id: 'default',
        userId: dto.userId,
        region: dto.region,
        timezone: dto.region === 'EU' ? 'Europe/Paris' : dto.region === 'US' ? 'America/New_York' : 'Europe/Moscow',
        emailEnabled: true,
        smsEnabled: true,
        pushEnabled: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // 4. ПРОВЕРКА КАНАЛОВ СВЯЗИ (аккуратные доменные поля)
    if (dto.channel === 'email' && !preference.emailEnabled) {
      return { decision: 'deny', reason: 'blocked_by_user_preferences' };
    }
    if (dto.channel === 'sms' && !preference.smsEnabled) {
      return { decision: 'deny', reason: 'blocked_by_user_preferences' };
    }
    if (dto.channel === 'push' && !preference.pushEnabled) {
      return { decision: 'deny', reason: 'blocked_by_user_preferences' };
    }

    // 5. ВЫЧИСЛЕНИЕ QUIET HOURS (Магия таймзон через встроенный Intl)
    try {
      const utcDate = new Date(dto.datetime);
      
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: preference.timezone,
        hour: 'numeric',
        hour12: false,
      });
      
      const localHour = parseInt(formatter.format(utcDate), 10);
      this.logger.log(`UTC: ${dto.datetime} | Timezone: ${preference.timezone} | Local Hour: ${localHour}`);

      const start = preference.quietHoursStart;
      const end = preference.quietHoursEnd;

      let isQuietHours = false;
      if (start > end) {
        // Переход через полночь (например, с 22:00 до 08:00)
        isQuietHours = localHour >= start || localHour < end;
      } else {
        // Внутри одного дня (например, с 13:00 до 17:00)
        isQuietHours = localHour >= start && localHour < end;
      }

      if (isQuietHours) {
        return { decision: 'deny', reason: 'blocked_by_quiet_hours' };
      }

    } catch (err) {
      this.logger.error(`Ошибка парсинга таймзоны для региона ${preference.timezone}`, err);
      // Если таймзона кривая — откатываем замок в Redis, чтобы не лочить запросы
      await this.redis.deleteIdempotencyKey(messageId);
      throw new InternalServerErrorException('Ошибка обработки временных параметров политики');
    }

    // ВСЕ ПОЛИТИКИ ПРОЙДЕНЫ
    return { decision: 'allow', reason: 'all_policies_passed' };
  }
}
