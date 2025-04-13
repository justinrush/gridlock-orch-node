import winston from 'winston';
import config from '../../config/config';

interface LoggingInfo {
  level: string;
  message: string | unknown;
  [key: string | symbol]: unknown;
}

const enumerateErrorFormat = winston.format((info: LoggingInfo) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

const rainbowColors = ['\x1b[31m', '\x1b[33m', '\x1b[32m', '\x1b[36m', '\x1b[34m', '\x1b[35m'];
const resetColor = '\x1b[0m';

const rainbowFormat = winston.format((info: LoggingInfo) => {
  if (info.level === 'silly' && typeof info.message === 'string') {
    let colorIndex = 0;
    info.message = info.message
      .split('')
      .map((char, index) => {
        if (index % 4 === 0) {
          colorIndex = (colorIndex + 1) % rainbowColors.length;
        }
        return `${rainbowColors[colorIndex]}${char}${resetColor}`;
      })
      .join('');
  }
  return info;
});

const logger = winston.createLogger({
  level: config.env === 'development' ? 'silly' : 'info',
  format: winston.format.combine(
    enumerateErrorFormat(),
    rainbowFormat(),
    config.env === 'development' ? winston.format.colorize() : winston.format.uncolorize(),
    winston.format.splat(),
    winston.format.printf((info: LoggingInfo) => `${info.level}: ${info.message}`)
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

export default logger;
