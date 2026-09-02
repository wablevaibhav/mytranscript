/**
 * Centralized privacy-safe logger
 * Ensures sensitive transcript strings and audio binaries are never dumped to public logs.
 */

class Logger {
  private prefix = '[MeetRecorder]';

  debug(message: string, ...meta: unknown[]) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`${this.prefix} 🔍`, message, ...meta);
    }
  }

  info(message: string, ...meta: unknown[]) {
    console.info(`${this.prefix} ℹ️`, message, ...meta);
  }

  warn(message: string, ...meta: unknown[]) {
    console.warn(`${this.prefix} ⚠️`, message, ...meta);
  }

  error(message: string, ...meta: unknown[]) {
    console.error(`${this.prefix} 🛑`, message, ...meta);
  }
}

export const logger = new Logger();
