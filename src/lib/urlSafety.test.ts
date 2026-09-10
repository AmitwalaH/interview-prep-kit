import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertSafeUrl, UnsafeUrlError } from "./urlSafety";

const originalEnv = process.env.NODE_ENV;

describe("assertSafeUrl", () => {
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("rejects non-http(s) protocols regardless of environment", async () => {
    process.env.NODE_ENV = "production";
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toThrow(
      UnsafeUrlError,
    );
    await expect(assertSafeUrl("ftp://example.com")).rejects.toThrow(
      UnsafeUrlError,
    );
  });

  it("rejects an unparseable URL", async () => {
    await expect(assertSafeUrl("not a url")).rejects.toThrow(UnsafeUrlError);
  });

  describe("in production", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("rejects a loopback IP literal", async () => {
      await expect(assertSafeUrl("http://127.0.0.1/")).rejects.toThrow(
        UnsafeUrlError,
      );
    });

    it("rejects a private 10.x IP literal", async () => {
      await expect(assertSafeUrl("http://10.1.2.3/")).rejects.toThrow(
        UnsafeUrlError,
      );
    });

    it("rejects a private 192.168.x IP literal", async () => {
      await expect(assertSafeUrl("http://192.168.1.1/")).rejects.toThrow(
        UnsafeUrlError,
      );
    });

    it("accepts a public IP literal", async () => {
      const url = await assertSafeUrl("http://8.8.8.8/");
      expect(url.hostname).toBe("8.8.8.8");
    });
  });

  describe("outside production", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "test";
    });

    it("allows localhost, since the batch CLI must crawl locally-served test sites", async () => {
      const url = await assertSafeUrl("http://localhost:8099/acme/");
      expect(url.hostname).toBe("localhost");
    });

    it("allows a private IP literal", async () => {
      const url = await assertSafeUrl("http://127.0.0.1:3000/");
      expect(url.hostname).toBe("127.0.0.1");
    });
  });
});
