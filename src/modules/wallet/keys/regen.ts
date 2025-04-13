import { ErrorCode, Msg, NatsError } from 'nats';

import { IGuardianIndexed, IKeyBundle } from '../wallet.interfaces';
import { blockchainToKeyType, generateSessionId } from './utils';
import { natsService } from '../../nats';
import { sc } from '../../nats/nats.service';
import { logger } from '../../logger';

export const REGEN_STATUS = {
  SUCCESS: 'SUCCESS',
  DELIVER_TO_TARGET: 'DELIVER_TO_TARGET',
  DELIVER_TO_ALL: 'DELIVER_TO_ALL',
  FAILED: 'FAILED',
};
interface IKeyshareGeneratorProps {
  keyId: string;
  blockchain: 'solana' | 'ethereum';
  nodes: IGuardianIndexed[];
  targetNode: IGuardianIndexed;
  timeoutMs?: number;
  threshold?: number;
  keyBundle?: IKeyBundle;
}

export const keyshareGenerator = async ({
  keyId,
  blockchain,
  nodes,
  targetNode,
  timeoutMs = 8000,
  threshold = 2,
}: IKeyshareGeneratorProps) => {
  logger.error('targetNode');
  logger.error(JSON.stringify(targetNode));

  const sessionId = generateSessionId();

  const helperNodes = nodes.filter((node) => node.nodeId !== targetNode.nodeId);
  logger.error('helperNodes');
  logger.error(JSON.stringify(helperNodes));

  const targetNodeIndex = targetNode.index;

  const allNodes = [...helperNodes, targetNode];
  logger.error('allNodes');
  logger.error(JSON.stringify(allNodes));

  const publicKeysByIndex = allNodes.map((node) => [node.index, node.networkingPublicKey]);
  logger.error('publicKeysByIndex');
  logger.error(JSON.stringify(publicKeysByIndex));

  const keyType = blockchainToKeyType(blockchain);

  const joinSubscription = natsService.keyshareRegenJoin(sessionId, timeoutMs);

  const regenPackageSubscription = natsService.keyshareRegenPackageDelivery(sessionId, timeoutMs);

  const resultSubscription = natsService.keyshareRegenValidation(sessionId, timeoutMs);

  const keyRegenerationMessage = {
    key_id: keyId,
    session_id: sessionId,
    key_type: keyType,
    recovery_index: targetNodeIndex,
    threshold,
    public_keys: publicKeysByIndex,
  };

  // Send start messages
  helperNodes.forEach(async (node) => {
    await natsService.keyShareRecoveryPublish(node.nodeId, JSON.stringify({ ...keyRegenerationMessage, role: 'Helper' }));
  });
  await natsService.keyShareRecoveryPublish(
    targetNode.nodeId,
    JSON.stringify({ ...keyRegenerationMessage, role: 'Target' })
  );

  const joinParams = {
    targetNodePresent: false,
    helperIndices: [] as number[],
    natsMessagesToRespondTo: [] as Msg[],
    numHelpersRequired: threshold + 1,
    numHelpersConditionMet: false,
  };

  // Wait for enough parties to join session
  try {
    setTimeout(() => {
      joinSubscription.unsubscribe();
    }, 2000);
    // eslint-disable-next-line no-restricted-syntax
    for await (const message of joinSubscription) {
      const data = JSON.parse(sc.decode(message.data));
      const index = data.party_index;
      if (index !== targetNodeIndex && !joinParams.numHelpersConditionMet && !joinParams.helperIndices.includes(index)) {
        joinParams.helperIndices.push(index);
        joinParams.natsMessagesToRespondTo.push(message);
        logger.debug(`--- Helper with index ${index} has joined the session`);
      } else if (index === targetNodeIndex && !joinParams.targetNodePresent) {
        joinParams.natsMessagesToRespondTo.push(message);
        joinParams.targetNodePresent = true;
        logger.debug(`--- Regeneration target has joined the session`);
      }

      joinParams.numHelpersConditionMet = joinParams.helperIndices.length === joinParams.numHelpersRequired;

      logger.debug(
        `numHelpersConditionMet:${joinParams.helperIndices.length === joinParams.numHelpersRequired} , helperLength ${
          joinParams.helperIndices.length
        }, numHelpersRequired ${joinParams.numHelpersRequired}`
      );
      // Though we don't require the target node to join we'll wait for it here as if it joins it makes things simpler
      if (joinParams.numHelpersConditionMet && joinParams.targetNodePresent) {
        logger.debug('--- All parties required have joined the key regeneration session');
        joinSubscription.unsubscribe();
      }
    }
  } catch (err) {
    if ((err as NatsError).code === ErrorCode.Timeout) {
      logger.debug(`Join subscription timed out, probably because the target node didn't join - this is okay`);
    } else {
      logger.debug(`Error in join subscription: ${(err as NatsError).message}`);
    }
  }
  joinParams.helperIndices.sort(function (a, b) {
    return a - b;
  });

  // Respond to join session with index of helpers
  const response = {
    party_count: joinParams.helperIndices.length,
    all_party_indices: joinParams.helperIndices,
  };
  const encodedResponse = sc.encode(JSON.stringify(response));

  joinParams.natsMessagesToRespondTo.forEach((m) => m.respond(encodedResponse));

  // Save regen packages in case the target node is not online or otherwise fails to recieve messages
  const regenPackages = [];
  let regenPackagesMessage = null;
  try {
    // eslint-disable-next-line no-restricted-syntax
    for await (const message of regenPackageSubscription) {
      const json = JSON.parse(sc.decode(message.data));
      regenPackages.push(json);
      if (regenPackages.length === threshold + 1) {
        const packagesOrdered = regenPackages
          .sort(function (a, b) {
            return a.sender_id - b.sender_id;
          })
          .map((x) => x.message);
        logger.debug('--- All parties required have joined the key regeneration session');
        regenPackageSubscription.unsubscribe();
        regenPackagesMessage = {
          key_id: keyId,
          recovery_index: targetNodeIndex,
          threshold,
          peers: joinParams.helperIndices,
          public_keys: publicKeysByIndex,
          encrypted_packages: packagesOrdered,
          key_type: keyType,
        };
      }
    }
  } catch (e) {
    const err = e as NatsError;
    if (err.code === ErrorCode.Timeout) {
      logger.debug(`sessionId: ${sessionId}`);

      logger.debug(`Package subscription timed out!`);
    } else {
      logger.debug(`sessionId: ${sessionId}`);

      logger.debug(`Error in package subscription: ${err.message}`);
    }
  }

  const packagesValidationResponse = { success: false, paillierUpdates: null } as {
    success: boolean;
    paillierUpdates: { key_id: string; new_ek: any; index: number } | null;
  };
  if (joinParams.targetNodePresent) {
    try {
      // eslint-disable-next-line no-restricted-syntax
      for await (const message of resultSubscription) {
        const json = JSON.parse(sc.decode(message.data));
        let msg = json.message;
        if (
          typeof msg === 'string' &&
          ((msg.includes('Validated') && msg !== 'Validated') || msg.includes('ValidationError'))
        ) {
          msg = JSON.parse(msg);
        }
        const successConsoleMessage = `--- Key regeneration packages validated sucessfully for key id: ${keyId}`;
        if (msg === 'Validated' || msg.Validated) {
          logger.debug(successConsoleMessage);
          logger.debug(`--- Key type ${keyType}`);
          packagesValidationResponse.success = true;
          if (keyType === 'ECDSA') {
            packagesValidationResponse.paillierUpdates = {
              key_id: keyId,
              new_ek: msg.Validated,
              index: targetNodeIndex,
            };
          }
        } else if (msg.ValidationError) {
          if (msg.ValidationError.includes('The keyshare was recovered and validated successfully')) {
            // If keyfile is preexisting the protocol returns an error, but we want to treat this as successful
            logger.debug(successConsoleMessage);
            logger.debug(`--- ${msg.ValidationError}`);
            packagesValidationResponse.success = true;
          }
          logger.debug(`--- Key regeneration failed to complete with error: ${msg.ValidationError}`);
          logger.debug(keyType ?? 'Unknown', keyId, targetNodeIndex);
        }
      }
    } catch (e) {
      const err = e as NatsError;
      if (err.code === ErrorCode.Timeout) {
        logger.debug(`--- Timeout while waiting for the target node to process the regeneration packages`);
      } else {
        logger.debug(`Error in result subscription: ${err.message}`);
      }
    }
  }

  if (packagesValidationResponse) {
    if (packagesValidationResponse.success) {
      if (packagesValidationResponse.paillierUpdates) {
        // Need to return paillier update to send to all nodes in pool except target
        return {
          status: REGEN_STATUS.DELIVER_TO_ALL,
          data: packagesValidationResponse.paillierUpdates,
        };
      }
      // No updates to deliver - nothing further to do for regen
      return { status: REGEN_STATUS.SUCCESS, data: null };
    }
    // Packages recieved but rejected - need to start regen process again
    return { status: REGEN_STATUS.FAILED, data: null };
  }
  // Packages not recieved so try to deliver packages later
  if (regenPackagesMessage) {
    return { status: REGEN_STATUS.DELIVER_TO_TARGET, data: regenPackagesMessage };
  }
  // Did not manage to generate packages so return failure
  return { status: REGEN_STATUS.FAILED, data: null };
};

export const checkPaillier = async (keyId: string, nodeId: string) => {
  const response = await natsService.keyshareCheck(keyId, nodeId);
  const responseObject = JSON.parse(sc.decode(response.data));
  return responseObject;
};
