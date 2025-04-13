import mongoose, { Model, Document } from 'mongoose';
import { AccessAndRefreshTokens } from '../token/token.interfaces';
import { IGuardian } from '../wallet/wallet.interfaces';

export interface IUser {
  email: string;
  name?: string;
  role: string;
  isEmailVerified: boolean;
  ownerGuardianId: string;
  nodePool: IGuardian[];
  identityPublicKey: string;
  e2ePublicKey: string;
}

export interface IUserDoc extends IUser, Document {
  isPasswordMatch(password: string): Promise<boolean>;
}

export interface IUserModel extends Model<IUserDoc> {
  isEmailTaken(email: string, excludeUserId?: mongoose.Types.ObjectId): Promise<boolean>;
  isNodeIdTaken(nodeId: string, excludeUserId?: mongoose.Types.ObjectId): Promise<boolean>;
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<IUserDoc[]>;
}

export type UpdateUserBody = Partial<IUser>;

export type NewRegisteredUser = Omit<IUser, 'role' | 'isEmailVerified' | 'nodePool' | 'ownerGuardianId'>;

export type NewCreatedUser = Omit<IUser, 'isEmailVerified' | 'nodePool'>;

export interface IUserWithTokens {
  user: IUserDoc;
  authTokens: AccessAndRefreshTokens;
}
