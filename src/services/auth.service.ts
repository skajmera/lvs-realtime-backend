import bcrypt from "bcryptjs";
import { User, IUser } from "../models/User";
import { signToken } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";

const SALT_ROUNDS = 10;

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  profileImage?: string;
}

export async function registerUser(input: RegisterInput): Promise<{ user: IUser; token: string }> {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const hashed = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await User.create({
    name: input.name,
    email: input.email.toLowerCase(),
    password: hashed,
    profileImage: input.profileImage,
  });

  const token = signToken({ userId: user._id.toString() });
  return { user, token };
}

export async function loginUser(email: string, password: string): Promise<{ user: IUser; token: string }> {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) {
    throw new ApiError(401, "Invalid email or password");
  }

  user.isOnline = true;
  user.lastSeenAt = new Date();
  await user.save();

  const token = signToken({ userId: user._id.toString() });
  return { user, token };
}

export async function getUserById(userId: string): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return user;
}
