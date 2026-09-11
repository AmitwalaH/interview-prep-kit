import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import authRoutes from "./routes/auth";
import kitRoutes from "./routes/kits";
import kitBuilderRoutes from "./routes/kitBuilder";

const app = express();

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (isProduction && !SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set in production");
}

app.use(
  session({
    name: "connect.sid",
    secret: SESSION_SECRET || "dev-only-insecure-secret",
    resave: false,
    saveUninitialized: false,
    store: MONGODB_URI
      ? MongoStore.create({ mongoUrl: MONGODB_URI, ttl: 60 * 60 * 24 * 7 }) // 7 days
      : undefined, // falls back to in-memory store, fine for local dev only
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days idle expiry
    },
  }),
);

if (!MONGODB_URI) {
  console.warn(
    "MONGODB_URI not set, sessions are in-memory only (fine for local dev, not for production)",
  );
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    mongoConnected: mongoose.connection.readyState === 1,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/kits", kitRoutes);
app.use("/api/kits", kitBuilderRoutes);

const PORT = process.env.PORT || 4000;

async function start() {
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log("Connected to MongoDB");
    } catch (err) {
      console.error(
        "Failed to connect to MongoDB, server will still start, but persistence is unavailable:",
        (err as Error).message,
      );
    }
  } else {
    console.warn("MONGODB_URI not set, running without persistence");
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
