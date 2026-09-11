import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import roomRoutes from "./room.routes";
import livekitRoutes from "./livekit.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/rooms", roomRoutes);
router.use("/livekit", livekitRoutes);

export default router;
