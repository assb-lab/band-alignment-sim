import { describe, expect, it } from "vitest";
import { formatScientific, parseScientific } from "./scientificInput.ts";

describe("scientificInput", () => {
  it("formats large densities in exponential notation", () => {
    expect(formatScientific(2.8e19)).toBe("2.80e+19");
    expect(formatScientific(0)).toBe("0");
  });

  it("parses scientific and decimal strings", () => {
    expect(parseScientific("1e16")).toBe(1e16);
    expect(parseScientific("2.8e19")).toBe(2.8e19);
    expect(parseScientific("")).toBe(0);
    expect(parseScientific("bad")).toBe(0);
  });
});
