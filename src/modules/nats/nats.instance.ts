import { connect, NatsConnection, NatsError } from 'nats';
import config from '../../config/config';
import { logger } from '../logger';

// eslint-disable-next-line import/no-mutable-exports
export let natsClient: NatsConnection;
let isConnecting = false;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

const attemptConnection = async (retryCount = 0): Promise<void> => {
  if (isConnecting) return;
  isConnecting = true;

  try {
    const nc = await connect({
      servers: config.nats.endpoint,
      maxReconnectAttempts: -1,
      user: config.nats.role,
      pass: config.nats.pass,
    });

    logger.info(`Successfully connected to NATS server at ${config.nats.endpoint}`);
    natsClient = nc;
    isConnecting = false;
  } catch (err) {
    isConnecting = false;
    const error = err as NatsError;
    logger.error(`Failed to connect to NATS server at ${config.nats.endpoint}`);

    if (retryCount < MAX_RETRIES) {
      logger.info(`Retrying connection in ${RETRY_DELAY / 1000} seconds... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
      setTimeout(() => attemptConnection(retryCount + 1), RETRY_DELAY);
    } else {
      logger.warn('Max retry attempts reached. NATS connection will be attempted again on next operation.');
    }
  }
};

export const init = (onReady: () => void) => {
  attemptConnection().then(() => {
    if (natsClient) {
      onReady();
    }
  });
};

export const get = () => {
  return natsClient;
};
