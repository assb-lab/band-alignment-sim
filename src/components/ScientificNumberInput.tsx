import { useState } from "react";
import { formatScientific, parseScientific } from "../lib/scientificInput.ts";
import { numericInputAttrs } from "./numericInputAttrs.ts";

interface ScientificNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
}

export function ScientificNumberInput({
  value,
  onChange,
  className,
  placeholder = "1e16",
}: ScientificNumberInputProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(() => formatScientific(value));

  return (
    <input
      type="text"
      {...numericInputAttrs}
      className={className}
      placeholder={placeholder}
      value={editing ? text : formatScientific(value)}
      onFocus={() => {
        setEditing(true);
        setText(formatScientific(value));
      }}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        onChange(parseScientific(next));
      }}
      onBlur={() => {
        setEditing(false);
        const parsed = parseScientific(text);
        onChange(parsed);
        setText(formatScientific(parsed));
      }}
    />
  );
}
