import { describe, it, expect } from "vitest";
import { CredentialsSchema } from "./authValidation";

describe("CredentialsSchema", () => {
  it("accepts a well-formed email and adequate password", () => {
    const result = CredentialsSchema.safeParse({
      email: "a@example.com",
      password: "correcthorse",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = CredentialsSchema.safeParse({
      email: "not-an-email",
      password: "correcthorse",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = CredentialsSchema.safeParse({
      email: "a@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password longer than bcrypt's 72-byte input limit", () => {
    const result = CredentialsSchema.safeParse({
      email: "a@example.com",
      password: "x".repeat(73),
    });
    expect(result.success).toBe(false);
  });

  it("trims and lowercases nothing implicitly for password, but trims email", () => {
    const result = CredentialsSchema.safeParse({
      email: "  a@example.com  ",
      password: "correcthorse",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("a@example.com");
  });
});
