import { describe, it, expect } from "vitest";
import { computeInputHash } from "./Kit";

describe("computeInputHash", () => {
  it("produces the same hash for identical inputs", () => {
    const a = computeInputHash("Some JD text", "https://example.com", 5);
    const b = computeInputHash("Some JD text", "https://example.com", 5);
    expect(a).toBe(b);
  });

  it("treats a trailing slash on the company URL as the same input", () => {
    const a = computeInputHash("Some JD text", "https://example.com", 5);
    const b = computeInputHash("Some JD text", "https://example.com/", 5);
    expect(a).toBe(b);
  });

  it("treats different casing on the company URL as the same input", () => {
    const a = computeInputHash("Some JD text", "https://Example.com", 5);
    const b = computeInputHash("Some JD text", "https://example.com", 5);
    expect(a).toBe(b);
  });

  it("produces a different hash when the days value changes", () => {
    const a = computeInputHash("Some JD text", "https://example.com", 5);
    const b = computeInputHash("Some JD text", "https://example.com", 10);
    expect(a).not.toBe(b);
  });

  it("produces a different hash when the JD text changes", () => {
    const a = computeInputHash("JD one", "https://example.com", 5);
    const b = computeInputHash("JD two", "https://example.com", 5);
    expect(a).not.toBe(b);
  });
});
