import * as React from "react"
import { cn } from "cn"

type FloatingInputProps = Omit<React.ComponentProps<"input">, "placeholder"> & {
  label: string
  /** Hint shown once the field is focused and still empty. */
  placeholder?: string
  /** Helper text under the field. */
  description?: React.ReactNode
}

/**
 * Input with its label inside, which floats to the top on focus or once the
 * field has a value. Driven by :placeholder-shown, so it also follows
 * browser autofill without extra state.
 */
function FloatingInput({ label, placeholder, description, id, className, ...props }: FloatingInputProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const descriptionId = description ? `${inputId}-description` : undefined

  return (
    <div data-slot="floating-input" className={cn("group/field space-y-1.5", className)}>
      <div className="relative">
        <input
          id={inputId}
          // A placeholder is required for :placeholder-shown; it stays invisible until focus.
          placeholder={placeholder ?? " "}
          aria-describedby={descriptionId}
          className={cn(
            "peer h-14 w-full min-w-0 rounded-xl border border-input bg-transparent px-4 pt-5 pb-1.5 text-base transition-[color,box-shadow,border-color] outline-none",
            "placeholder:text-transparent focus:placeholder:text-muted-foreground/70",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-60 dark:bg-input/30 dark:disabled:bg-input/80",
            "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
          )}
          {...props}
        />
        <label
          htmlFor={inputId}
          className={cn(
            // Floated position is the default; the resting one applies while empty and unfocused.
            "pointer-events-none absolute top-2 left-4 origin-left text-xs text-muted-foreground transition-all select-none",
            "peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base",
            "peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-foreground",
            "peer-disabled:opacity-60 peer-aria-invalid:text-destructive"
          )}
        >
          {label}
        </label>
      </div>
      {description && (
        <p id={descriptionId} className="px-1 text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}

export { FloatingInput }
