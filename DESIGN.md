# Threaded — Design System & Style Guide v1

> A reusable reference for reproducing the Threaded aesthetic in new projects.
> Optimized for Tailwind CSS + CSS custom properties. Framework-agnostic tokens included.

---

## Quick Checklist

If you remember nothing else, follow these 12 rules:

1. **Two fonts:** A serif for content (Merriweather), a clean sans for UI (Inter)
2. **Light mode is the default:** White base, slate tones for text hierarchy, soft surfaces, restrained contrast
3. **Dark mode is secondary:** Start from zinc-950, layer up with zinc-900/800/700. One bright accent (cyan-400)
4. **Rounded-xl everywhere** for inputs and cards. Rounded-2xl for major containers
5. **Glass headers:** Semi-transparent bg + `backdrop-blur-sm`
6. **Restrained shadows:** `shadow-sm` for everyday surfaces, stronger shadows only for floating overlays
7. **Thin 6px scrollbars** that match the border color
8. **Hover-reveal patterns** for secondary actions (`opacity-0 → opacity-100` on `group-hover`)
9. **No harsh transitions:** Keep most motion 150–300ms with `ease` or `ease-in-out`
10. **Generous reading typography:** 1.125rem / 1.8 line-height / 0.01em letter-spacing
11. **Chat bubbles with one flat corner** to indicate direction
12. **Cyan accent glow** (`rgba(34, 211, 238, 0.15)`) for subtle highlights on interactive elements

---

## Design Philosophy

### This Is

Editorial. Quiet. Literary. Restrained. A reading-first interface where the content is the star and the UI is the stage crew — present but invisible.

### This Is Not

Glossy SaaS dashboard. Neon cyberpunk. Playful startup gradients. Oversized motion. Rounded-everything candy UI. Anything that draws attention to itself over the content.

### Core Principles

- **Minimal and literary.** The interface recedes; content comes forward. Serif fonts for reading, sans-serif for UI chrome.
- **Light mode by default.** The baseline experience is white, airy, and editorial. Dark mode uses deep zinc/black tones with cyan accents as a deliberate alternate theme, not the primary identity.
- **Subtle depth.** Glass-morphism headers, thin borders, restrained shadows. Nothing shouts.
- **Calm interactivity.** Transitions are 150–300ms. Hover states are color shifts, not size jumps. The only scale transforms are on primary action buttons (±5%).

### Overall Composition

The signature layout is a **centered reading column** (`max-w-[720px]`) with generous vertical padding, a **sticky frosted-glass header**, and a **slide-in sidebar** for secondary surfaces (chat, thread list). UI chrome is compact and muted. Whitespace is generous. In the default light theme, the canvas should feel like paper in daylight; in dark mode, like a quietly lit reading room.

---

## Do / Don't

| Do                                                          | Don't                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| Use serif (Merriweather) for long-form content              | Use serif for buttons, labels, or UI chrome               |
| Use sans (Inter) for all interactive UI                     | Mix more than 2 font families                             |
| Keep accent cyan sparse — focus, selection, one CTA         | Fill large areas with accent color                        |
| Use `rounded-xl` for inputs/cards, `rounded-2xl` for panels | Use sharp corners or `rounded-sm`                         |
| Add `backdrop-blur-sm` to sticky headers                    | Use opaque sticky headers that block content              |
| Reveal secondary actions on hover                           | Show all actions at all times                             |
| Use 1px borders in slate/zinc tones                         | Use thick or colored borders for decoration               |
| Keep shadows restrained and purposeful                      | Apply medium/large shadows broadly across static surfaces |
| Transition colors over 150–200ms                            | Animate position or size on hover (except primary CTA)    |
| Use zinc-950 → zinc-700 layering in dark mode               | Use pure `#000000` or gray-\* for dark mode               |

---

## CSS Custom Properties (Framework-Agnostic)

These tokens can be used in any project, independent of Tailwind:

