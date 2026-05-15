/**
 * Single source of truth for color tokens used in inline `style` props.
 *
 * Each value is a CSS `var(...)` reference, not a literal color — the
 * underlying hex values are declared in `src/app/globals.css` so that the
 * design palette can be tweaked from one place. When React renders
 * `style={{ color: palette.dark }}`, the browser resolves the CSS variable
 * at paint time.
 *
 * @type {{
 *   dark: string,
 *   steel: string,
 *   terracotta: string,
 *   warm: string,
 *   red: string,
 *   green: string,
 * }}
 */
export const palette = {
  dark:       "var(--color-dark-navy)",
  steel:      "var(--color-steel-blue)",
  terracotta: "var(--color-terracotta)",
  warm:       "var(--color-warm-gray)",
  red:        "var(--color-red)",
  green:      "var(--color-success-green)",
};
