import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, id, className = "", ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-ink-muted">
          {label}
        </label>
        <textarea
          ref={ref}
          id={inputId}
          className={`rounded-md border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-amber ${
            error ? "border-coral" : "border-border"
          } ${className}`}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {error && <p className="text-sm text-coral">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
