import httpStatus from 'http-status';
import mongoose from 'mongoose';
import User from './user.model';
import ApiError from '../errors/ApiError';
import { NewCreatedUser, UpdateUserBody, IUserDoc, NewRegisteredUser } from './user.interfaces';
import { IGuardian, IKeyBundle, IWalletDoc } from '../wallet/wallet.interfaces';
import { natsService } from '../nats';
import { gridlockGuardians } from '../../config/guardians';
import { getWalletByUserId } from '../wallet/wallet.service';
import { partnerGuardians } from '../../config/guardians';
import eddsa from '../wallet/keys/eddsa';
import Wallet from '../wallet/wallet.model';
import { cleanMongo } from '../utils/cleanMongo';
import ecdsa from '../wallet/keys/ecdsa';

export const createUser = async (userBody: NewCreatedUser): Promise<IUserDoc> => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot create user, email already taken');
  }
  return User.create(userBody);
};

/**
 * Registers a new user.
 *
 * @param {NewRegisteredUser} userBody - The user details for registration.
 * @returns {Promise<IUserDoc>} The created user document.
 * @throws {ApiError} If the email is already taken.
 */
export const registerUser = async (userBody: NewRegisteredUser): Promise<IUserDoc> => {
  const existingUser = await User.findOne({ email: userBody.email });
  if (existingUser) {
    if (existingUser.email.includes('piedpiper.com')) {
      console.log('Deleting user', existingUser.email);
      await existingUser.deleteOne();
    } else {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot register user, email already taken');
    }
  }
  return User.create(userBody);
};

export const getUserById = async (id: mongoose.Types.ObjectId): Promise<IUserDoc | null> => User.findById(id);

export const getUserByEmail = async (email: string): Promise<IUserDoc | null> => User.findOne({ email });

export const addCustomGuardian = async (
  userId: mongoose.Types.ObjectId,
  guardian: IGuardian,
  isOwnerGuardian: boolean
): Promise<IUserDoc> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  const g = user.nodePool.find((node) => node.nodeId === guardian.nodeId);
  if (g) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Guardian already exists');
  }
  const nodePool = [...user.nodePool, guardian];
  Object.assign(user, { nodePool });

  if (isOwnerGuardian) {
    user.ownerGuardianId = guardian.nodeId;
  }

  await user.save();
  return user;
};
export const queryUsers = async (filter: Record<string, any>, options: any): Promise<IUserDoc[]> => {
  const users = await User.find(filter, options);
  return users;
};
export const updateUserById = async (
  userId: mongoose.Types.ObjectId,
  updateBody: UpdateUserBody
): Promise<IUserDoc | null> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  Object.assign(user, updateBody);
  await user.save();
  return user;
};
export const deleteUserById = async (userId: mongoose.Types.ObjectId): Promise<IUserDoc | null> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await user.deleteOne();
  return user;
};

export const addGridlockGuardian = async (
  userId: mongoose.Types.ObjectId
): Promise<{ user: IUserDoc; guardian: IGuardian }> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const randomSortedGG = gridlockGuardians
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);

  const guardian = randomSortedGG.find((node) => !user.nodePool.find((n) => node.nodeId === n.nodeId));

  if (!guardian) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No more guardians available');
  }

  user.nodePool.push(guardian);
  await user.save();

  return { user, guardian };
};

export const addPartnerGuardian = async (
  userId: mongoose.Types.ObjectId
): Promise<{ user: IUserDoc; guardian: IGuardian }> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const randomSortedPG = partnerGuardians
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);

  const guardian = randomSortedPG.find((node) => !user.nodePool.find((n) => node.nodeId === n.nodeId));

  if (!guardian) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No more guardians available');
  }

  user.nodePool.push(guardian);
  await user.save();

  return { user, guardian };
};

export const recoverUserInitiation = async (
  email: string,
  clientE2ePublicKey: string,
  keyBundle: IKeyBundle
): Promise<{ guardians: IGuardian[] }> => {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const wallet = await getWalletByUserId(user._id.toString());
  if (!wallet) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Wallet not found');
  }

  keyBundle.nodes.forEach((node) => {
    const message = JSON.stringify({
      key_id: wallet.keyId,
      client_e2e_public_key: clientE2ePublicKey,
      encrypted_recovery_key: node.encryptedNodeKey,
      email: email,
      timestamp: node.timestamp,
      message_hmac: node.messageHMAC,
    });
    natsService.keyRecoverPublish(node.nodeId, message);
  });

  return { guardians: user.nodePool };
};

