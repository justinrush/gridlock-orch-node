import { Model, Document } from 'mongoose';

export interface IGuardian {
  name: string;
  type: 'owner' | 'social' | 'local' | 'cloud' | 'gridlock' | 'partner';
  nodeId: string;
  networkingPublicKey: string;
  active: boolean;
  modified: string;
  e2ePublicKey: string;
}
export type IGuardianIndexed = IGuardian & { index: number };

export interface IWallet {
  userId: string;
  email: string;
  keyId: string;
  network: 'main' | 'ropsten' | 'rinkeby';
  address: string;
  pubKey: string;
  blockchain: 'ethereum' | 'solana';
  associatedGuardians: IGuardianIndexed[];
}

export interface IWalletDoc extends IWallet, Document {}

export interface IWalletModel extends Model<IWalletDoc> {
  isExistingWallet(keyId: string, blockchain: string): Promise<boolean>;
}

export type UpdateWalletBody = Partial<IWallet>;

export type NewRegisteredWallet = IWallet;

export type NewCreatedWallet = IWallet;

export interface INodeAccessKey {
  nodeId: string;
  timestamp: string;
  encryptedNodeKey: string;
  messageHMAC: string;
}

export interface IKeyBundle {
  nodes: INodeAccessKey[];
}
