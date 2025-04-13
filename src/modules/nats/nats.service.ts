import { Msg, StringCodec } from 'nats';
import { logger } from '../logger';
import { natsClient } from './nats.instance';

const WAIT_TIMEOUT = 5000;
export const sc = StringCodec();

// export const getNatsClient = async (timeoutMs = 1) => {
//   const start = new Date().getTime();
//   while (start + timeoutMs >= new Date().getTime()) {
//     if (natsClient) {
//       return natsClient;
//     }
//     // eslint-disable-next-line no-await-in-loop
//     await new Promise((resolve) => {
//       setTimeout(resolve, 1);
//     });
//   }
//   throw Error('Nats not ready!');
// };

export const waitForNode = async (nodeId: string, timeoutMs?: number): Promise<void> => {
  return;
  const sub = natsClient.subscribe(`network.gridlock.nodes.ready.${nodeId}`, {
    timeout: timeoutMs ?? WAIT_TIMEOUT,
    max: 1,
  });
  // eslint-disable-next-line no-restricted-syntax
  for await (const _ of sub) {
    logger.debug('Ready:', nodeId);
  }
};

export const keygenJoin = (sessionId: string, c?: (message: Msg, data: string) => void, e?: (message: string) => void) => {
  natsClient.subscribe(`network.gridlock.nodes.keyGen.session.${sessionId}.join`, {
    callback: (err, msg) => {
      if (err) {
        e?.(err.message);
        logger.error('keygenJoin', sessionId, err.message);
      } else {
        c?.(msg, sc.decode(msg.data));
      }
    },
  });
};

export const keygenJoinEdDsa = (
  sessionId: string,
  c?: (message: Msg, data: string) => void,
  e?: (message: string) => void
) => {
  natsClient.subscribe(`network.gridlock.nodes.KeyGenEdDSA.${sessionId}.Join`, {
    callback: (err, msg) => {
      if (err) {
        e?.(err.message);
        logger.error('keygenJoin', sessionId, err.message);
      } else {
        c?.(msg, sc.decode(msg.data));
      }
    },
  });
};
export const keygenReady = (sessionId: string, c?: (message: Msg, data: string) => void, e?: (message: string) => void) => {
  natsClient.subscribe(`network.gridlock.nodes.keyGen.session.${sessionId}.ready`, {
    callback: (err, msg) => {
      if (err) {
        e?.(err.message);
        logger.error('keygenJoin', sessionId, err.message);
      } else {
        c?.(msg, sc.decode(msg.data));
      }
    },
  });
};
export const keygenAuthorize = (
  sessionId: string,
  c?: (message: Msg, data: string) => void,
  e?: (message: string) => void
) => {
  natsClient.subscribe(`network.gridlock.nodes.${sessionId}.authorize`, {
    callback: (err, msg) => {
      if (err) {
        e?.(err.message);
        logger.error('keygenJoin', sessionId, err.message);
      } else {
        c?.(msg, sc.decode(msg.data));
      }
    },
  });
};
export const keygenResult = (sessionId: string, c?: (message: Msg, data: string) => void, e?: (message: string) => void) => {
  natsClient.subscribe(`network.gridlock.nodes.keyGen.session.${sessionId}.result`, {
    callback: (err, msg) => {
      if (err) {
        e?.(err.message);
        logger.error('keygenJoin', sessionId, err.message);
      } else {
        c?.(msg, sc.decode(msg.data));
      }
    },
  });
};
export const keygenResultEdDSA = (
  sessionId: string,
  c?: (message: Msg, data: string) => void,
  e?: (message: string) => void
) => {
  natsClient.subscribe(`network.gridlock.nodes.KeyGenEdDSA.${sessionId}.Result`, {
    callback: (err, msg) => {
      if (err) {
        e?.(err.message);
        logger.error('keygenJoin', sessionId, err.message);
      } else {
        c?.(msg, sc.decode(msg.data));
      }
    },
  });
};
export const keygenPublishToNode = (nodeId: string, message: string) => {
  natsClient.publish(`network.gridlock.nodes.keyGen.new.${nodeId}`, sc.encode(message));
};
export const keygenPublishToNodeEdDSA = (nodeId: string, message: string) => {
  natsClient.publish(`network.gridlock.nodes.KeyGenEdDSA.new.${nodeId}`, sc.encode(message));
};
export const keygenPublishStart = (sessionId: string, message?: string) => {
  if (message) {
    natsClient.publish(`network.gridlock.nodes.keyGen.session.${sessionId}.start`, sc.encode(message));
  } else {
    natsClient.publish(`network.gridlock.nodes.keyGen.session.${sessionId}.start`);
  }
};

export const keySignPublishNewNode = (nodeId: string, message: string) => {
  logger.debug(`--- keySignPublishNewNode ${nodeId}`);

  natsClient.publish(`network.gridlock.nodes.keySign.new.${nodeId} `, sc.encode(message));
};

// This function handles both regular signing and meta transactions (ownership transfers)
// The message JSON may include an 'is_transfer_tx' flag that nodes can use for additional logic
// For ownership transfers, the message will contain a clientIdentityPublicKey for the new owner
export const keySignPublishNewNodeEdDSA = (nodeId: string, message: string) => {
  natsClient.publish(`network.gridlock.nodes.KeySignEdDSA.new.${nodeId}`, sc.encode(message));
};

