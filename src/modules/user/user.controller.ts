import httpStatus from 'http-status';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import catchAsync from '../utils/catchAsync';
import ApiError from '../errors/ApiError';
import pick from '../utils/pick';
import * as userService from './user.service';
import { IUser } from './user.interfaces';
import { cleanMongo } from '../utils/cleanMongo';
import { logger } from '../logger';

export const createUser = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  res.status(httpStatus.CREATED).send(user);
});

export const getUsers = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['name', 'role']);
  const options = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const result = await userService.queryUsers(filter, options);
  res.send(result);
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['email'] === 'string') {
    const user = await userService.getUserByEmail(req.params['email']);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    res.send(user);
  }
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['userId'] === 'string') {
    const user = await userService.updateUserById(new mongoose.Types.ObjectId(req.params['userId']), req.body);
    res.send(user);
  }
});

export const addCustomGuardian = catchAsync(async (req: Request, res: Response) => {
  const userDoc = await userService.addCustomGuardian(
    new mongoose.Types.ObjectId(req.user.id),
    req.body.guardian,
    req.body.isOwnerGuardian
  );
  const user: IUser = await cleanMongo(userDoc);
  res.send(user);
});

export const deleteUser = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['userId'] === 'string') {
    await userService.deleteUserById(new mongoose.Types.ObjectId(req.params['userId']));
    res.status(httpStatus.NO_CONTENT).send();
  }
});

export const addGridlockGuardian = catchAsync(async (req: Request, res: Response) => {
  const { user: UserDoc, guardian } = await userService.addGridlockGuardian(req.user.id);
  const user: IUser = await cleanMongo(UserDoc);
  res.status(200).send({ user, guardian });
});

export const addPartnerGuardian = catchAsync(async (req: Request, res: Response) => {
  const { user: UserDoc, guardian } = await userService.addPartnerGuardian(req.user.id);
  const user: IUser = await cleanMongo(UserDoc);
  res.status(200).send({ user, guardian });
});

export const recoverUser = catchAsync(async (req: Request, res: Response) => {
  const { email, clientE2ePublicKey, keyBundle } = req.body;
  logger.debug('recoverUser', email, clientE2ePublicKey, keyBundle);
  const recoveryResponse = await userService.recoverUserInitiation(email, clientE2ePublicKey, keyBundle);
  res.send(recoveryResponse);
});

export const confirmRecoverUser = catchAsync(async (req: Request, res: Response) => {
  const { email, clientE2ePublicKey, encryptedRecoveryConfirmation, keyBundle } = req.body;
  const result = await userService.confirmRecoverUser(email, clientE2ePublicKey, encryptedRecoveryConfirmation, keyBundle);
  res.send(result);
});

export const transferUser = catchAsync(async (req: Request, res: Response) => {
  const { email, keyBundle, clientE2ePublicKey, clientIdentityPublicKey } = req.body;
  const transferResponse = await userService.transferUser(email, keyBundle, clientE2ePublicKey, clientIdentityPublicKey);
  res.send(transferResponse);
});
