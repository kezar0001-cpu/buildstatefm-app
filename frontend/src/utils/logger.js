/**
 * Production-safe logger utility
 * Only logs in development mode (DEV builds)
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args) => {
    if (isDev) console.log(...args);
  },
  warn: (...args) => {
    if (isDev) console.warn(...args);
  },
  error: (...args) => {
    if (isDev) console.error(...args);
  },
  debug: (...args) => {
    if (isDev) console.debug(...args);
  },
  info: (...args) => {
    if (isDev) console.info(...args);
  },
  group: (...args) => {
    if (isDev) console.group(...args);
  },
  groupEnd: () => {
    if (isDev) console.groupEnd();
  },
  table: (...args) => {
    if (isDev) console.table(...args);
  },
};

export default logger;