export const keySignJoin = (sessionId: string, c?: (message: Msg, data: string) => void, e?: (message: string) => void) => {
  natsClient.subscribe(`network.gridlock.nodes.keySign.session.${sessionId}.join`, {
    timeout: 10000,

    callback: (err, msg) => {
      if (err) {
        logger.error(err);

        e?.(err.message);
        logger.error('keygenJoin', sessionId, err.message);
      } else {
        c?.(msg, sc.decode(msg.data));
      }
    },
  });
};
export const ephemeralKeyGenEdDSA = (
  sessionId: string,
  c?: (message: Msg, data: string) => void,
  e?: (message: string) => void
) => {
  natsClient.subscribe(`network.gridlock.nodes.EphemeralKeyGenEdDSA.${sessionId}.Join`, {
    timeout: 10000,
    callback: (err, msg) => {
      if (err) {
        e?.(err.message);
        logger.error('keygenJoin', sessionId, err.message);
      } else {
        c?.(msg, sc.decode(msg.data));
      }
    },
  });
};
export const keySignResult = (
  sessionId: string,
  c?: (message: Msg, data: string) => void,
  e?: (message: string) => void
) => {
  natsClient.subscribe(`network.gridlock.nodes.keySign.session.${sessionId}.result`, {
    callback: (err, msg) => {
      if (err) {
        e?.(err.message);
        logger.error('keygenJoin', sessionId, err.message);
      } else {
        c?.(msg, sc.decode(msg.data));
      }
    },
  });
};
export const keySignResultEdDSA = (
  sessionId: string,
  c?: (message: Msg, data: string) => void,
  e?: (message: string) => void
) => {
  natsClient.subscribe(`network.gridlock.nodes.KeySignEdDSA.${sessionId}.Result`, {
    timeout: 20000,

    callback: (err, msg) => {
      if (err) {
        e?.(err.message);
        logger.error('keygenJoin', sessionId, err.message);
      } else {
        c?.(msg, sc.decode(msg.data));
      }
    },
  });
};

export const keySignPublishStart = (sessionId: string, message: string) => {
  setTimeout(() => {
    logger.debug(`--- Publishing start message`);
    natsClient.publish(`network.gridlock.nodes.keySign.session.${sessionId}.start`, sc.encode(message));
  }, 1000);
};

export const keyRecoverPublish = (nodeId: string, message: string) => {
  setTimeout(() => {
    logger.debug(`--- Publishing recover message for node ${nodeId}`);
    natsClient.publish(`network.gridlock.nodes.UserRecovery.new.${nodeId}`, sc.encode(message));
  }, 1000);
};

export const publishUserRecoveryConfirm = (nodeId: string, message: string) => {
  setTimeout(() => {
    logger.debug(`--- Publishing recovery confirm message for node ${nodeId}`);
    natsClient.publish(`network.gridlock.nodes.UserRecoveryConfirm.new.${nodeId}`, sc.encode(message));
  }, 1000);
};

export const keyShareRecoveryPublish = async (nodeId: string, message: string) => {
  natsClient.publish(`network.gridlock.nodes.KeyShareRecovery.new.${nodeId}`, sc.encode(message));
};

export const keyShareRecoveryJoin = (
  sessionId: string,
  c?: (message: Msg, data: string) => void,
  e?: (message: string) => void
) => {
  natsClient.subscribe(`network.gridlock.nodes.KeyShareRecovery.${sessionId}.Join`, {
    timeout: 2000,

    callback: (err, msg) => {
      if (err) {
        e?.(err.message);
        logger.error('keygenJoin', sessionId, err.message);
      } else {
        c?.(msg, sc.decode(msg.data));
      }
    },
  });
};

export const sendData = async (nodeId: string, data: any) => {
  try {
    const response = await natsClient.request(
      `network.gridlock.nodes.Message.new.${nodeId}`,
      sc.encode(JSON.stringify(data)),
      {
        timeout: 5000,
      }
    );
    logger.debug(sc.decode(response.data));
    return { success: true, response: sc.decode(response.data) };
  } catch (err) {
    return { success: false, response: err };
  }
};
export const keyshareCheck = async (keyId: string, nodeId: string) => {
  const response = await natsClient.request(
    `network.gridlock.nodes.Message.new.${nodeId}`,
    sc.encode(
      JSON.stringify({
        key_id: keyId,
      })
    ),
    {
      timeout: 5000,
    }
  );
  return response;
};

export const keyshareRegenJoin = (sessionId: string, timeoutMs: number) => {
  return natsClient.subscribe(`network.gridlock.nodes.KeyShareRecovery.${sessionId}.Join`, {
    timeout: timeoutMs,
  });
};

export const keyshareRegenPackageDelivery = (sessionId: string, timeoutMs: number) => {
  return natsClient.subscribe(`network.gridlock.nodes.KeyShareRecovery.${sessionId}.DeliverRecoveryPackage`, {
    timeout: timeoutMs,
  });
};

export const keyshareRegenValidation = (sessionId: string, timeoutMs: number) => {
  return natsClient.subscribe(`network.gridlock.nodes.KeyShareRecovery.${sessionId}.ValidationResult`, {
    max: 1,
    timeout: timeoutMs,
  });
};
