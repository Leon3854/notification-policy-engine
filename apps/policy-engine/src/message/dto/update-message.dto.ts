import { PartialType } from '@nestjs/mapped-types';
import { CreateMessageDto } from './create-message.dto';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateMessageDto extends PartialType(CreateMessageDto) {
	
	// userId всё равно оставляем обязательным! 
	// Даже при обновлении мы должны соблюдать идемпотентность.
	@IsUUID()
	@IsNotEmpty()
	userId: string;
}
