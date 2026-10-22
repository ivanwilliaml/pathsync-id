import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// One accent, one style: every colour below is mixed from --primary, so the buttons follow the theme. The primary is a
// very soft top-to-bottom gradient of that accent (86% accent + 14% white at the top, the full accent at the bottom),
// keeping the app's boxy corners, with a hairline shadow; hover and press change brightness, never the colour.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium tracking-[-0.01em] whitespace-nowrap transition-[filter,color,background-color,border-color,box-shadow,transform] duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[.98] disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "text-white bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_86%,white)_0%,var(--primary)_100%)] shadow-[0_1px_2px_rgb(0_0_0/0.18)] hover:brightness-[1.06] active:brightness-[.96]",
        outline:
          "border-border text-ink bg-[linear-gradient(180deg,var(--card)_0%,color-mix(in_srgb,var(--muted)_60%,var(--card))_100%)] hover:brightness-[.98] active:brightness-[.96] aria-expanded:bg-muted",
        secondary:
          "text-ink border-[color-mix(in_srgb,var(--primary)_24%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--primary)_16%,transparent)] aria-expanded:bg-[color-mix(in_srgb,var(--primary)_16%,transparent)]",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-transparent text-destructive hover:bg-destructive/8 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        link: "rounded-md text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-6 gap-1 rounded-md px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-md px-3 text-[13px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-1.5 px-5 text-[15px] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
