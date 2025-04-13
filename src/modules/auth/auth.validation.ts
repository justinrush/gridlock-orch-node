import Joi from 'joi';
import { NewRegisteredUser } from '../user/user.interfaces';

const registerBody: Record<keyof NewRegisteredUser, any> = {
  name: Joi.string(),
  email: Joi.string().required().email(),
  identityPublicKey: Joi.string(),
  e2ePublicKey: Joi.string(),
};

export const register = {
  body: Joi.object().keys(registerBody),
};

export const login = {
  body: Joi.object().keys({
    email: Joi.string().required(),
    password: Joi.string().required(),
  }),
};

export const logout = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required(),
  }),
};

export const refreshTokens = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required(),
  }),
};

export const verifyEmail = {
  query: Joi.object().keys({
    token: Joi.string().required(),
  }),
};

export const nonce = {
  body: Joi.object().keys({
    email: Joi.string().required(),
  }),
};

export const loginChallenge = {
  body: Joi.object().keys({
    email: Joi.string().required(),
    signature: Joi.string().required(),
  }),
};
