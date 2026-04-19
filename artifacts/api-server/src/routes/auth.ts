import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, walletsTable, investmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, signToken, type AuthRequest } from "../middlewares/auth";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import crypto from "crypto";

const router = Router();

function generateReferralCode(): string {
  return "QX" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isAdmin: user.isAdmin,
    referralCode: user.referralCode,
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res) => {
  const result = RegisterBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }

  const { email, password, fullName, referralCode: sponsorCode } = result.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  let sponsorId: number | undefined;
  if (sponsorCode) {
    const sponsor = await db.select().from(usersTable).where(eq(usersTable.referralCode, sponsorCode)).limit(1);
    if (sponsor.length > 0) {
      sponsorId = sponsor[0]!.id;
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const referralCode = generateReferralCode();

  const [newUser] = await db.insert(usersTable).values({
    email,
    passwordHash,
    fullName,
    isAdmin: false,
    referralCode,
    sponsorId: sponsorId ?? 0,
  }).returning();

  if (!newUser) {
    res.status(500).json({ error: "Failed to create user" });
    return;
  }

  await db.insert(walletsTable).values({ userId: newUser.id });
  await db.insert(investmentsTable).values({ userId: newUser.id });

  const token = signToken(newUser.id, newUser.isAdmin);
  res.status(201).json({ token, user: formatUser(newUser) });
});

router.post("/auth/login", async (req, res) => {
  const result = LoginBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }

  const { email, password } = result.data;
  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (users.length === 0) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const user = users[0]!;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken(user.id, user.isAdmin);
  res.json({ token, user: formatUser(user) });
});

router.get("/auth/me", authMiddleware, async (req: AuthRequest, res) => {
  const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (users.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(formatUser(users[0]!));
});

export default router;
