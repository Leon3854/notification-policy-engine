import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RabbitMQService } from "./rabbitmq.service";


@Module({
	imports: [ConfigModule],
	exports: [RabbitMQService],
	providers: [RabbitMQService]
})

export class RabbitMQModule {}