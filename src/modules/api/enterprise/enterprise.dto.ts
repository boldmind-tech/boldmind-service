import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class SubmitAnswerDto {
  @IsString()
  alocQuestionId!: string;

  @IsString()
  selectedAnswer!: string;
}

export class SubmitExamAnswersDto {
  @IsString()
  sessionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers!: SubmitAnswerDto[];
}

export class GenerateCaptionDto {
  @IsString()
  topic!: string;

  @IsString()
  platform!: string;

  @IsOptional()
  @IsString()
  tone?: string;
}

export class GenerateLogoDto {
  @IsString()
  businessName!: string;

  @IsString()
  industry!: string;

  @IsOptional()
  @IsString()
  style?: string;

  @IsOptional()
  @IsString()
  colors?: string;
}

export class JoinWaitlistDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class ExamQuestionsQueryDto {
  @IsString()
  examType!: string;

  @IsString()
  subject!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  count!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;
}
