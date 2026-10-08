import { describe, expect, it } from "vitest";
import { countHashtags, escapeLittleText, toLittleText } from "@/lib/littletext";

describe("escapeLittleText", () => {
  it("escapes every reserved character", () => {
    expect(escapeLittleText("a(b)c")).toBe("a\\(b\\)c");
    expect(escapeLittleText("[x]{y}<z>|@*_~\\#")).toBe("\\[x\\]\\{y\\}\\<z\\>\\|\\@\\*\\_\\~\\\\\\#");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeLittleText("Plain text, with punctuation! 100% ok.")).toBe("Plain text, with punctuation! 100% ok.");
  });
});

describe("toLittleText", () => {
  it("turns hashtags into hashtag templates", () => {
    expect(toLittleText("Hello #pharmacy and #learnToCode")).toBe(
      "Hello {hashtag|\\#|pharmacy} and {hashtag|\\#|learnToCode}",
    );
  });

  it("handles a hashtag at the start of a line", () => {
    expect(toLittleText("Line one\n#tag")).toBe("Line one\n{hashtag|\\#|tag}");
  });

  it("escapes a # that isn't a hashtag", () => {
    expect(toLittleText("I was #1 (really)")).toBe("I was \\#1 \\(really\\)");
    expect(toLittleText("see example.com/#section")).toBe("see example.com/\\#section");
    expect(toLittleText("C# is fine")).toBe("C\\# is fine");
  });

  it("supports non-ASCII hashtags", () => {
    expect(toLittleText("#Gesundheit")).toBe("{hashtag|\\#|Gesundheit}");
  });

  it("escapes reserved characters around hashtags", () => {
    expect(toLittleText("(see #ai)")).toBe("\\(see {hashtag|\\#|ai}\\)");
  });

  it("counts hashtags the same way", () => {
    expect(countHashtags("one #a two #b3 #1 C#")).toBe(2);
  });
});
