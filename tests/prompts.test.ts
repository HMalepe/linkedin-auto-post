import { describe, expect, it } from "vitest";
import { draftsPrompt, rewritePrompt, systemPrompt } from "@/lib/prompts";

describe("systemPrompt", () => {
  it("includes the voice, hashtag limit and the user's own rules", () => {
    const p = systemPrompt({ voice: "Pharmacist in Joburg", rules: "No emoji.", max_hashtags: 2 });
    expect(p).toContain("Pharmacist in Joburg");
    expect(p).toContain("At most 2 hashtags");
    expect(p).toContain("No emoji.");
  });
  it("has a safe default when no voice is set", () => {
    expect(systemPrompt({ voice: "", rules: "", max_hashtags: 3 })).toContain("make no claims");
  });
});

describe("draftsPrompt", () => {
  it("spreads drafts across topics", () => {
    const p = draftsPrompt({ count: 2, topics: ["coding", "sport"], recent: [], examples: [] });
    expect(p).toContain("Write 2 distinct LinkedIn posts");
    expect(p).toContain("- coding\n- sport");
    expect(p).not.toContain("RECENT POSTS");
  });
  it("writes versions of an idea and includes examples and recent posts", () => {
    const p = draftsPrompt({ count: 1, topics: ["x"], idea: "my idea", recent: ["old\npost"], examples: ["published one"] });
    expect(p).toContain("1 different version of a LinkedIn post");
    expect(p).toContain("my idea");
    expect(p).toContain("published one");
    expect(p).toContain("1. old post");
  });
});

describe("rewritePrompt", () => {
  it("falls back to a default instruction", () => {
    expect(rewritePrompt("text", "  ")).toContain("tighten it");
  });
});
