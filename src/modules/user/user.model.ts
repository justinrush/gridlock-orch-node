import mongoose from 'mongoose';
import validator from 'validator';
import toJSON from '../toJSON/toJSON';
import { roles } from '../../config/roles';
import { IUserDoc, IUserModel } from './user.interfaces';

const userSchema = new mongoose.Schema<IUserDoc, IUserModel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value: string) {
        if (!validator.isEmail(value)) {
          throw new Error('Invalid email');
        }
      },
    },
    role: {
      type: String,
      enum: roles,
      default: 'user',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    ownerGuardianId: {
      type: String,
      required: false,
    },
    nodePool: [
      {
        name: { type: String },
        type: {
          type: String,
          enum: ['owner', 'social', 'local', 'cloud', 'gridlock', 'partner', 'user'],
          default: 'unknownGuardian',
        },
        nodeId: { type: String },
        networkingPublicKey: { type: String },
        e2ePublicKey: { type: String },
        active: { type: Boolean, default: false },
        code: { type: String },
      },
    ],
    identityPublicKey: {
      type: String,
      required: true,
    },
    e2ePublicKey: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.plugin(toJSON);

userSchema.static('isEmailTaken', async function (email: string, excludeUserId: mongoose.ObjectId): Promise<boolean> {
  const user = await this.findOne({ email, _id: { $ne: excludeUserId } });
  return !!user;
});

userSchema.static('isNodeIdTaken', async function (nodeId: string, excludeUserId: mongoose.ObjectId): Promise<boolean> {
  const user = await this.findOne({ nodeId, _id: { $ne: excludeUserId } });
  return !!user;
});

// Remove isPasswordMatch method
// userSchema.method('isPasswordMatch', async function (password: string): Promise<boolean> {
//   const user = this;
//   return bcrypt.compare(password, user.password);
// });

// Remove pre-save hook for password hashing
// userSchema.pre('save', async function (next) {
//   const user = this;
//   if (user.isModified('password')) {
//     user.password = await bcrypt.hash(user.password, 8);
//   }
//   next();
// });

const User = mongoose.model<IUserDoc, IUserModel>('User', userSchema);

export default User;
