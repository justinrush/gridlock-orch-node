import mongoose, { Schema } from 'mongoose';
import { INonceDoc, INonceModel } from './nonce.interfaces';

const nonceSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    nonce: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

nonceSchema.index({ email: 1 }, { unique: true });

nonceSchema.static(
  'isEmailTaken',
  async function (email: string, excludeNonceId?: mongoose.Types.ObjectId): Promise<boolean> {
    const nonce = await this.findOne({ email, _id: { $ne: excludeNonceId } });
    return !!nonce;
  }
);

const Nonce = mongoose.model<INonceDoc, INonceModel>('Nonce', nonceSchema);

export default Nonce;
