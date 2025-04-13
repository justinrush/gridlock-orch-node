/* eslint-disable no-plusplus */
import Web3 from 'web3';
import { Msg } from 'nats';
import { IGuardian, IWallet, IKeyBundle, IGuardianIndexed } from '../wallet.interfaces';
import { Key, ISignatureResponse } from './key.model';
import { logger } from '../../logger';
import { checkAllNodesAgreeOnResult, generateSessionId, generateVValue, get3Nodes, getEthereumKeyFromCurve } from './utils';
import { natsService } from '../../nats';

const web3 = new Web3();
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
    let lockSessionPoolForStart = false;
    let walletSavedAlready = false;
    const nodePool = get3Nodes(guardians);

    try {
      logger.info(`ECDSA: CREATE `, userId, email, nodePool);

      const startTime = new Date().getTime();
      let sessionParties = 0;

      const sessionPool: { nodeId: string; message: Msg; index?: number }[] = [];
      const resultPool: string[] = [];

      await natsService.waitForNode(ownerGuardianId);

      const walletSessionResponse = await new Promise<IWallet>((resolve, reject) => {
        natsService.keygenJoin(
          sessionId,
          async (message, data) => {
            try {
              const jsonData = JSON.parse(data);
              const nodeId = typeof jsonData === 'object' ? jsonData.node_id : null;

              if (lockSessionPoolForStart) {
                logger.debug(`----- Session has already been locked, ignoring`);
                return;
              }
              if (typeof nodeId !== 'string') {
                logger.debug(`---- No nodeId specified by guardian, so ignoring`);
                return;
              }
              const nodeAlreadyInPool = sessionPool.find((s) => s && s.nodeId === nodeId);

              if (nodeAlreadyInPool) {
                logger.debug(`----- Node was already in pool, ignoring`);
                return;
              }
              sessionParties++;

              const joinedNode = nodePool.find((node) => {
                return nodeId === node.nodeId;
              });

              if (joinedNode) {
                logger.debug(`----- ${joinedNode.name} (${joinedNode.type}), ${nodeId} joined the session pool`);
              } else {
                logger.debug(`-----Unknown nodeId, ignoring: `, nodeId);
              }
              sessionPool.push({
                nodeId,
                message,
              });
            } catch (err) {
              logger.error(`ERR: Could not parse Join data. ${err}`);
            }
          },
          reject
        );
        natsService.keygenReady(sessionId, (_, data) => {
          logger.debug(`--- Ready response. ${data}`);
        });
        natsService.keygenAuthorize(sessionId, (message, data) => {
          logger.debug(`--- authorize response. ${data}`);
          message.respond(
            natsService.sc.encode(
              JSON.stringify({
                session_id: sessionId,
                session_type: 'keyGen',
              })
            )
          );
        });

        natsService.keygenResult(sessionId, (_, data) => {
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

            return reject(new Error('Failed to validate wallet'));
          }
          if (walletSavedAlready) {
            logger.debug(`--- Wallet has already been saved`);
            return;
          }
          try {
            walletSavedAlready = true;
            const resultYSum = JSON.parse(resultPool[0]!).y_sum;
            // Important: The result may need to be padded so that both the x and y values are exactly 64 characters in length
            if (typeof resultYSum === 'object' && typeof resultYSum.x === 'string' && typeof resultYSum.y === 'string') {
              if (resultYSum.x.length < 64) {
                logger.error(`ERR: Result x sum length is invalid. X value is ${resultYSum.x.length}`);

                while (resultYSum.x.length < 64) {
                  resultYSum.x = `0${resultYSum.x}`;
                }
              }

              if (resultYSum.y.length < 64) {
                logger.error(`ERR: Result y sum length is invalid. Y value is ${resultYSum.y.length}`);

                while (resultYSum.y.length < 64) {
                  resultYSum.y = `0${resultYSum.y}`;
                }
              }
            }

            const { address, pubKey } = getEthereumKeyFromCurve(resultYSum);

            logger.debug(`--- Wallet address is ${address}`);
            const endTime = new Date().getTime();
            logger.debug(`--- Time: ${Number((endTime - startTime) / 1000).toFixed(1)}s`);

            const associatedGuardians: IGuardianIndexed[] = [];
            // Remember which guardians joined the address generation session
            // Dont add placeholders with -- suffix

            sessionPool.forEach((guardian) => {
              if (
                typeof guardian &&
                typeof guardian.nodeId === 'string' &&
                typeof guardian.index === 'number' &&
                !guardian.nodeId.includes('--')
              ) {
                const node = nodePool.find((n) => n.nodeId === guardian.nodeId);
                if (node) {
                  associatedGuardians.push({
                    ...node,
                    nodeId: guardian.nodeId,
                    index: guardian.index + 1, // Increment by 1 for eth
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
              pubKey: pubKey ?? '',
              associatedGuardians,
              address: address!,
              keyId: sessionId,
              blockchain: 'ethereum',
            } as IWallet);
          } catch (err) {
            reject(new Error('Failed to process wallet information'));
          }
        });

        const totalShares = 10;
        const initialShares = 3;
        const extraShares = totalShares - initialShares;
        nodePool.forEach((node) => {
          const nodeData = keyBundle.nodes.find((n) => n.nodeId === node.nodeId);
          if (node && node.nodeId) {
            logger.debug(`--- Sending start keygen message to node: ${node.nodeId}`);

            const message = JSON.stringify({
              key_id: sessionId,
              extra_shares: ownerGuardianId === node.nodeId ? new Array(extraShares).fill(null) : [],
              client_e2e_public_key: clientE2ePublicKey,
              encrypted_signing_key: nodeData?.encryptedNodeKey,
              email: email,
              timestamp: nodeData?.timestamp,
              message_hmac: nodeData?.messageHMAC,
            });
            natsService.keygenPublishToNode(node.nodeId, message);
          }
        });

        let sessionCheckCount = 0;
        const sessionInterval = setInterval(() => {
          sessionCheckCount++;

          // Waiting for owner to join multiple times so that we start with ten keyshares
          if (sessionParties >= totalShares) {
            // Prevent further intervals now we have enough guardians to continue
            clearInterval(sessionInterval);

            logger.debug(`--- Parties count: ${sessionParties}`);
            lockSessionPoolForStart = true;
            let index = 0;

            for (index = 0; index < sessionParties; index++) {
              const sessionMember = sessionPool[index];
              logger.debug(sessionParties);

              logger.debug(`--- Session index: ${index} (Node: ${sessionMember}`);
              logger.debug(
                `--- Session index: ${index} (Node: ${sessionMember?.nodeId}) vs pool size: ${sessionPool.length}`
              );

              if (sessionMember && sessionMember.message) {
                sessionMember?.message?.respond(
                  natsService.sc.encode(
                    JSON.stringify({
                      num_parties: sessionParties,
                      party_num: index,
                    })
                  )
                );
                sessionMember.index = index;
              } else {
                logger.error(`ERR: Cannot reply to sessionMember #9437484. ${JSON.stringify(sessionMember)}`);
              }
            }

            // MUST be comfortably after the nodes have joined! (1s was very borderline the same as join response timing)
            setTimeout(() => {
              logger.debug(`--- Publishing start message`);
              natsService.keygenPublishStart(sessionId);
            }, 2000);
          } else {
            // Should only take 10 seconds to have everyone ready to start!
            // Whole generation process normally takes 12 seconds
            if (sessionCheckCount < 50) {
              // Only print every 10th message for less spam...
              if (sessionCheckCount % 10 === 0) {
                logger.debug(`----- Insufficient parties to continue (${sessionCheckCount})... sleeping 250ms`);
              }
              return;
            }
            logger.debug(
              `--- FAIL: Sending INSUFFICIENT_NODES. Insufficient parties to continue signing request for session: ${sessionId}`
            );

            // Do not continue checking any longer
            clearInterval(sessionInterval);

            reject(new Error('Not all guardians joined in time'));
          }
        }, 200);
      });
      return walletSessionResponse;
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
    messageSerialized: string
  ): Promise<ISignatureResponse> {
    const sessionId = generateSessionId();
    // Every node that "joins" will be added to the sessionPool and increment sessionParties
    const sessionPool: { nodeId: string; message: Msg }[] = [];
    let sessionParties = 0;

    const { keyId } = wallet;
    const nodePool = get3Nodes(wallet.associatedGuardians);

    logger.debug(`--- Start a new transaction with session Id: ${sessionId}`);

    try {
      nodePool.forEach((node) => {
        const nodeData = keyBundle.nodes.find((n) => n.nodeId === node.nodeId);
        const message = JSON.stringify({
          key_id: keyId,
          session_id: sessionId,
          client_e2e_public_key: clientE2ePublicKey,
          encrypted_signing_key: nodeData?.encryptedNodeKey,
          email: email,
          message:
            typeof messageSerialized === 'string'
              ? [...Buffer.from(messageSerialized.slice(2), 'hex')]
              : [...Buffer.from(messageSerialized)],
          timestamp: nodeData?.timestamp,
          message_hmac: nodeData?.messageHMAC,
        });
        natsService.keySignPublishNewNode(node.nodeId, message);
      });

      await new Promise((resolve, reject) => {
        natsService.keySignJoin(sessionId, async (message, data) => {
          logger.debug(`--- Join response. ${data}`);

          try {
            // Note "data" is a string, we need to parse
            const jsonData = JSON.parse(data);
            const nodeId = typeof jsonData === 'object' ? jsonData.node_id : null;

            if (typeof nodeId === 'string') {
              const nodeAlreadyInPool = sessionPool.find((session) => session && session.nodeId === nodeId);

              // @ts-ignore
              if (!nodeAlreadyInPool) {
                sessionParties++;
                logger.debug(`----- ${nodeId} joined the session pool`);

                sessionPool.push({
                  nodeId,
                  message,
                });
              } else {
                logger.debug(`----- Node was already in pool, ignoring`);
              }
            } else {
              logger.debug(`---- No nodeId specified by guardian, so ignoring`);
            }

            if (sessionParties >= 3) {
              logger.debug(`--- ${sessionParties} have now joined!`);

              try {
                for (let index = 0; index < sessionParties; index++) {
                  const sessionMember = sessionPool[index];

                  if (sessionMember && sessionMember.message) {
                    sessionMember.message.respond(
                      natsService.sc.encode(
                        JSON.stringify({
                          id_in_session: index,
                          message:
                            typeof messageSerialized === 'string'
                              ? [...Buffer.from(messageSerialized.slice(2), 'hex')]
                              : [...Buffer.from(messageSerialized)],
                        })
                      )
                    );
                  }
                }
                // start signing
                natsService.keySignPublishStart(sessionId, `${sessionParties}/5`);
              } catch (err) {
                return reject(new Error(`ERR: ECDSA Transaction signing. ${err}`));
              }
            }

            resolve('Success');
          } catch (e) {
            reject(new Error('Something went wrong'));
          }
        });
      });

      const transactionSignature = await new Promise<ISignatureResponse>((resolve, reject) => {
        natsService.keygenAuthorize(sessionId, (message, data) => {
          logger.debug(`--- authorize response. ${data}`);
          message.respond(
            natsService.sc.encode(
              JSON.stringify({
                session_id: sessionId,
                session_type: 'keySign',
              })
            )
          );
        });
        let processedResult = false;
        natsService.keySignResult(
          sessionId,
          (_, data) => {
            try {
              if (processedResult !== true) {
                processedResult = true;
                const signedResponse = JSON.parse(data);
                const CHAIN_ID = 1; // consider only etherium
                const v = generateVValue(signedResponse.recid, CHAIN_ID);
                const signature = `0x${signedResponse.r}${signedResponse.s}${v}`;

                resolve({
                  signature,
                  signedResponse: { r: signedResponse.r, s: signedResponse.s, v },
                });
              }
            } catch (err) {
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
    logger.debug(address);
    logger.debug(messageSerialized);
    logger.debug(signature);

    //EIP-155 adds a chainId to the signature, removing it
    const sig = signature.slice(0, -2) + '1b'; //0x1b = 27 in decimal

    const signingAddress = web3.eth.accounts.recover(messageSerialized, sig);
    return signingAddress.toLowerCase() === address.toLowerCase();
  },

  recover(email: string): boolean {
    if (!email) {
      return false;
    }
    return true;
  },
} as Key;
