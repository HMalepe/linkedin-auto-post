import { describe, expect, it } from "vitest";
import { basicAuthOk, bearerOk, isCrossSiteWrite, safeEqual } from "@/lib/auth";

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

describe("safeEqual", () => {
  it("compares strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("basicAuthOk", () => {
  const enc = (s: string) => "Basic " + btoa(s);
  it("accepts any username with the right password", () => {
    expect(basicAuthOk(enc("anyone:secret"), "secret")).toBe(true);
    expect(basicAuthOk(enc(":secret"), "secret")).toBe(true);
    expect(basicAuthOk(enc("me:pass:with:colons"), "pass:with:colons")).toBe(true);
  });
  it("rejects wrong or malformed credentials", () => {
    expect(basicAuthOk(enc("me:nope"), "secret")).toBe(false);
    expect(basicAuthOk("Basic !!!", "secret")).toBe(false);
    expect(basicAuthOk(null, "secret")).toBe(false);
    expect(basicAuthOk("Bearer secret", "secret")).toBe(false);
  });
});

describe("bearerOk", () => {
  it("requires a configured secret", () => {
    expect(bearerOk("Bearer x", "x")).toBe(true);
    expect(bearerOk("Bearer ", "")).toBe(false);
    expect(bearerOk("Bearer undefined", undefined)).toBe(false);
  });
});

describe("isCrossSiteWrite", () => {
  const req = (method: string, h: Record<string, string>) => ({ method, headers: headers(h), host: "app.example.com" });
  it("allows reads and same-origin writes", () => {
    expect(isCrossSiteWrite(req("GET", { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isCrossSiteWrite(req("POST", { "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(isCrossSiteWrite(req("POST", { origin: "https://app.example.com" }))).toBe(false);
    expect(isCrossSiteWrite(req("POST", {}))).toBe(false);
  });
  it("blocks cross-site writes", () => {
    expect(isCrossSiteWrite(req("POST", { "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSiteWrite(req("DELETE", { "sec-fetch-site": "same-site" }))).toBe(true);
    expect(isCrossSiteWrite(req("PATCH", { origin: "https://evil.example" }))).toBe(true);
  });
});
