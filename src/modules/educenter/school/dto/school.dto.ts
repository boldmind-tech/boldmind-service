import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class RegisterSchoolDto {
  @IsString()
  name!: string;

  @IsString()
  state!: string;

  @IsEmail()
  contactEmail!: string;
}

export class BulkStudentDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;
}

export class BulkEnrollStudentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkStudentDto)
  students!: BulkStudentDto[];
}

export class CreateAssignmentDto {
  @IsString()
  classGroup!: string;

  @IsIn(["JAMB", "WAEC", "NECO", "GCE", "POST_UTME", "SKILL_TEST"])
  examType!: "JAMB" | "WAEC" | "NECO" | "GCE" | "POST_UTME" | "SKILL_TEST";

  @IsString()
  subject!: string;

  @IsString()
  dueDate!: string; // ISO date

  @IsInt()
  @Min(1)
  questionCount!: number;
}
