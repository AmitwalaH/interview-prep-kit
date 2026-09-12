import { Request, Response, NextFunction } from "express";

/**
 * Guards any route that requires a signed-in user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Sign in required" },
    });
  }
  next();
}
