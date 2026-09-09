import mongoose, { Schema, Document } from "mongoose";

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  createdAt: Date;
}

const userSchema = new Schema<UserDocument>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const UserModel = mongoose.model<UserDocument>("User", userSchema);
