/**
 * Beautiful Structured Logging for Terminal Tabs Backend
 * Using consola - similar aesthetic to charmbracelet/log
 */

const { createConsola } = require('consola');
const fs = require('fs');
const path = require('path');

// Optional log file support (set LOG_FILE env var to enable)
let logStream = null;
if (process.env.LOG_FILE) {
  const logPath = path.resolve(__dirname, '../../', process.env.LOG_FILE);
  const logDir = path.dirname(logPath);

  // Create log directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Create write stream for log file
  logStream = fs.createWriteStream(logPath, { flags: 'a' });
  console.log(`[Logger] Writing logs to: ${logPath}`);
}

// Create logger instance with custom formatting
const logger = createConsola({
  level: process.env.LOG_LEVEL || 4, // 0=silent, 1=fatal, 2=error, 3=warn, 4=info, 5=debug
  fancy: true,
  formatOptions: {
    colors: true,
    compact: false,
    date: true,
  },
  reporters: logStream ? [
    // Console reporter (with colors)
    {
      log: (logObj) => {
        const defaultReporter = require('consola/reporters').FancyReporter;
        new defaultReporter().log(logObj);

        // Also write to file (without colors for readability)
        if (logStream) {
          const timestamp = new Date().toISOString();
          const level = logObj.type.toUpperCase().padEnd(7);
          const message = typeof logObj.args[0] === 'string' ? logObj.args[0] : JSON.stringify(logObj.args[0]);
          logStream.write(`${timestamp} ${level} ${message}\n`);
        }
      }
    }
  ] : undefined,
});

// Custom log tags for different modules
const createModuleLogger = (moduleName) => {
  return {
    info: (...args) => logger.info(`[${moduleName}]`, ...args),
    success: (...args) => logger.success(`[${moduleName}]`, ...args),
    warn: (...args) => logger.warn(`[${moduleName}]`, ...args),
    error: (...args) => logger.error(`[${moduleName}]`, ...args),
    debug: (...args) => logger.debug(`[${moduleName}]`, ...args),
    fatal: (...args) => logger.fatal(`[${moduleName}]`, ...args),
    start: (...args) => logger.start(`[${moduleName}]`, ...args),
    ready: (...args) => logger.ready(`[${moduleName}]`, ...args),
  };
};

// Export default logger and factory
module.exports = {
  logger,
  createModuleLogger,
};
