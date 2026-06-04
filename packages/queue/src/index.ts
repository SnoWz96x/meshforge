import { Queue, QueueEvents, Worker, type Processor, type WorkerOptions } from "bullmq";
import { Redis } from "ioredis";
import {
  PROGRESS_CHANNEL,
  type JobPayload,
  type ProgressEvent,
  type QueueName,
} from "@meshforge/shared-types";

// Conexão Redis compartilhada (BullMQ exige maxRetriesPerRequest: null).
export function createConnection(url = process.env.REDIS_URL ?? "redis://localhost:6379"): Redis {
  return new Redis(url, { maxRetriesPerRequest: null });
}

// Cache de filas por nome (evita recriar Queue a cada chamada).
const queues = new Map<QueueName, Queue<JobPayload>>();

export function getQueue(name: QueueName, connection?: Redis): Queue<JobPayload> {
  let q = queues.get(name);
  if (!q) {
    q = new Queue<JobPayload>(name, { connection: connection ?? createConnection() });
    queues.set(name, q);
  }
  return q;
}

// Enfileira um job. O jobId do BullMQ = jobId do nosso domínio (idempotência).
export async function enqueue(name: QueueName, payload: JobPayload): Promise<void> {
  await getQueue(name).add(name, payload, {
    jobId: payload.jobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600 * 24 },
    removeOnFail: false,
  });
}

// Cria um Worker tipado para uma fila.
export function createWorker(
  name: QueueName,
  processor: Processor<JobPayload>,
  opts?: Partial<WorkerOptions>,
): Worker<JobPayload> {
  return new Worker<JobPayload>(name, processor, {
    connection: createConnection(),
    concurrency: 1, // jobs de GPU são serializados por padrão
    ...opts,
  });
}

// ------------------------------------------------------------
// Progresso: pub/sub Redis -> WebSocket (UI)
// ------------------------------------------------------------
export async function publishProgress(ev: ProgressEvent, connection?: Redis): Promise<void> {
  const conn = connection ?? createConnection();
  await conn.publish(PROGRESS_CHANNEL, JSON.stringify(ev));
}

export function subscribeProgress(
  handler: (ev: ProgressEvent) => void,
  connection?: Redis,
): Redis {
  const sub = connection ?? createConnection();
  void sub.subscribe(PROGRESS_CHANNEL);
  sub.on("message", (_channel, message) => {
    try {
      handler(JSON.parse(message) as ProgressEvent);
    } catch {
      /* ignora mensagens malformadas */
    }
  });
  return sub;
}

export { Queue, QueueEvents, Worker };
