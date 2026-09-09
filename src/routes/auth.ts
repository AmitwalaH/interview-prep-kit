import { Router } from "express";
import bcrypt from "bcryptjs";
import { UserModel } from "../models/User";
import { CredentialsSchema } from "../lib/authValidation";
import { requireAuth } from "./requireAuth";
import { asyncHandler } from "./asyncHandler";

const router = Router();
const SALT_ROUNDS = 10;

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = CredentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: parsed.error.issues.map((i) => i.message).join("; "),
        },
      });
    }
    const { email, password } = parsed.data;

    const existing = await UserModel.findOne({ email });
    if (existing) {
      // Deliberately vague: don't confirm to an attacker which emails are
      // already registered.
      return res.status(409).json({
        error: {
          code: "REGISTRATION_FAILED",
          message: "Could not register with these details",
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await UserModel.create({ email, passwordHash });

    // Regenerate the session on privilege change (anonymous -> authenticated)
    // to avoid session fixation, then set the identity.
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({
          error: {
            code: "SESSION_ERROR",
            message: "Could not start session",
          },
        });
      }
      req.session.userId = String(user._id);
      res.status(201).json({ id: user._id, email: user.email });
    });
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = CredentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "Email and password are required",
        },
      });
    }
    const { email, password } = parsed.data;

    const user = await UserModel.findOne({ email });
    const genericFailure = () =>
      res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Incorrect email or password",
        },
      });

    if (!user) return genericFailure();

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return genericFailure();

    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({
          error: {
            code: "SESSION_ERROR",
            message: "Could not start session",
          },
        });
      }
      req.session.userId = String(user._id);
      res.json({ id: user._id, email: user.email });
    });
  }),
);

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        error: { code: "SESSION_ERROR", message: "Could not end session" },
      });
    }
    res.clearCookie("connect.sid");
    res.status(204).send();
  });
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await UserModel.findById(req.session.userId);
    if (!user) {
      // Session points at a user that no longer exists, treat as an
      // invalid session rather than a server error.
      return res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Sign in required" },
      });
    }
    res.json({ id: user._id, email: user.email });
  }),
);

export default router;
