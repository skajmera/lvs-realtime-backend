import { Router } from "express";
import { create, list, getOne, join, leave } from "../controllers/room.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { validateBody, createRoomSchema } from "../utils/validation";

const router = Router();

router.use(requireAuth); // every room endpoint requires a signed-in user

router.post("/", validateBody(createRoomSchema), create);
router.get("/", list);
router.get("/:id", getOne);
router.post("/:id/join", join);
router.post("/:id/leave", leave);

export default router;
