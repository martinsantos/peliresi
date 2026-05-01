/**
 * SITREP - Structured Logger
 * ==========================
 * pino-based logger with JSON output in production,
 * human-readable in development.
 */

import pino from 'pino';

const usePrettyTransport = process.env.NODE_ENV === 'development' || process.env.LOG_PRETTY === 'true';

export const logger = pino({
  level: process.env.LOG_LEVEL || (usePrettyTransport ? 'debug' : 'info'),
  ...(usePrettyTransport
    ? {
        // Human-readable output for development
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        // JSON output for production (parseable by log aggregators)
        formatters: {
          level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});

export default logger;