```css
:root {
  /* Backgrounds */
  --color-bg-base: #ffffff;
  --color-bg-surface: #f8fafc;
  --color-bg-elevated: #f1f5f9;

  /* Text */
  --color-text-primary: #1e293b;
  --color-text-secondary: #475569;
  --color-text-muted: #64748b;

  /* Borders */
  --color-border: #e2e8f0;
  --color-border-hover: #cbd5e1;

  /* Accent */
  --color-accent: #22d3ee;
  --color-accent-muted: #0891b2;
  --color-accent-glow: rgba(34, 211, 238, 0.15);

  /* Focus */
  --color-focus-ring: rgba(34, 211, 238, 0.5);

  /* Overlays */
  --color-overlay: rgba(15, 23, 42, 0.5);
  --color-overlay-blur: rgba(15, 23, 42, 0.5);

  /* Selection */
  /* Selection stays cool blue in light mode to avoid overusing cyan */
  --color-selection-bg: #bfdbfe;
  --color-selection-text: #1e3a8a;

  /* Semantic */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;

  /* Scrollbar */
  --color-scrollbar: #cbd5e1;
  --color-scrollbar-hover: #94a3b8;

  /* Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;

  /* Motion */
  --motion-fast: 150ms ease;
  --motion-normal: 200ms ease;
  --motion-slow: 300ms ease-in-out;

  /* Layout */
  --content-max-width: 720px;
  --sidebar-width: 450px;
  --header-height: 56px;

  /* Typography */
  --font-serif: 'Merriweather', Georgia, serif;
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', monospace;
}

.dark {
  --color-bg-base: #09090b;
  --color-bg-surface: #18181b;
  --color-bg-elevated: #27272a;

  --color-text-primary: #f4f4f5;
  --color-text-secondary: #e4e4e7;
  --color-text-muted: #a1a1aa;

  --color-border: #3f3f46;
  --color-border-hover: #52525b;

  --color-overlay: rgba(0, 0, 0, 0.6);

  --color-selection-bg: rgba(34, 211, 238, 0.3);
  --color-selection-text: #fafafa;

  --color-scrollbar: #3f3f46;
  --color-scrollbar-hover: #52525b;
}
```

---

## Color Palette (Tailwind)

### Light Mode

This is the default theme. New sessions should open in light mode unless the user has explicitly chosen dark mode and that preference has been persisted.

| Role              | Value     | Tailwind           |
| ----------------- | --------- | ------------------ |
| Background        | `#ffffff` | `bg-white`         |
| Surface (cards)   | `#f8fafc` | `bg-slate-50`      |
| Elevated (inputs) | `#f1f5f9` | `bg-slate-100`     |
| Text primary      | `#1e293b` | `text-slate-800`   |
| Text secondary    | `#475569` | `text-slate-600`   |
| Text muted        | `#64748b` | `text-slate-500`   |
| Border            | `#e2e8f0` | `border-slate-200` |

### Dark Mode

Dark mode is an alternate reading environment, not the default starting point.

| Role              | Value     | Tailwind                        |
| ----------------- | --------- | ------------------------------- |
| Background (base) | `#09090b` | `bg-dark-base` (zinc-950)       |
| Surface (cards)   | `#18181b` | `bg-dark-surface` (zinc-900)    |
| Elevated (inputs) | `#27272a` | `bg-dark-elevated` (zinc-800)   |
| Border            | `#3f3f46` | `border-dark-border` (zinc-700) |
| Text primary      | `#f4f4f5` | `text-zinc-100`                 |
| Text secondary    | `#e4e4e7` | `text-zinc-200`                 |
| Text muted        | `#a1a1aa` | `text-zinc-400`                 |

### Accent — Usage Rules

The accent color (`#22d3ee`, cyan-400) is **sparse and purposeful**. Use it for:

- Focus rings and active input borders
- Text selection highlighting in dark mode and annotation highlights in both themes
- Active/selected state indicators
- One primary CTA per view (at most)
- Inline annotation underlines

**Never** use accent as a large background fill, nav bar color, or text color for body copy.

Light-mode selection is intentionally a soft blue fill (`#bfdbfe`) rather than cyan. That keeps the reading surface calmer while reserving cyan for thread anchors, focus, and active UI states.

### Semantic Colors

| Role    | Light                 | Dark                |
| ------- | --------------------- | ------------------- |
| Success | `#10b981` emerald-500 | `#4ade80` green-400 |
| Warning | `#f59e0b` amber-500   | `#fbbf24` amber-400 |
| Error   | `#ef4444` red-500     | `#dc2626` red-600   |

### Tailwind Extension

```js
// tailwind.config.js
{
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          base: '#09090b',
          surface: '#18181b',
          elevated: '#27272a',
          border: '#3f3f46',
        },
        accent: {
          DEFAULT: '#22d3ee',
          muted: '#0891b2',
          glow: 'rgba(34, 211, 238, 0.15)',
        },
      },
    },
  },
}
```

---

## Typography

### Font Stack

| Purpose               | Family       | Weights                     | When to Use                                       |
| --------------------- | ------------ | --------------------------- | ------------------------------------------------- |
| Content / headings    | Merriweather | 300, 400, 700, 900 + italic | Long-form reading, document headings, blockquotes |
| UI / labels / buttons | Inter        | 300, 400, 500, 600          | Buttons, inputs, sidebar, chat, navigation        |
| Code                  | System mono  | —                           | Code blocks, inline code                          |

