import type { CSSProperties, InputHTMLAttributes } from "react";

export const numericInputAttrs = {
  inputMode: "decimal",
  lang: "en",
  autoComplete: "off",
  autoCorrect: "off",
  spellCheck: false,
  style: { imeMode: "disabled" } as CSSProperties,
} satisfies InputHTMLAttributes<HTMLInputElement>;
