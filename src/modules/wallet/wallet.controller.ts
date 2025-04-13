import httpStatus from 'http-status';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import catchAsync from '../utils/catchAsync';
import ApiError from '../errors/ApiError';
import pick from '../utils/pick';
import ecdsa from './keys/ecdsa';
import eddsa from './keys/eddsa';

import * as walletService from './wallet.service';
import { IWallet } from './wallet.interfaces';
import { logger } from '../logger';
import { cleanMongo } from '../utils/cleanMongo';
import { getUserByEmail } from '../user/user.service';

export const createWallet = catchAsync(async (req: Request, res: Response) => {
  const { user, blockchain, clientE2ePublicKey, keyBundle } = req.body;
  const userFromDb = await getUserByEmail(user.email);
  if (!userFromDb) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Check if user already has a wallet for this blockchain
  const existingWallet = await walletService.getWalletByUserAndBlockchain(userFromDb.id, blockchain);
  if (existingWallet) {
    throw new ApiError(httpStatus.CONFLICT, `User already has a wallet for ${blockchain}`);
  }

  let key: IWallet;
  switch (blockchain) {
    case 'ethereum':
      key = await ecdsa.create(
        userFromDb.id,
        user.email,
        user.nodePool,
        user.ownerGuardianId,
        clientE2ePublicKey,
        keyBundle
      );
      break;
    case 'solana':
      key = await eddsa.create(
        userFromDb.id,
        user.email,
        user.nodePool,
        user.ownerGuardianId,
        clientE2ePublicKey,
        keyBundle
      );
      break;
    default:
      key = await eddsa.create(
        userFromDb.id,
        user.email,
        user.nodePool,
        user.ownerGuardianId,
        clientE2ePublicKey,
        keyBundle
      );
      break;
  }

  key = await walletService.generateMissingKeshares(user, key);
  const walletDoc = await walletService.createWallet(key);
  const wallet: IWallet = await cleanMongo(walletDoc);
  res.status(httpStatus.CREATED).send(wallet);
});

export const getWallets = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['name']);
  const options = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const result = await walletService.queryWallets(filter, options, req.user.id);
  res.send(result);
});

export const getWallet = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['walletId'] !== 'string') {
    throw new ApiError(httpStatus.NOT_FOUND, 'Wallet not found');
  }
  const wallet = await walletService.getWalletById(new mongoose.Types.ObjectId(req.params['walletId']));
  if (!wallet) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Wallet not found');
  }
  res.send(wallet);
});

export const updateWallet = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['walletId'] === 'string') {
    const wallet = await walletService.updateWalletById(new mongoose.Types.ObjectId(req.params['walletId']), req.body);
    res.send(wallet);
  }
});

export const deleteWallet = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['walletId'] === 'string') {
    await walletService.deleteWalletById(new mongoose.Types.ObjectId(req.params['walletId']));
    res.status(httpStatus.NO_CONTENT).send();
  }
});

export const sign = catchAsync(async (req: Request, res: Response) => {
  const { user, wallet, message, clientE2ePublicKey, keyBundle } = req.body;

  logger.debug(wallet);

  let signature = null;
  switch (wallet.blockchain) {
    case 'ethereum':
      signature = await ecdsa.sign(user.email, wallet, clientE2ePublicKey, keyBundle, message);
      break;
    case 'solana':
      signature = await eddsa.sign(user.email, wallet, clientE2ePublicKey, keyBundle, message, false);
      break;
    default:
      signature = await eddsa.sign(user.email, wallet, clientE2ePublicKey, keyBundle, message, false);
      break;
  }
  res.send(signature);
});

export const verify = catchAsync(async (req: Request, res: Response) => {
  const { signature, message, wallet } = req.body;

  let verified = null;
  switch (wallet.blockchain) {
    case 'ethereum':
      verified = ecdsa.verify(wallet.address, message, signature);
      break;
    case 'solana':
      verified = eddsa.verify(wallet.address, message, signature);
      break;
    default:
      verified = eddsa.verify(wallet.address, message, signature);
      break;
  }
  res.send({ verified });
});

export const keyshareRecovery = catchAsync(async (req: Request, res: Response) => {
  const { user, keyBundle } = req.body;

  const wallets = walletService.recoverUserWalletsKeyshares(req.user.id, user, keyBundle);

  res.send(wallets);
});

export const paillierForWallet = catchAsync(async (req: Request, res: Response) => {
  const { wallet } = req.body;

  const wallets = walletService.paillierFromWallet(wallet);

  res.send(wallets);
});