**Rule:** Serif is only for the reading surface. Everything interactive is sans-serif.

### Scale

| Element         | Size               | Line Height | Weight | Font         |
| --------------- | ------------------ | ----------- | ------ | ------------ |
| Document H1     | 2.25rem            | 1.2         | 700    | Merriweather |
| Document H2     | 1.8rem             | 1.3         | 700    | Merriweather |
| Document H3     | 1.5rem             | 1.4         | 700    | Merriweather |
| Body paragraph  | 1.125rem           | 1.8         | 400    | Merriweather |
| UI heading      | 1.25rem (text-xl)  | 1.4         | 600    | Inter        |
| UI body         | 1rem (text-base)   | 1.5         | 400    | Inter        |
| UI label        | 0.875rem (text-sm) | 1.4         | 500    | Inter        |
| Small / caption | 0.75rem (text-xs)  | 1.4         | 400    | Inter        |
| Chat message    | 0.875rem           | 1.5         | 400    | Inter        |
| Chat code       | 0.75rem            | 1.4         | 400    | Mono         |

### Spacing

- Heading top margin: `2em`
- Heading bottom margin: `0.75em`
- Paragraph bottom margin: `1.5em`
- List item spacing: `0.5em`
- Letter spacing on reading content: `0.01em`

### Links

- Light: `#2563eb` (blue-600), underline on hover
- Dark: `#22d3ee` (accent), underline on hover

Thread anchors are a separate pattern from standard links. Use the annotation underline treatment described below for anything that opens a thread or inline discussion.

---

## Spacing

### Rhythm

Use Tailwind's 4px base. Common patterns:

| Token           | Value       | Usage                     |
| --------------- | ----------- | ------------------------- |
| `p-1.5` / `p-2` | 6–8px       | Icon buttons              |
| `px-3 py-1.5`   | 12px / 6px  | Small buttons             |
| `px-4 py-2.5`   | 16px / 10px | Standard inputs & buttons |
| `px-4 py-3.5`   | 16px / 14px | Large inputs              |
| `p-4`           | 16px        | Card / panel padding      |
| `p-6`           | 24px        | Modal body                |
| `px-8 py-16`    | 32px / 64px | Page-level reading margin |
| `gap-2`         | 8px         | Standard flex gap         |
| `gap-3`         | 12px        | Component group gap       |
| `gap-6`         | 24px        | Section-level gap         |
| `space-y-6`     | 24px        | Between chat messages     |

### Layout Tokens

| Token             | Value                   | Usage              |
| ----------------- | ----------------------- | ------------------ |
| Content width     | `max-w-[720px]`         | Reading column     |
| Sidebar width     | `w-[450px]`             | Side panel         |
| Modal width       | `max-w-md` / `max-w-sm` | Dialogs            |
| Chat bubble width | `max-w-[85%]`           | Message containers |
| Header height     | ~56px                   | Sticky top bar     |

### Z-Index Layers

| Layer                  | Value            |
| ---------------------- | ---------------- |
| Sticky header          | `z-10`           |
| Sidebar shell          | `z-50`           |
| Overlay/backdrop       | `z-40` to `z-50` |
| Modal                  | `z-[60]`         |
| Tooltip / context menu | `z-50`           |

---

## Border Radius

| Context              | Value        | Tailwind                    |
| -------------------- | ------------ | --------------------------- |
| Small controls       | 0.375–0.5rem | `rounded-md` / `rounded-lg` |
| Inputs, cards        | 0.75rem      | `rounded-xl`                |
| Major panels, modals | 1rem         | `rounded-2xl`               |
| Pill / circle        | 9999px       | `rounded-full`              |
| Code blocks          | 0.5em        | custom CSS                  |

Chat bubbles use `rounded-2xl` with one corner flattened:

- User messages: `rounded-2xl rounded-tr-none`
- AI messages: `rounded-2xl rounded-tl-none`

---

## Shadows & Depth

| Level     | Tailwind                   | When                                  |
| --------- | -------------------------- | ------------------------------------- |
| Subtle    | `shadow-sm`                | Cards, message bubbles                |
| Floating  | `shadow-lg` / `shadow-xl`  | Dropdowns, tooltips, transient panels |
| Prominent | `shadow-xl` / `shadow-2xl` | Modals, full-height sidebars          |

### Glass Headers

Sticky headers use semi-transparent backgrounds with backdrop blur:

```
bg-white/90 dark:bg-dark-base/90 backdrop-blur-sm
```

