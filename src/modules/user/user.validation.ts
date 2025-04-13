import Joi from 'joi';
import { objectId } from '../validate/custom.validation';
import { NewCreatedUser } from './user.interfaces';
import { IGuardian } from '../wallet/wallet.interfaces';

const createUserBody: Record<keyof NewCreatedUser, any> = {
  email: Joi.string().required().email(),
  name: Joi.string(),
  role: Joi.string().required().valid('user', 'admin'),
  ownerGuardianId: Joi.string().required(),
  identityPublicKey: Joi.string().required(),
  e2ePublicKey: Joi.string().required(),
};

const guardianBody: Record<keyof IGuardian, any> = {
  name: Joi.string().required(),
  type: Joi.string().valid('owner', 'social', 'local', 'cloud', 'gridlock', 'partner').required(),
  nodeId: Joi.string().required(),
  networkingPublicKey: Joi.string().required(),
  active: Joi.boolean().default(true),
  modified: Joi.string().default(''),
  e2ePublicKey: Joi.string().required(),
};

// const userBody: Record<keyof IUser, any> = {
//   email: Joi.string().required().email(),
//   name: Joi.string(),
//   role: Joi.string().required().valid('user', 'admin'),
//   isEmailVerified: Joi.boolean().required(),
//   ownerGuardianId: Joi.string().required(),
//   nodePool: Joi.array().items(Joi.object().keys(guardianBody)),
// };

export const createUser = {
  body: Joi.object().keys(createUserBody),
};

export const addCustomGuardian = {
  body: Joi.object().keys({
    guardian: Joi.object().keys(guardianBody).required(),
    isOwnerGuardian: Joi.boolean().default(false),
  }),
};

export const addGridlockGuardian = {
  email: Joi.string().required().email(),
};

export const addPartnerGuardian = {
  email: Joi.string().required().email(),
};

export const getUsers = {
  query: Joi.object().keys({
    name: Joi.string(),
    role: Joi.string(),
    sortBy: Joi.string(),
    projectBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

export const getUser = {
  params: Joi.object().keys({
    email: Joi.string().email().required(),
  }),
};

export const updateUser = {
  params: Joi.object().keys({
    userId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email(),
      name: Joi.string(),
    })
    .min(1),
};

export const deleteUser = {
  params: Joi.object().keys({
    email: Joi.string().email().required(),
  }),
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

export const recoverUser = {
  email: Joi.string().required().email(),
  clientE2ePublicKey: Joi.string().required(),
  keyBundle: Joi.object().keys(keyBundleObject).required(),
};

export const confirmRecovery = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    clientE2ePublicKey: Joi.string().required(),
    encryptedRecoveryConfirmation: Joi.string().required(),
    keyBundle: Joi.object().keys(keyBundleObject).required(),
  }),
};

export const transferUser = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    keyBundle: Joi.object().keys(keyBundleObject).required(),
    clientE2ePublicKey: Joi.string().required(),
    clientIdentityPublicKey: Joi.string().required(),
  }),
};
