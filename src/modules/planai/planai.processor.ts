import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';

@Processor('planai-jobs')
export class PlanAIProcessor {
  private readonly logger = new Logger(PlanAIProcessor.name);

  constructor(private readonly prisma: PrismaService) { }

  @Process('process')
  async handlePlanAIJob(job: Job<{ jobId: string; tool: string; input: any; userId: string }>) {
    const { jobId } = job.data;
    const start = Date.now();

    await this.prisma.planAIJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', bullJobId: String(job.id) },
    });

    try {
      // The actual AI work is done synchronously in the service — this tracks async jobs
      const processingMs = Date.now() - start;
      await this.prisma.planAIJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', processingMs },
      });
      this.logger.log(`PlanAI job ${jobId} completed in ${processingMs}ms`);
    } catch (err: any) {
      this.logger.error(`PlanAI job ${jobId} failed:`, err.message);
      await this.prisma.planAIJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', errorMessage: err.message },
      });
      throw err;
    }
  }
}