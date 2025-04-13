import mongoose, { Document, Model } from 'mongoose';

export interface INonce {
  email: string;
  nonce: string;
  expiresAt: Date;
}

export interface INonceDoc extends INonce, Document {
  _id: mongoose.Types.ObjectId;
}

export interface INonceModel extends Model<INonceDoc> {
  isEmailTaken(email: string, excludeNonceId?: mongoose.Types.ObjectId): Promise<boolean>;
}
