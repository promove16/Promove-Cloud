import { HydratedDocument, Schema, Types, model } from 'mongoose';

export interface IProfileView {
  _id: Types.ObjectId;
  viewerId: Types.ObjectId;
  viewedId: Types.ObjectId;
  viewerRole: string;
  viewedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const profileViewSchema = new Schema<IProfileView>(
  {
    viewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    viewedId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    viewerRole: {
      type: String,
      required: true,
      trim: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

profileViewSchema.index({ viewedId: 1, viewedAt: -1 });
profileViewSchema.index({ viewerId: 1, viewedId: 1, viewedAt: -1 });
profileViewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export type ProfileViewDocument = HydratedDocument<IProfileView>;
export const ProfileView = model<IProfileView>('ProfileView', profileViewSchema);
