// src/utils/logger.ts
// Simple structured logger for FaceFort

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_COLORS: Record<LogLevel, string> = {
  DEBUG: '\x1b[36m', // cyan
  INFO: '\x1b[32m',  // green
  WARN: '\x1b[33m',  // yellow
  ERROR: '\x1b[31m', // red
};

const RESET = '\x1b[0m';

class Logger {
  private module: string;
  private enabled: boolean = __DEV__;

  constructor(module: string) {
    this.module = module;
  }

  private log(level: LogLevel, message: string, data?: unknown) {
    if (!this.enabled && level === 'DEBUG') return;

    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const color = LOG_COLORS[level];
    const prefix = `${color}[${level}]${RESET} [${timestamp}] [${this.module}]`;

    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  debug(message: string, data?: unknown) {
    this.log('DEBUG', message, data);
  }

  info(message: string, data?: unknown) {
    this.log('INFO', message, data);
  }

  warn(message: string, data?: unknown) {
    this.log('WARN', message, data);
  }

  error(message: string, data?: unknown) {
    this.log('ERROR', message, data);
  }

  /** Measure execution time of an async function */
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const elapsed = (performance.now() - start).toFixed(1);
      this.info(`${label} completed in ${elapsed}ms`);
      return result;
    } catch (err) {
      const elapsed = (performance.now() - start).toFixed(1);
      this.error(`${label} failed after ${elapsed}ms`, err);
      throw err;
    }
  }

  /** Measure execution time of a sync function */
  timeSync<T>(label: string, fn: () => T): T {
    const start = performance.now();
    try {
      const result = fn();
      const elapsed = (performance.now() - start).toFixed(1);
      this.info(`${label} completed in ${elapsed}ms`);
      return result;
    } catch (err) {
      const elapsed = (performance.now() - start).toFixed(1);
      this.error(`${label} failed after ${elapsed}ms`, err);
      throw err;
    }
  }
}

export function createLogger(module: string): Logger {
  return new Logger(module);
}
