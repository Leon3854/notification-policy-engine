import { IsNotEmpty, IsString, IsUUID, Matches, MaxLength } from "class-validator";

/**
 * @class CreatemessageDto
 * @description Входные ворота. 
 * Каждый атрибут — под титановую защиту.
 */
export class CreateMessageDto {

	@IsString()
	@IsNotEmpty({ message: 'userId (UUID) обязателен для обеспечения идемпотентности' })
  @IsUUID('4', { message: 'userId должен быть валидным UUID v4' })
	userId: string;
	
	@IsString()
	@IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9\sа-яА-ЯёЁ-]+$/, { 
    message: 'Название содержит недопустимые символы (защита от XSS/инъекций)' 
  })
  notificationType: string;
  
	@IsString()
	@IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9\sа-яА-ЯёЁ-]+$/, { 
    message: 'Название содержит недопустимые символы (защита от XSS/инъекций)' 
  })
	channel: string;
  
	@IsString()
	@IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9\sа-яА-ЯёЁ-]+$/, { 
    message: 'Название содержит недопустимые символы (защита от XSS/инъекций)' 
  })
	region: string;
  
	@IsString()
	@IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9\sа-яА-ЯёЁ-]+$/, { 
    message: 'Название содержит недопустимые символы (защита от XSS/инъекций)' 
  })
	datetime: string; // Строка ISO UTC, например: "2026-05-21T21:30:00Z"
}
