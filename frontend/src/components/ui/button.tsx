import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// One accent, one style: every colour below is mixed from --primary, so the buttons follow the theme. The primary is a
// very soft top-to-bottom gradient of that accent (86% accent + 14% white at the top, the full accent at the bottom),
// on pill corners with a soft accent shadow; hover and press change brightness, never the colour.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-semibold tracking-[-0.01em] whitespace-nowrap transition-[filter,color,background-color,border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(.32,.72,0,1)] outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[.98] disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "text-white bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_86%,white)_0%,var(--primary)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_1px_2px_rgb(15_36_66/0.16),0_8px_18px_-10px_rgb(29_111_216/0.6)] hover:brightness-[1.06] active:brightness-[.96]",
        outline:
          "text-ink bg-card shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_10%,transparent),0_1px_2px_rgb(15_36_66/0.05)] hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_14%,transparent),0_6px_14px_-8px_rgb(15_36_66/0.25)] active:brightness-[.97] aria-expanded:bg-muted",
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
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3.5 text-[13px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
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
