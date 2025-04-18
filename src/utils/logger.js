const pino = require('pino');

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

module.exports = logger;