**When to use glass:** Only on sticky/fixed elements where content scrolls beneath. Never on static cards or containers.

---

## Borders

| Pattern                                           | Usage                                      |
| ------------------------------------------------- | ------------------------------------------ |
| `border border-slate-200 dark:border-dark-border` | Standard card/input border                 |
| `border-t` or `border-b`                          | Section dividers                           |
| `border-l-2 border-accent`                        | Context highlight (quoted text in sidebar) |
| `border-2 border-dashed`                          | Drop zones, empty states                   |

Borders are always 1px unless used as a visual accent (2–4px left border on blockquotes and context cards).

---

## Component Patterns

### Buttons

**Primary Action:**

```
bg-slate-900 dark:bg-zinc-100
text-white dark:text-zinc-900
rounded-xl font-medium
hover:bg-slate-800 dark:hover:bg-zinc-200
transition-all
```

**Icon Button:**

```
p-2 rounded-full
hover:bg-slate-100 dark:hover:bg-dark-elevated
text-slate-500 dark:text-zinc-400
transition-colors
```

**Destructive Hover:**

```
hover:bg-red-50 dark:hover:bg-red-900/20
hover:text-red-500
```

**States:**

- Disabled: `opacity-50 cursor-not-allowed`
- Active press: `active:scale-95`
- Primary hover: `hover:scale-105` (only on the single main action button)

### Inputs

```
bg-slate-50 dark:bg-dark-elevated
border border-slate-200 dark:border-dark-border
rounded-xl
px-4 py-2.5
placeholder:text-slate-400 dark:placeholder:text-zinc-500
focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
transition-colors
```

**Decision rule:** Use `bg-surface` for passive containers, `bg-elevated` for interactive controls (inputs, dropdowns, editable areas).

### Modals & Overlays

- Backdrop: `bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm`
- Container: `max-w-md rounded-2xl p-6 shadow-xl`
- Entrance animation: fade-in over 200ms

### Chat Bubbles

| Sender | Background                                  | Text                                | Corner            |
| ------ | ------------------------------------------- | ----------------------------------- | ----------------- |
| User   | `bg-slate-800 dark:bg-zinc-700`             | `text-white`                        | `rounded-tr-none` |
| AI     | `bg-white dark:bg-dark-elevated` + border   | `text-slate-700 dark:text-zinc-200` | `rounded-tl-none` |
| Error  | `bg-red-50 dark:bg-red-900/20` + red border | `text-red-700 dark:text-red-300`    | —                 |

All bubbles: `rounded-2xl shadow-sm max-w-[85%]`

### Inline Annotations / Highlights

Text that links to a thread or annotation uses:

```css
text-decoration: underline;
text-decoration-thickness: 2px;
text-decoration-color: rgba(34, 211, 238, 0.85);
text-underline-offset: 3px;
cursor: pointer;
border-radius: 0.2em;
```

On hover, a subtle glow background appears: `rgba(34, 211, 238, 0.12)`. On active/selected: `rgba(34, 211, 238, 0.18)`. Add a fast background transition (`150ms ease`) so the underline feels responsive without flashing.

This is a signature motif — the underline-as-annotation pattern — that makes the interface feel like marginalia on a page.

---

## Transitions & Micro-Interactions

| What                      | Duration  | Easing                      |
| ------------------------- | --------- | --------------------------- |
| Color / background shifts | 150–200ms | ease (default)              |
| Panel slide (sidebar)     | 300ms     | ease-in-out                 |
| Modal entrance            | 200ms     | fade-in                     |
| Dark mode transition      | 300ms     | `transition-colors` on body |

### Patterns

