# Design System

## Color Palette

Tokens defined in `frontend/src/app/index.css` via CSS custom properties + `@theme inline`:

| Token | Light value | Usage |
|---|---|---|
| `primary` | oklch(57.96% 0.2215 31.428) | Warm orange-red; primary actions |
| `primary-foreground` | oklch(0.985 0 0) | Text on primary |
| `secondary` | oklch(55% 0.12 250) | Blue; secondary actions |
| `accent` | oklch(60% 0.25 80) | Amber/gold |
| `muted` | oklch(0.97 0 0) | Near-white surfaces |
| `muted-foreground` | oklch(0.556 0 0) | Secondary/metadata text |
| `background` | oklch(1 0 0) | Page background |
| `foreground` | oklch(0.145 0 0) | Primary text |
| `card` | oklch(1 0 0) | Card surface |
| `border` | oklch(0.922 0 0) | Default border |
| `ring` | oklch(62.3% 0.214 259.815) | Focus ring (blue) |
| `destructive` | oklch(0.577 0.245 27.325) | Errors / delete |
| `success` | oklch(0.618 0.233 142.478) | Confirmed / installed |
| `input` | oklch(44.683% 0.00129 15.032) | Input border |
| `link` | oklch(0.78 0.19 95) | Link color |

## Spacing Scale

Base unit: Tailwind default (4px). No custom scale overrides in `tailwind.config.ts`.

Observed rhythms in components:
- Card padding: `p-4` (16px)
- Card margin: `m-1` (4px)
- Card gap (flex): no gap — margin-based (`m-1`)
- Section spacing: `mb-4`, `mb-6`, `space-y-6`
- Inline gaps: `gap-2` (8px)

## Typography

| Role | Classes | Usage |
|---|---|---|
| Section header | `text-lg font-semibold` | Section titles (MCP, RPC, LLM) |
| Card primary | `text-base font-medium` | LLM card names |
| Alias / identifier | `font-mono text-lg font-bold` | MCP/RPC alias (`/command-name`) |
| Technical string | `font-mono` | IDs, command templates, tool names |
| Secondary / metadata | `text-xs text-muted-foreground` | Descriptions, keyDetails, inherited note |
| Label | `text-sm font-medium` | Form labels |
| Caption | `text-xs text-muted-foreground italic` | Inherited indicator |

## Depth Strategy

**Borders + hover shadow** — interactive cards get `hover:shadow-md transition-shadow`. No base shadow on cards. Inherited/disabled variant uses `border-dashed opacity-60` instead of hover state.

## Component Patterns

### Integration Card (LLM + MCP/RPC unified)

```
w-full sm:w-60 m-1
cursor-pointer
[hover:shadow-md] transition-shadow          ← editable
[border-dashed opacity-60]                    ← inherited/read-only
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

Card grid container: `flex flex-wrap justify-start w-full`

### Text Hierarchy in Cards

- Alias/name: `font-mono text-lg font-bold break-all min-w-0` (MCP/RPC) or `text-base font-medium text-center` (LLM)
- Type badge: `IntegrationTypeBadge` component
- Detail line: `text-xs text-muted-foreground truncate font-mono`
- Description: `text-xs text-muted-foreground line-clamp-2`

### Secondary Text in Dropdowns

Technical secondary identifiers: `text-xs text-muted-foreground font-mono`

### Section Header Row

```
flex items-center justify-between mb-4
h3: text-lg font-semibold
Button: size="sm" variant="default"
```
