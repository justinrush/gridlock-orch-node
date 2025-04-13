import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import { IWalletDoc, IWalletModel } from './wallet.interfaces';

const walletSchema = new mongoose.Schema<IWalletDoc, IWalletModel>(
  {
    userId: { type: String },
    keyId: { type: String },
    network: {
      type: String,
      enum: ['main', 'ropsten', 'rinkeby'],
      default: 'main',
    },
    address: { type: String },
    pubKey: { type: String },
    blockchain: {
      type: String,
      enum: ['ethereum', 'solana'],
      required: true,
    },
    associatedGuardians: [
      {
        name: { type: String },
        type: {
          type: String,
          enum: ['gridlock', 'user', 'owner', 'partner', 'social', 'local', 'cloud'],
          default: 'gridlockGuardian',
        },
        nodeId: { type: String },
        networkingPublicKey: { type: String },
        index: { type: Number },
        active: { type: Boolean, default: true },
        modified: { type: String, default: '' },
      },
    ],
  },
  {
    timestamps: true,
  }
);

walletSchema.plugin(toJSON);
walletSchema.static('isExistingWallet', async function (keyId: string, blockchain: string): Promise<boolean> {
  const user = await this.findOne({ keyId, blockchain });
  return !!user;
});
const Wallet = mongoose.model<IWalletDoc, IWalletModel>('Wallet', walletSchema);

export default Wallet;
