import { randomUUID } from 'node:crypto';
import { pino, destination } from 'pino';

export function createLogger(level = 'info') {
  return pino({ level, base: null, redact: {
    paths: ['authorization', 'password', 'secret', 'token', 'apiKey', 'credential', 'headers', 'env', '*.authorization', '*.password', '*.secret', '*.token', '*.apiKey', '*.credential', '*.headers', '*.env'], remove: true,
  } }, destination({ dest: 2, sync: true }));
}
export const newCorrelationId = (): string => randomUUID();
