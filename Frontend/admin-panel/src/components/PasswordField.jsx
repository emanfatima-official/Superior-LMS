import { useState } from "react";
import { KeyRound, RefreshCw, Copy, Check } from "lucide-react";
import FormField, { inputClass } from "./FormField";

function generatePassword(length = 12) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "@#$%&*!";

  const all = upper + lower + numbers + symbols;

  let password =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    numbers[Math.floor(Math.random() * numbers.length)] +
    symbols[Math.floor(Math.random() * symbols.length)];

  while (password.length < length) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export default function PasswordField({
  label = "Password",
  value,
  onChange,
  required = true,
  placeholder = "Enter password",
  minLength = 6,
}) {
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const password = generatePassword(12);

    onChange(password);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      // Clipboard may not be available in some browsers.
    }
  };

  return (
    <FormField label={label}>
      <div className="space-y-2">
        <div className="relative">
          <KeyRound
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            required={required}
            type="text"
            minLength={minLength}
            className={`${inputClass} pl-10 pr-10`}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="new-password"
          />

          {value && (
            <button
              type="button"
              onClick={handleCopy}
              title="Copy password"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-blue-600"
            >
              {copied ? (
                <Check size={16} />
              ) : (
                <Copy size={16} />
              )}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          className="flex items-center gap-2 text-xs font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400"
        >
          <RefreshCw size={14} />
          Generate secure password
        </button>
      </div>
    </FormField>
  );
}