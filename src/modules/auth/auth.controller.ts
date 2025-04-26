import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { tokenService } from '../token';
import { userService } from '../user';
import * as authService from './auth.service';
import { emailService } from '../email';
import { IUserDoc, IUser } from '../user/user.interfaces';
import { cleanMongo } from '../utils/cleanMongo';

export const register = catchAsync(async (req: Request, res: Response) => {
  const userDoc = await userService.registerUser(req.body);
  const authTokens = await tokenService.generateAuthTokens(userDoc);
  const user: IUser = await cleanMongo(userDoc);
  res.status(httpStatus.CREATED).send({ user, authTokens });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await authService.loginUserWithEmailAndPassword(email, password);
  const authTokens = await tokenService.generateAuthTokens(user);
  res.send({ user, authTokens });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
});

export const refreshTokens = catchAsync(async (req: Request, res: Response) => {
  const userWithTokens = await authService.refreshAuth(req.body.refreshToken);
  const authTokens = userWithTokens.authTokens;
  res.send(authTokens);
});

export const sendVerificationEmail = catchAsync(async (req: Request, res: Response) => {
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(req.user);
  await emailService.sendVerificationEmail(req.user.email, verifyEmailToken, req.user.name ?? '');
  res.status(httpStatus.NO_CONTENT).send();
});

export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  await authService.verifyEmail(req.query['token']);
  res.status(httpStatus.NO_CONTENT).send();
});

export const getNonce = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const nonce = await authService.generateNonce(email);
  res.send({ nonce });
});

export const loginChallenge = catchAsync(async (req: Request, res: Response) => {
  const { email, signature } = req.body;
  const verifiedUser = await authService.verifyChallenge(email, signature);
  const authTokens = await tokenService.generateAuthTokens(verifiedUser as IUserDoc);
  res.send(authTokens);
});
