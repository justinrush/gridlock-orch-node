import { connect, NatsConnection } from 'nats';
import config from '../../config/config';
import { logger } from '../logger';

// eslint-disable-next-line import/no-mutable-exports
export let natsClient: NatsConnection;

export const init = (onReady: () => void) => {
  connect({
    servers: config.nats.endpoint,
    maxReconnectAttempts: -1,
    user: config.nats.role,
    pass: config.nats.pass,
  })
    .then((nc) => {
      logger.debug('Nats Connected');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      natsClient = nc;
      onReady();
    })
    .catch((err) => logger.error(err));
};

export const get = () => {
  return natsClient;
};
