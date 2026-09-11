import { Router } from "express";
import { getToken } from "../controllers/livekit.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { validateBody, livekitTokenSchema } from "../utils/validation";

const router = Router();

router.post("/token", requireAuth, validateBody(livekitTokenSchema), getToken);

export default router;
