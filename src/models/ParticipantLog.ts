import { Schema, model, Document, Types } from "mongoose";

// The "Room History" collection the assignment asks for — Room.participants
// only holds who is in the room *right now*; this is the durable record of
// every join/leave, kept even after a user leaves or the room ends.
export interface IParticipantLog extends Document {
  room: Types.ObjectId;
  user: Types.ObjectId;
  joinedAt: Date;
  leftAt?: Date;
}

const participantLogSchema = new Schema<IParticipantLog>({
  room: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
});

export const ParticipantLog = model<IParticipantLog>("ParticipantLog", participantLogSchema);
