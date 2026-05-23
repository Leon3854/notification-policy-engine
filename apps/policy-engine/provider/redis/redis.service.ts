import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {Redis} from "ioredis"

@Injectable()
/**
 * @class RedisService
 * @description Сервис для работы с Redis в высоконагруженных системах.
 */
export class RedisService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(RedisService.name)
	private client: Redis

	/**
	 * @description - Хук жизненного цикла 
	 */
	async onModuleInit() {
		this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
		this.logger.log('Redis client connected');
	}

	/**
	 * 
	 * @param key приходит с клиентской стороны
	 * @param ttl время до того как "протухнет"
	 * @returns Ожидаем булеан значение true & false
	 * @description Тут мы получаем уникальный ключ 
	 * на сутки с обязательным дополнением префикса имен.
	 * Используем флаг при котором redis проверяет есть ли ключ и если 
	 * его нет то он егу установит и пропишет "ok" в противном случает будет "null"
	 * 'EX'- значение по умолчаню будт в секундах и будет удаленно черз ttl
	 * 'NX' -"not exist" - будет запись ключа если его нет, в противном случае Redis вернет null
	 */
	async setIdempotencyKey(key: string, ttl: number=86400):Promise<boolean> {
		const result = await this.client.set(`message:${key}`, 'loked', 'EX', ttl, 'NX');

		if(result ==='OK') {
			this.logger.log(`Key [${key}] stored. Success.`);
      return true;
		}
		// Если попали сюда — значит, это дубликат!
		this.logger.warn(`Duplicate detected! Key [${key}] already exists.`);
		return false;
	}

	/**
	 * @param - key ключ
	 * @description - Удаление уникального ключа. Можно будет исопльзовать для Saga
	 * при срыве операции на старте
	 */
	async deleteIdempotencyKey(key: string): Promise<void> {
		await this.client.del(`product:${key}`);
		this.logger.log(`Key [${key}] removed (rollback/cleanup).`);
	}


	/**
	 * 
	 * @param key - c клиентской стороны
	 * @description - проверяем ключ на его сущестование "жив или нет"
	 */
	async existsKey(key: string): Promise<boolean> {
		const result = await this.client.exists(`message:${key}`);
		
		if(result === 1) {
			this.logger.log(`Key [${key}] is EXISTS! Key is not detected.`)
			return true 
		}
		this.logger.log(`Key [${key}] is not FOUND! Space is clear and free.`)
		return false
	}

	/**
	 * @description - Мягкое завершение работы сервиса
	 */
	async onModuleDestroy() {
		if (this.client) {
      await this.client.quit();
    }
	}

}