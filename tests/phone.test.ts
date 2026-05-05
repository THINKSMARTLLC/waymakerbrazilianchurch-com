import { describe, it, expect } from "vitest";
import {
  formatUSPhoneInput,
  toUSPhoneStorage,
  formatPhoneDisplay,
  isValidUSPhone,
} from "@/lib/phone";

describe("US phone formatting", () => {
  it("formats raw 10 digits while typing", () => {
    expect(formatUSPhoneInput("2677806683")).toBe("(267) 780-6683");
  });

  it("stores in canonical (XXX) XXX-XXXX form", () => {
    expect(toUSPhoneStorage("2677806683")).toBe("(267) 780-6683");
  });

  it("display normalizes existing 10-digit DB values", () => {
    expect(formatPhoneDisplay("2677806683")).toBe("(267) 780-6683");
  });

  it("validates 10 digits only", () => {
    expect(isValidUSPhone("2677806683")).toBe(true);
    expect(isValidUSPhone("267780668")).toBe(false);
  });
});