- **Hover-reveal actions:** `opacity-0 group-hover:opacity-100 transition-opacity` — edit/delete buttons appear only on hover.
- **Loading spinner:** `animate-spin` on a circular icon (e.g., Lucide's Loader2).
- **Typing indicator:** Three dots with `animate-bounce` and staggered delays (0, 150ms, 300ms).
- **Scroll behavior:** `scrollIntoView({ behavior: 'smooth' })` for new messages.
- **Button arrow nudge:** `group-hover:translate-x-1 transition-transform` — subtle rightward shift.
- **Copy feedback:** Icon swaps from Copy → Check with a color shift to green, reverts after 2s.

### Animation Dependencies

Utilities such as `animate-in`, `fade-in`, `zoom-in`, and `slide-in-from-top-2` are not guaranteed in every Tailwind setup. If your stack does not provide them, add an animation plugin or define equivalent CSS yourself:

```css
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes zoomIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes slideInFromTop {
  from {
    opacity: 0;
    transform: translateY(-0.5rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in {
  animation: fadeIn 200ms ease-out;
}
.animate-zoom-in {
  animation: zoomIn 200ms ease-out;
}
.animate-slide-in-from-top-2 {
  animation: slideInFromTop 300ms ease-out;
}
```

---

## Icons

- **Library:** Lucide React (or any consistent line-icon set)
- **Default size:** 18px for header actions, 16px for inline actions, 20px for primary actions
- **Default color:** `text-slate-500 dark:text-zinc-400`
- **Hover color:** `text-slate-700 dark:text-zinc-200`
- **Accent color:** `text-accent` or `text-cyan-600 dark:text-accent`
- **Filled state:** Toggle between outline and `fill-current` (e.g., bookmark saved)

---

## Scrollbars

```css
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
.dark ::-webkit-scrollbar-thumb {
  background: #3f3f46;
}
.dark ::-webkit-scrollbar-thumb:hover {
  background: #52525b;
}
```

---

## Selection Styling

```css
::selection {
  background: #bfdbfe;
  color: #1e3a8a;
}
.dark ::selection {
  background: rgba(34, 211, 238, 0.3);
  color: #fafafa;
}
```

Use blue selection in light mode and translucent cyan in dark mode. This asymmetry is intentional: light mode stays editorial and ink-like, while dark mode needs the brighter accent to remain legible.

---

## Accessibility

- **Focus visible:** `outline: 2px solid rgba(34, 211, 238, 0.9); outline-offset: 2px;`
- **Focus ring (Tailwind):** `focus:outline-none focus:ring-2 focus:ring-accent/50`
- **Keyboard navigation:** All interactive elements must have visible focus indicators. Use `focus-visible:` to avoid showing focus on click.
- **Contrast:** Ensure text meets WCAG AA against its background. The palette is designed for this — slate-800 on white (light) and zinc-100 on zinc-950 (dark) both exceed 7:1.

---

## Markdown Content Styling

Reading-view markdown uses Merriweather serif with generous line-height (1.8):

- **Paragraphs:** `#334155` (slate-700) light, `#d4d4d8` (zinc-300) dark
- **Blockquotes:** 4px left border (blue-500 light, cyan-400 dark), italic, 1rem left padding
- **Inline code:** `bg-slate-100 dark:bg-zinc-800`, padding `0.2em 0.4em`, radius `0.25em`, font-size `0.875em`
- **Code blocks:** `bg-slate-800 dark:bg-zinc-900` with border, padding `1em`, radius `0.5em`
- **Tables:** Full-width, alternating row backgrounds, cell padding `0.75em 1em`, thin borders
- **Chat-mode markdown:** Compact variant — 0.875rem body, 0.75rem code, tighter spacing throughout

---

## Starting a New Project — Recipe

1. **Import fonts** in your HTML head:

   ```html
   <link
     href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,400&display=swap"
     rel="stylesheet"
   />
   ```

2. **Set up Tailwind** with `darkMode: 'class'` and extend colors (see Tailwind Extension above).

3. **Add CSS custom properties** from the token block above to your global CSS.

4. **Apply base styles** to `body`:

   ```css
   body {
     font-family: var(--font-sans);
     background: var(--color-bg-base);
     color: var(--color-text-primary);
     transition:
       color 300ms,
       background-color 300ms;
   }
   ```

   Default to the light token set. Only apply the `.dark` class after an explicit user toggle or restoring a saved preference.

5. **Set up the app shell:** Full-height flex column, sticky glass header, centered content column (`max-w-[720px] mx-auto`), optional slide-in sidebar from right.

6. **Add scrollbar and selection styles** from the sections above.

7. **Layer components** following the patterns in this guide — inputs, buttons, cards, modals, chat bubbles.

---

## AI Prompt Template

When asking an AI coding assistant to build a UI in this style, include:

> Build a calm, editorial interface. Use Merriweather serif for reading content and Inter sans-serif for UI. Default to light mode: white base, slate text hierarchy, soft elevated surfaces, and lots of breathing room. Dark mode is optional: zinc-950 base layering up through zinc-900/800/700 with a single cyan-400 accent used sparingly for focus, thread anchors, and active UI. Rounded-xl on inputs/cards, rounded-2xl on panels. Glass headers with `backdrop-blur-sm`. Restrained shadows: `shadow-sm` for everyday surfaces, stronger shadows only for floating overlays. Hover-reveal secondary actions. Transitions 150-300ms. Generous reading typography at 1.125rem/1.8 line-height. The overall feeling should be literary and quiet — like marginalia in a well-typeset book.
