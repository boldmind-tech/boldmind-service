import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateLmsCourseDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number; // kobo, 0 = free

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;
}

export class UpdateLmsCourseDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsInt() @Min(0) price?: number;
  @IsOptional() @IsBoolean() isPremium?: boolean;
  @IsOptional() @IsString() thumbnailUrl?: string;
}

export class CreateLmsLessonDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsInt()
  @Min(0)
  durationMins!: number;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;
}

export class UpdateLmsLessonDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @IsInt() @Min(0) durationMins?: number;
  @IsOptional() @IsBoolean() isFree?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class GenerateLmsCourseDto {
  @IsString()
  topic!: string;

  @IsString()
  targetAudience!: string;

  @IsIn(["beginner", "intermediate", "advanced"])
  level!: "beginner" | "intermediate" | "advanced";

  @IsInt()
  @Min(1)
  numberOfModules!: number;

  @IsBoolean()
  includeQuizzes!: boolean;
}