/**
 * Confirms a user recovery request by sending a recovery confirmation message to all nodes.
 *
 * @param {string} email - The user's email
 * @param {string} clientE2ePublicKey - The client's E2E public key
 * @param {string} encryptedRecoveryConfirmation - The encrypted recovery confirmation data
 * @param {IKeyBundle} keyBundle - The key bundle with encrypted keys for each node
 * @returns {Promise<{ user: IUserDoc; wallets: IWalletDoc[] }>} Success status
 */
export const confirmRecoverUser = async (
  email: string,
  clientE2ePublicKey: string,
  encryptedRecoveryConfirmation: string,
  keyBundle: IKeyBundle
): Promise<{ user: IUserDoc; wallets: IWalletDoc[] }> => {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  const wallet = await getWalletByUserId(user._id.toString());
  if (!wallet) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Wallet not found');
  }

  // Get all wallets for the user
  const wallets = await Wallet.find({ userId: user._id.toString() });

  user.nodePool.forEach((guardian: IGuardian) => {
    const nodeData = keyBundle.nodes.find((n) => n.nodeId === guardian.nodeId);
    const message = JSON.stringify({
      key_id: wallet.keyId,
      client_e2e_public_key: clientE2ePublicKey,
      encrypted_recovery_confirmation: encryptedRecoveryConfirmation,
      email: email,
      encrypted_signing_key: nodeData?.encryptedNodeKey,
      timestamp: nodeData?.timestamp,
      message_hmac: nodeData?.messageHMAC,
    });
    natsService.publishUserRecoveryConfirm(guardian.nodeId, message);
  });

  // Clean MongoDB documents before returning
  const cleanedUser = await cleanMongo(user);
  const cleanedWallets = await Promise.all(wallets.map((wallet) => cleanMongo(wallet)));

  return { user: cleanedUser, wallets: cleanedWallets };
};

/**
 * Transfer a user's wallet ownership using meta-transactions
 * This function creates an authorization message and calls the EdDSA signing process
 * with the isTransferTx flag set to true, so nodes can perform additional logic for ownership transfers.
 *
 * @param {string} email - The user's email
 * @param {IKeyBundle} keyBundle - The key bundle with encrypted keys for each node
 * @param {string} clientE2ePublicKey - The client's E2E public key to use for signing
 * @param {string} clientIdentityPublicKey - The client's identity public key for the new owner
 * @returns {Promise<boolean>} Success status
 */
export const transferUser = async (
  email: string,
  keyBundle: IKeyBundle,
  clientE2ePublicKey: string,
  clientIdentityPublicKey: string
): Promise<boolean> => {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Get all wallets for the user
  const wallets = await Wallet.find({ userId: user._id.toString() });

  // First look for an EDDSA wallet (Solana)
  let eddsaWallet = wallets.find((w) => w.blockchain === 'solana');

  // If no EDDSA wallet, fall back to ECDSA wallet (Ethereum)
  let ecdsaWallet = wallets.find((w) => w.blockchain === 'ethereum');

  // Determine which wallet to use
  const wallet = eddsaWallet || ecdsaWallet || null;

  if (!wallet) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No compatible wallet found');
  }

  // Create the authorization message using clientIdentityPublicKey instead of keyId
  const transferMessage = `Authorizing ownership transfer to ${clientIdentityPublicKey}`;

  // Sign using the appropriate method based on wallet type
  if (wallet.blockchain === 'solana') {
    console.debug('keyBundle', keyBundle);
    await eddsa.sign(email, wallet, clientE2ePublicKey, keyBundle, transferMessage, true);
  } else {
    await ecdsa.sign(email, wallet, clientE2ePublicKey, keyBundle, transferMessage);
  }

  user.identityPublicKey = clientIdentityPublicKey;
  await user.save();

  return true;
};
