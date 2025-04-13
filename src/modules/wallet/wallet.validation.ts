import Joi from 'joi';
import { objectId } from '../validate/custom.validation';

const userObject = {
  name: Joi.string(),
  email: Joi.string().required().email(),
  role: Joi.string().required().valid('user', 'admin'),
  isEmailVerified: Joi.boolean().required(),
  ownerGuardianId: Joi.string().required(),
  identityPublicKey: Joi.string().required(),
  e2ePublicKey: Joi.string().required(),
  nodePool: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        type: Joi.string().required(),
        nodeId: Joi.string().required(),
        networkingPublicKey: Joi.string().required(),
        active: Joi.boolean().required(),
        e2ePublicKey: Joi.string().required(),
      })
    )
    .required(),
};

const keyBundleObject = {
  nodes: Joi.array()
    .items(
      Joi.object({
        nodeId: Joi.string().required(),
        timestamp: Joi.string().required(),
        encryptedNodeKey: Joi.string().required(),
        messageHMAC: Joi.string().required(),
      })
    )
    .required(),
};

const createWalletBody = {
  user: Joi.object().keys(userObject).required(),
  blockchain: Joi.string().valid('ethereum', 'solana').required(),
  clientE2ePublicKey: Joi.string().required(),
  keyBundle: Joi.object().keys(keyBundleObject).required(),
};

export const createWallet = {
  body: Joi.object().keys(createWalletBody),
};

export const getWallets = {
  query: Joi.object().keys({
    name: Joi.string(),
  }),
};

export const getWallet = {
  params: Joi.object().keys({
    walletId: Joi.string().custom(objectId),
  }),
};

const walletObject = {
  userId: Joi.string().required(),
  keyId: Joi.string().required(),
  network: Joi.string().valid('main', 'ropsten', 'rinkeby').required(),
  address: Joi.string().required(),
  pubKey: Joi.string().required(),
  blockchain: Joi.string().valid('ethereum', 'solana').required(),
  associatedGuardians: Joi.array()
    .items(
      Joi.object({
        index: Joi.number().required(),
        name: Joi.string().required(),
        type: Joi.string().valid('owner', 'social', 'local', 'cloud', 'gridlock', 'partner').required(),
        nodeId: Joi.string().required(),
        networkingPublicKey: Joi.string().required(),
        active: Joi.boolean().required(),
        modified: Joi.string().allow('').optional(),
      })
    )
    .required(),
};

export const verify = {
  body: Joi.object()
    .keys({
      signature: Joi.string().required(),
      message: Joi.string().required(),
      wallet: Joi.object().keys(walletObject).required(),
    })
    .min(1),
};

export const updateWallet = {
  params: Joi.object().keys({
    walletId: Joi.required().custom(objectId),
  }),
  body: Joi.object().keys({}).min(1),
};

export const deleteWallet = {
  params: Joi.object().keys({
    walletId: Joi.string().custom(objectId),
  }),
};

const signTransactionBody = {
  user: Joi.object().keys(userObject).required(),
  wallet: Joi.object().keys(walletObject).required(),
  message: Joi.string().required(),
  clientE2ePublicKey: Joi.string().required(),
  keyBundle: Joi.object().keys(keyBundleObject).required(),
  email: Joi.string().email(),
};

export const signTransaction = {
  body: Joi.object().keys(signTransactionBody),
};

export const keyshareRecovery = {
  body: Joi.object().keys({
    user: Joi.object().keys(userObject).required(),
    // clientE2ePublicKey: Joi.string().required(),
    keyBundle: Joi.object().keys(keyBundleObject).required(),
  }),
};

export const checkPaillier = {
  body: Joi.object().keys({
    wallet: Joi.object().keys(walletObject).required(),
    clientE2ePublicKey: Joi.string().required(),
    keyBundle: Joi.object().keys(keyBundleObject).required(),
  }),
};
