/* eslint-disable no-restricted-syntax */
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Wallet from './wallet.model';
import ApiError from '../errors/ApiError';
import { NewCreatedWallet, UpdateWalletBody, IWalletDoc, IWallet, IKeyBundle } from './wallet.interfaces';
import { checkPaillier, keyshareGenerator, REGEN_STATUS } from './keys/regen';
import { IUser } from '../user/user.interfaces';
import { logger } from '../logger';

export const createWallet = async (walletBody: NewCreatedWallet): Promise<IWalletDoc> => {
  if (await Wallet.isExistingWallet(walletBody.keyId, walletBody.blockchain)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Wallet already taken');
  }

  return Wallet.create(walletBody);
};

export const queryWallets = async (filter: Record<string, any>, options: any, userId: string): Promise<IWalletDoc[]> => {
  const wallets = await Wallet.find({ ...filter, userId }, options);
  return wallets;
};

export const getWalletById = async (id: mongoose.Types.ObjectId): Promise<IWalletDoc | null> => Wallet.findById(id);
export const getWalletByAddress = async (address: string): Promise<IWalletDoc | null> => Wallet.findOne({ address });
export const getWalletByEmail = async (email: string): Promise<IWalletDoc | null> => Wallet.findOne({ email });
export const getWalletByUserId = async (userId: string): Promise<IWalletDoc | null> => Wallet.findOne({ userId });

export const updateWalletById = async (
  walletId: mongoose.Types.ObjectId,
  updateBody: UpdateWalletBody
): Promise<IWalletDoc | null> => {
  const wallet = await getWalletById(walletId);
  if (!wallet) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Wallet not found');
  }
  Object.assign(wallet, updateBody);
  await wallet.save();
  return wallet;
};

export const deleteWalletById = async (walletId: mongoose.Types.ObjectId): Promise<IWalletDoc | null> => {
  const wallet = await getWalletById(walletId);
  if (!wallet) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Wallet not found');
  }
  await wallet.deleteOne();
  return wallet;
};

export const generateMissingKeshares = async (user: IUser, okey: IWallet) => {
  try {
    const key = { ...okey };
    const nodesLeft = user.nodePool.filter((node) => !key.associatedGuardians.map((a) => a.nodeId).includes(node.nodeId));
    const freeIndexes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(
      (index) => !key.associatedGuardians.map((a) => a.index).includes(index)
    );

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < nodesLeft.length; i++) {
      const targetNode = nodesLeft[i]!;
      if (i < freeIndexes.length) {
        const index = freeIndexes[i]!;

        // eslint-disable-next-line no-await-in-loop
        const generatorResponse = await keyshareGenerator({
          keyId: key.keyId,
          blockchain: key.blockchain,
          nodes: key.associatedGuardians,
          targetNode: { ...targetNode, index },
        });
        if ([REGEN_STATUS.SUCCESS, REGEN_STATUS.DELIVER_TO_ALL].includes(generatorResponse.status)) {
          key.associatedGuardians.push({ ...targetNode, index });
        } else {
          logger.debug(`Something wrong with generating key for ${targetNode.nodeId}`);
        }
      } else {
        logger.debug(`No room for ${targetNode.nodeId}: MAX 10`);
      }
    }
    return key;
  } catch (err) {
    logger.error(err);
    return okey;
  }
};

export const recoverUserWalletsKeyshares = async (id: mongoose.Types.ObjectId, user: IUser, keyBundle: IKeyBundle) => {
  const wallets = await Wallet.find({ userId: id });

  try {
    const newOwnerNode = user.nodePool.find((node) => node.type === 'owner')!;
    // eslint-disable-next-line no-plusplus, no-unreachable-loop
    for (let i = 0; i < wallets.length; i++) {
      const key = wallets[i]!;

      const toBeReplacedNode = key.associatedGuardians.find((node) => node.type === 'owner')!;
      const validNodes = key.associatedGuardians.filter((node) => node.nodeId !== toBeReplacedNode.nodeId);
      const targetNode = { ...newOwnerNode, index: toBeReplacedNode?.index };

      // eslint-disable-next-line no-await-in-loop
      const generatorResponse = await keyshareGenerator({
        keyBundle,
        keyId: key.keyId,
        blockchain: key.blockchain,
        nodes: validNodes,
        targetNode,
      });
      if ([REGEN_STATUS.DELIVER_TO_ALL, REGEN_STATUS.DELIVER_TO_ALL].includes(generatorResponse.status)) {
        Object.assign(key, { associatedGuardians: [targetNode, ...validNodes] });
        // eslint-disable-next-line no-await-in-loop
        await key.save();
      } else {
        logger.debug(`Something wrong with generating key for ${targetNode.nodeId}`);
      }
    }
    return wallets;
  } catch (err) {
    logger.error(err);
    return wallets;
  }
};

export const paillierFromWallet = async (key: IWallet | string) => {
  let wallet: IWallet | null = null;
  if (typeof key === 'string') {
    wallet = await Wallet.findOne({ keyId: key }).lean();
  }
  wallet = key as IWallet;

  const response = [];
  if (!wallet) {
    return [];
  }
  for (const ag of wallet.associatedGuardians) {
    // eslint-disable-next-line no-await-in-loop
    const paillier = await checkPaillier(wallet.keyId, ag.nodeId);
    response.push({
      ...ag,
      paillier,
    });
  }
  return response;
};

/**
 * Get wallet by user ID and blockchain type
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} blockchain - Blockchain type
 * @returns {Promise<IWallet | null>}
 */
export const getWalletByUserAndBlockchain = async (
  userId: mongoose.Types.ObjectId,
  blockchain: string
): Promise<IWallet | null> => {
  return Wallet.findOne({ userId, blockchain });
};
