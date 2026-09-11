import { Router } from "express";
import { register, login } from "../controllers/auth.controller";
import { validateBody, registerSchema, loginSchema } from "../utils/validation";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);

export default router;
