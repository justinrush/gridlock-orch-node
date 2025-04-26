/* eslint-disable no-plusplus */
import nacl from 'tweetnacl';
import { Msg } from 'nats';
import bs58 from 'bs58';

import { IGuardian, IWallet, IKeyBundle, IGuardianIndexed } from '../wallet.interfaces';
import { Key, ISignatureResponse } from './key.model';
import { logger } from '../../logger';
import { checkAllNodesAgreeOnResult, generateSessionId, get3Nodes, hexToBytes, pkFromStringEDDSA } from './utils';
import { natsService } from '../../nats';

const MINIMUM_WALLET_NODES = 3;

export default {
  async create(
    userId: string,
    email: string,
    guardians: IGuardian[],
    ownerGuardianId: string,
    clientE2ePublicKey: string,
    keyBundle: IKeyBundle
  ): Promise<IWallet> {
    const sessionId = generateSessionId();
    const nodePool = get3Nodes(guardians);
    let walletSavedAlready = false;

    try {
      logger.debug(`--- ${ownerGuardianId} started a new wallet v2 session: ${sessionId}`);

      const startTime = new Date().getTime();
      let sessionParties = 0;

      const sessionPool: { nodeId: string; message: Msg; partyIndex: number; index?: number }[] = [];
      const resultPool: string[] = [];

      await natsService.waitForNode(ownerGuardianId);

      nodePool.forEach((node, index) => {
        if (node.nodeId) {
          const nodeData = keyBundle.nodes.find((n) => n.nodeId === node.nodeId);
          logger.debug(`--- Sending start eddsa keygen message to node: ${node.nodeId}`);

          const message = JSON.stringify({
            key_id: sessionId,
            share_indices: [index + 1],
            threshold: 2,
            client_e2e_public_key: clientE2ePublicKey,
            encrypted_signing_key: nodeData?.encryptedNodeKey,
            email: email,
            timestamp: nodeData?.timestamp,
            message_hmac: nodeData?.messageHMAC,
          });
          natsService.keygenPublishToNodeEdDSA(node.nodeId, message);
        }
      });

      await new Promise((resolve, reject) => {
        natsService.keygenJoinEdDsa(
          sessionId,
          async (message, data) => {
            try {
              logger.debug(`--- Join response. ${data}`);
              const jsonData = JSON.parse(data);
              const nodeId = typeof jsonData === 'object' ? jsonData.node_id : null;
              const partyIndex = typeof jsonData === 'object' ? jsonData.party_index : null;

              if (typeof nodeId === 'string') {
                const nodeAlreadyInPool = sessionPool.find((s) => s && s.nodeId === nodeId);

                if (nodeAlreadyInPool) {
                  logger.debug(`----- Node was already in pool, ignoring`);
                  return;
                }
                sessionParties += 1;
                const joinedNode = nodePool.find((node) => {
                  return nodeId === node.nodeId;
                });

                if (!joinedNode) {
                  logger.debug(`-----Unknown nodeId, ignoring: `, nodeId);
                  return;
                }
                logger.debug(`----- ${joinedNode.name} (${joinedNode.type}), ${nodeId} joined the session pool`);

                sessionPool.push({
                  nodeId,
                  message,
                  partyIndex,
                });
              } else {
                logger.debug(`---- No nodeId specified by guardian, so ignoring`);
              }
              logger.debug(`--- ${sessionParties} have now joined!`);

              if (sessionParties < MINIMUM_WALLET_NODES) {
                // Begin response now all have joined
                return;
              }
              logger.debug(`--- Session ready to start. Parties count: ${sessionParties}`);

              const partiesInSession = sessionPool.map((sessionMember) => sessionMember.partyIndex);

              for (let index = 0; index < sessionParties; index += 1) {
                const sessionMember = sessionPool[index]!;

                logger.error(
                  `--- Session loop index: ${index}. Party index: ${sessionMember.partyIndex}. (Node: ${sessionMember.nodeId}) vs pool size: ${sessionPool.length}`
                );

                if (sessionMember && sessionMember.message) {
                  sessionMember.message.respond(
                    natsService.sc.encode(
                      JSON.stringify({
                        party_count: sessionParties,
                        all_party_indices: partiesInSession,
                      })
                    )
                  );

                  sessionMember.index = sessionMember.partyIndex;
                } else {
                  logger.error(`ERR: Cannot reply to sessionMember #235647143. ${JSON.stringify(sessionMember)}`);
                }
              }

              resolve('Success');
            } catch (err) {
              logger.error(`ERR: Could not parse Join data. ${err}`);

              reject(new Error('Something went wrong'));
            }
          },

          (err) => {
            reject(err);
          }
        );
      });

      const walletResult = await new Promise<IWallet>((resolve, reject) => {
        natsService.keygenResultEdDSA(sessionId, (_, data) => {
          logger.debug(`--- Result response. ${data}`);
          resultPool.push(data);

          if (resultPool.length < MINIMUM_WALLET_NODES) {
            logger.debug(`--- Insufficient nodes to create wallet so far...: ${sessionId}`);
            return;
          }

          const allNodesAgreeOnResult = checkAllNodesAgreeOnResult(resultPool);

          // walletSavedAlready is needed as resultPool could be 3, 4 or 5... would duplicate save wallet otherwise!
          if (!allNodesAgreeOnResult) {
            logger.error(
              `ERR: Sending VALIDATION_ERROR. Nodes do not agree on the result y_sum value! Session: ${sessionId}`
            );
            reject(new Error('Failed to validate wallet'));
          }
          if (walletSavedAlready) {
            logger.error(`--- Wallet has already been saved`);
            return;
          }

          try {
            walletSavedAlready = true;
            logger.debug('SOLANA WALLET PUBLIC KEY RESULT');
            const firstResult = resultPool[0]!;

            const address = bs58.encode(Buffer.from(JSON.parse(firstResult).message.y_sum, 'hex'));

            logger.debug(`--- Wallet address is ${address}`);
            const endTime = new Date().getTime();
            logger.debug(`--- Time: ${Number((endTime - startTime) / 1000).toFixed(1)}s`);

            const associatedGuardians: IGuardianIndexed[] = [];
            // Remember which guardians joined the address generation session
            // Dont add placeholders with --1 and --2 suffix

            sessionPool.forEach((guardian) => {
              if (
                typeof guardian &&
                typeof guardian.nodeId === 'string' &&
                typeof guardian.index === 'number' &&
                !guardian.nodeId.includes('--') &&
                !guardian.nodeId.includes('--2')
              ) {
                const node = nodePool.find((n) => n.nodeId === guardian.nodeId);
                if (node) {
                  associatedGuardians.push({
                    ...node,
                    nodeId: guardian.nodeId,
                    index: guardian.index,
                  });
                  logger.debug(
                    `--- Associated guardian: ${JSON.stringify(associatedGuardians[associatedGuardians.length - 1])}`
                  );
                }
              } else {
                logger.error(`ERR: Invalid guardian, cannot associate with wallet #9324785896`);
              }
            });

            if (!(address && typeof address === 'string' && address !== 'undefined')) {
              logger.error(`ERR: Sending INVALID_WALLET_ADDRESS: ${address}`);

              return reject(new Error('Failed to generate wallet address'));
            }

            resolve({
              userId,
              email,
              address,
              pubKey: address,
              associatedGuardians,
              keyId: sessionId,
              blockchain: 'solana',
            } as IWallet);
          } catch (err) {
            logger.error(`ERR: Sending INVALID_WALLET. ${err}`);
            reject(new Error('Failed to process wallet information'));
          }
        });
      });

      return walletResult;
    } catch (err) {
      logger.error(`ERR: Sending Generic Error. Wallet exception. ${JSON.stringify(err)}`);
      throw err;
    }
  },
  async sign(
    email: string,
    wallet: IWallet,
    clientE2ePublicKey: string,
    keyBundle: IKeyBundle,
    messageSerialized: string,
    isTransferTx: boolean = false
  ): Promise<ISignatureResponse> {
    const sessionId = generateSessionId();
    let sessionParties = 0;
    const sessionPool: { nodeId: string; message: Msg; partyIndex: number; index?: number }[] = [];
    const { keyId } = wallet;
    const nodePool = get3Nodes(wallet.associatedGuardians);
    const ownerNode = wallet.associatedGuardians.find((n) => n.type === 'owner');

    logger.debug(`--- Start a new transaction EDDSA with session Id: ${sessionId}`);

    await natsService.waitForNode(ownerNode?.nodeId!);

    try {
      nodePool.forEach((node) => {
        const nodeData = keyBundle.nodes.find((n) => n.nodeId === node.nodeId);
        const message = JSON.stringify({
          key_id: keyId,
          session_id: sessionId,
          client_e2e_public_key: clientE2ePublicKey,
          encrypted_signing_key: nodeData?.encryptedNodeKey,
          email: email,
          message: [...Buffer.from(messageSerialized)],
          is_transfer_tx: isTransferTx,
          timestamp: nodeData?.timestamp,
          message_hmac: nodeData?.messageHMAC,
        });
        natsService.keySignPublishNewNodeEdDSA(node.nodeId, message);
      });

      await new Promise((resolve, reject) => {
        natsService.ephemeralKeyGenEdDSA(
          sessionId,
          async (message, data) => {
            logger.debug(`--- Join response. ${data}`);

            try {
              // Note "data" is a string, we need to parse
              const jsonData = JSON.parse(data);
              const nodeId = typeof jsonData === 'object' ? jsonData.node_id : null;
              const partyIndex = typeof jsonData === 'object' ? jsonData.party_index : null;

              if (typeof nodeId === 'string') {
                const nodeAlreadyInPool = sessionPool.find((session) => session && session.nodeId === nodeId);

                // @ts-ignore
                if (!nodeAlreadyInPool) {
                  sessionParties++;
                  logger.debug(`----- ${nodeId} joined the session pool at index '${partyIndex}}`);

                  sessionPool.push({
                    nodeId,
                    message,
                    partyIndex,
                  });
                } else {
                  logger.debug(`----- Node was already in pool, ignoring`);
                }
              } else {
                logger.debug(`---- No nodeId specified by guardian, so ignoring`);
              }

              if (sessionParties >= 3) {
                logger.debug(`--- ${sessionParties} have now joined!`);
                // Begin transaction signing now all have joined
                try {
                  const partiesInSession = sessionPool.map((sessionMember) => sessionMember.partyIndex);

                  logger.debug(`--- Session ready to start. Parties count: ${sessionParties}`);

                  for (let index = 0; index < sessionParties; index++) {
                    const sessionMember = sessionPool[index]!;

                    logger.debug(
                      `--- Session loop index: ${index}. Party index: ${sessionMember?.partyIndex}. (Node: ${sessionMember.nodeId}) vs pool size: ${sessionPool.length}`
                    );

                    if (sessionMember && sessionMember.message) {
                      sessionMember.message.respond(
                        natsService.sc.encode(
                          JSON.stringify({
                            party_count: sessionParties,
                            all_party_indices: partiesInSession,
                          })
                        )
                      );

                      // Remember the signing index for future reference
                      sessionMember.index = sessionMember.partyIndex;
                    } else {
                      logger.debug(`ERR: Cannot reply to sessionMember #167573545. ${JSON.stringify(sessionMember)}`);
                    }
                  }
                } catch (err) {
                  logger.error(`ERR: EDDSA Transaction signing. ${err}`);
                }
              }

              resolve('Success');
            } catch (e) {
              reject(new Error('Something went wrong'));
            }
          },
          (err) => {
            reject(err);
          }
        );
      });

      const transactionSignature = await new Promise<ISignatureResponse>((resolve, reject) => {
        let processedResult = false;

        natsService.keySignResultEdDSA(
          sessionId,
          (_, data) => {
            try {
              if (processedResult !== true) {
                processedResult = true;
                logger.debug(`--- Result response.${data}`);

                const signedResponse = JSON.parse(data);
                const signature = `${signedResponse.message.R}${signedResponse.message.sigma}`;
                resolve({
                  signature,
                  signedResponse: { r: '', s: '', v: 0 },
                });
              }
            } catch (err) {
              logger.error(`ERR: Result could not be processed.${err}`);
              reject(err);
            }
          },
          (err) => {
            reject(err);
          }
        );
      });

      return transactionSignature;
    } catch (e) {
      logger.error(`ERR: Transaction Nats error. ${e}`);
      throw e;
    }
  },

  verify(address: string, messageSerialized: string, signature: string): boolean {
    const primaryKeyBytes = pkFromStringEDDSA(address).toBytes();
    const signatureBuffer = Buffer.from(hexToBytes(signature));

    const messageEncoded = new TextEncoder().encode(messageSerialized);
    const verifySignatureResult = nacl.sign.detached.verify(messageEncoded, signatureBuffer, primaryKeyBytes);
    return verifySignatureResult;
  },

  recover(email: string): boolean {
    if (!email) {
      return false;
    }
    return true;
  },
} as Key;
