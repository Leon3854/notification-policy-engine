import { ConflictException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UserPreference } from '../../prisma/client/index.js'; 
import { PrismaService } from 'src/prisma.service';
import { RedisService } from 'provider/redis/redis.service';


export interface EvaluateResponse {
  decision: 'allow' | 'deny'; // Жесткие литеральные типы, никаких случайных строк!
  reason: string;
  meta?: {
    localHour: number;
    timezone: string;
  };
}



@Injectable()
export class MessageService {
	private readonly logger = new Logger(MessageService.name);
	
	constructor(
		private readonly prisma: PrismaService,
		private readonly redis: RedisService
	){}

	/**
   * @description Оценка политик уведомлений с защитой от атак и проверкой таймзон
   * @param dto - Входные валидированные данные по твоим регуляркам
   * @param messageId - UUID пакета из заголовка для укрощения Race Condition
   */
	async evaluateNotification(dto: CreateMessageDto, messageId: string): Promise<EvaluateResponse> {
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
    // Явно указываем тип UserPreference или null для компилятора
    let preference: UserPreference | null = await this.prisma.userPreference.findUnique({
      where: { userId: dto.userId },
    });

    // ЖЕСТКИЙ СЕНЬОРСКИЙ ФИКС: Если в базе Postgres пусто, создаем полный объект, 
    // чтобы TypeScript никогда больше не ругался на 'preference is possibly null'
    let activePreference: UserPreference;

    if (!preference) {
      this.logger.log(`User ${dto.userId} not found, applying default system preferences`);
      activePreference = {
        id: 'default-id',
        userId: dto.userId,
        region: dto.region,
        timezone: dto.region === 'EU' ? 'Europe/Paris' : dto.region === 'US' ? 'America/New_York' : 'Europe/Moscow',
        marketingEmail: true,
        marketingPush: true,
        transactionalSms: true,
        quietHoursStart: 22,
        quietHoursEnd: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      activePreference = preference;
    }

    // 4. ПРОВЕРКА КАНАЛОВ СВЯЗИ (доменные поля, завязанные на схему)
    if (dto.channel === 'email' && dto.notificationType === 'marketing_email' && !activePreference.marketingEmail) {
      return { decision: 'deny', reason: 'blocked_by_user_preferences' };
    }
    if (dto.channel === 'push' && dto.notificationType === 'marketing_push' && !activePreference.marketingPush) {
      return { decision: 'deny', reason: 'blocked_by_user_preferences' };
    }
    if (dto.channel === 'sms' && dto.notificationType === 'transactional_sms' && !activePreference.transactionalSms) {
      return { decision: 'deny', reason: 'blocked_by_user_preferences' };
    }

    // 5. ВЫЧИСЛЕНИЕ QUIET HOURS (Магия таймзон через встроенный Intl)
    try {
      const utcDate = new Date(dto.datetime);
      
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: activePreference.timezone,
        hour: 'numeric',
        hour12: false,
      });
      
      const localHour = parseInt(formatter.format(utcDate), 10);
      this.logger.log(`UTC: ${dto.datetime} | Timezone: ${activePreference.timezone} | Local Hour: ${localHour}`);

      const start = activePreference.quietHoursStart;
      const end = activePreference.quietHoursEnd;

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
      this.logger.error(`Ошибка парсинга таймзоны для региона ${activePreference.timezone}`, err);
      // Если таймзона кривая — откатываем замок в Redis, чтобы не лочить последующие запросы
      await this.redis.deleteIdempotencyKey(messageId);
      throw new InternalServerErrorException('Ошибка обработки временных параметров политики');
    }

    // ВСЕ ПОЛИТИКИ ПРОЙДЕНЫ УСПЕШНО
    return { decision: 'allow', reason: 'all_policies_passed' };
  }
}
