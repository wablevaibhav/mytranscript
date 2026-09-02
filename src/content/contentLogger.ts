/**
 * Isolated Content Script Logger
 * Kept independent from extension pages to ensure contentScript is bundled as a single self-contained file.
 */

class ContentLogger {
  private prefix = '[MeetRecorder:Content]';

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

export const contentLogger = new ContentLogger();
