import { Schema, model, Document, Types } from "mongoose";

export type RoomStatus = "active" | "ended";

export interface IRoom extends Document {
  _id: Types.ObjectId;
  name: string;
  host: Types.ObjectId;
  participants: Types.ObjectId[]; // currently-in-room users; history survives in ParticipantLog
  status: RoomStatus;
  createdAt: Date;
  endedAt?: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    name: { type: String, required: true, trim: true },
    host: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["active", "ended"], default: "active", index: true },
    endedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

// Listing active rooms is the hot read path (GET /rooms) — this index
// backs it directly instead of a full collection scan.
roomSchema.index({ status: 1, createdAt: -1 });

roomSchema.virtual("participantCount").get(function (this: IRoom) {
  return this.participants.length;
});

roomSchema.set("toJSON", { virtuals: true });
roomSchema.set("toObject", { virtuals: true });

export const Room = model<IRoom>("Room", roomSchema);
