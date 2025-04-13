import { IGuardian, IWallet, IKeyBundle } from '../wallet.interfaces';

export interface Key {
  create: (
    userId: string,
    email: string,
    associatedGuardians: IGuardian[],
    ownerGuardianId: string,
    clientE2ePublicKey: string,
    keyBundle: IKeyBundle
  ) => Promise<IWallet>;
  sign: (
    email: string,
    wallet: IWallet,
    clientE2ePublicKey: string,
    keyBundle: IKeyBundle,
    message: string,
    isTransferTx?: boolean
  ) => Promise<ISignatureResponse>;
  verify: (address: string, messageSerialized: string, signature: string) => boolean;
  recover: (email: string) => boolean;
}

export interface ISignatureResponse {
  signature: string;
  signedResponse: { r: string; s: string; v: number };
}
