import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Worker, Job } from 'bullmq';
import { EtimsService } from '../etims/etims.service';
import { ConfigService } from '@nestjs/config';

export const ETIMS_QUEUE = 'etims-queue';
export const ETIMS_SUBMIT_JOB = 'etims-submit';
export const ETIMS_RETRY_JOB = 'etims-retry';

@Injectable()
export class EtimsQueueService {
  private readonly logger = new Logger(EtimsQueueService.name);
  private worker: Worker;

  constructor(
    @InjectQueue(ETIMS_QUEUE) private readonly etimsQueue: Queue,
    private etimsService: EtimsService,
    private config: ConfigService,
  ) {
    this.initWorker();
  }

  // ─── INITIALIZE WORKER ───────────────────────────────────
  private initWorker() {
    this.worker = new Worker(
      ETIMS_QUEUE,
      async (job: Job) => {
        this.logger.log(
          `Processing job ${job.id} - ${job.name} for invoice ${job.data.invoiceId}`,
        );

        if (job.name === ETIMS_SUBMIT_JOB || job.name === ETIMS_RETRY_JOB) {
          await this.etimsService.submitInvoice(job.data.invoiceId);
        }
      },
      {
        connection: {
          host: this.config.get('REDIS_HOST', 'localhost'),
          port: this.config.get<number>('REDIS_PORT', 6379),
        },
        // Process one job at a time
        concurrency: 1,
      },
    );

    // ─── Worker Event Handlers ───────────────────────────
    this.worker.on('completed', (job) => {
      this.logger.log(
        `✅ Job ${job.id} completed for invoice ${job.data.invoiceId}`,
      );
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `❌ Job ${job?.id} failed for invoice ${job?.data?.invoiceId}: ${error.message}`,
      );
    });

    this.worker.on('error', (error) => {
      this.logger.error(`Worker error: ${error.message}`);
    });

    this.logger.log('✅ eTIMS Queue Worker initialized');
  }

  // ─── ADD SUBMIT JOB ──────────────────────────────────────
  async addSubmitJob(invoiceId: string) {
    const job = await this.etimsQueue.add(
      ETIMS_SUBMIT_JOB,
      { invoiceId },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 seconds, then 10, 20, 40, 80...
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    this.logger.log(
      `📋 Added eTIMS submit job ${job.id} for invoice ${invoiceId}`,
    );

    return job;
  }

  // ─── ADD RETRY JOB ───────────────────────────────────────
  async addRetryJob(invoiceId: string) {
    const job = await this.etimsQueue.add(
      ETIMS_RETRY_JOB,
      { invoiceId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000, // 10 seconds
        },
        delay: 5000, // Wait 5 seconds before first retry
      },
    );

    this.logger.log(
      `🔄 Added eTIMS retry job ${job.id} for invoice ${invoiceId}`,
    );

    return job;
  }

  // ─── GET QUEUE STATUS ────────────────────────────────────
  async getQueueStatus() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.etimsQueue.getWaitingCount(),
      this.etimsQueue.getActiveCount(),
      this.etimsQueue.getCompletedCount(),
      this.etimsQueue.getFailedCount(),
      this.etimsQueue.getDelayedCount(),
    ]);

    return {
      queue: ETIMS_QUEUE,
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  // ─── RETRY ALL FAILED JOBS ───────────────────────────────
  async retryAllFailed() {
    const failedJobs = await this.etimsQueue.getFailed();
    let retried = 0;

    for (const job of failedJobs) {
      await job.retry();
      retried++;
    }

    return { message: `Retried ${retried} failed jobs` };
  }
}
