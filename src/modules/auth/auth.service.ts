import crypto from 'crypto';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Token from '../token/token.model';
import ApiError from '../errors/ApiError';
import tokenTypes from '../token/token.types';
import { getUserByEmail, getUserById, updateUserById } from '../user/user.service';
import { IUserDoc, IUserWithTokens } from '../user/user.interfaces';
import { generateAuthTokens, verifyToken } from '../token/token.service';
import Nonce from '../nonce/nonce.model';
import nacl from 'tweetnacl';

export const loginUserWithEmailAndPassword = async (email: string, password: string): Promise<IUserDoc> => {
  const user = await getUserByEmail(email);
  if (!user || !(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  return user;
};

export const logout = async (refreshToken: string): Promise<void> => {
  const refreshTokenDoc = await Token.findOne({ token: refreshToken, type: tokenTypes.REFRESH, blacklisted: false });
  if (!refreshTokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  await refreshTokenDoc.deleteOne();
};

export const refreshAuth = async (refreshToken: string): Promise<IUserWithTokens> => {
  try {
    const refreshTokenDoc = await verifyToken(refreshToken, tokenTypes.REFRESH);
    const user = await getUserById(new mongoose.Types.ObjectId(refreshTokenDoc.user));
    if (!user) {
      throw new Error();
    }
    await refreshTokenDoc.deleteOne();
    const authTokens = await generateAuthTokens(user);
    return { user, authTokens };
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

export const verifyEmail = async (verifyEmailToken: any): Promise<IUserDoc | null> => {
  try {
    const verifyEmailTokenDoc = await verifyToken(verifyEmailToken, tokenTypes.VERIFY_EMAIL);
    const user = await getUserById(new mongoose.Types.ObjectId(verifyEmailTokenDoc.user));
    if (!user) {
      throw new Error();
    }
    await Token.deleteMany({ user: user.id, type: tokenTypes.VERIFY_EMAIL });
    const updatedUser = await updateUserById(user.id, { isEmailVerified: true });
    return updatedUser;
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Email verification failed');
  }
};

export const generateNonce = async (email: string): Promise<string> => {
  try {
    const nonce = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration
    await Nonce.updateOne({ email }, { nonce, expiresAt }, { upsert: true });
    return nonce;
  } catch (error) {
    const errorMessage = (error as Error).message;
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to generate nonce: ${errorMessage}`);
  }
};

export const verifyChallenge = async (email: string, signature: string): Promise<IUserDoc | null> => {
  //obtain the stored nonce
  const nonceDoc = await Nonce.findOne({ email }).sort({ createdAt: -1 });
  if (!nonceDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Nonce not found');
  }
  if (nonceDoc.expiresAt < new Date()) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Nonce expired');
  }

  //obtain the user's identity
  const user = await getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  const identityKey = user.identityPublicKey;

  if (!identityKey) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User identity key not found');
  }

  const identityKeyBuffer = Buffer.from(identityKey, 'base64');
  const isValid = nacl.sign.detached.verify(
    Buffer.from(nonceDoc.nonce, 'hex'),
    Buffer.from(signature, 'base64'),
    identityKeyBuffer
  );
  if (!isValid) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid signature');
  }
  return user;
};
