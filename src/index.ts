import mongoose from 'mongoose';
import app from './app';
import config from './config/config';
import { logger } from './modules/logger';
import { init } from './modules/nats/nats.instance';

let server: any;
init(() => {
  const mongoUrl = new URL(config.mongoose.url);
  const host = mongoUrl.hostname;
  mongoose.connect(config.mongoose.url).then(() => {
    logger.info(`Connected to MongoDB at ${host}`);
    server = app.listen(config.port, () => {
      logger.info(`Listening for SDK requests on port ${config.port}`);
    });
  });
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error: string) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
