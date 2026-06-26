# VaultSync — Design System

The visual contract for every screen (Plans 2–6). Build agents must read this and consume
**tokens**, never inline hex/sizes. Target React Native / Expo primitives — no HTML/CSS.

**Aesthetic:** calm, trustworthy, focused. A security tool you relax around — generous
whitespace, restrained color, one confident accent. No gradients-heavy flash, no alarmist red
everywhere. Security cues are quiet (a lock glyph, not a vault door).

**Materialize this** in `src/theme/` (`tokens.ts` + a `ThemeProvider`/`useTheme()` hook) in the
first UI task, then components read from the theme. Support light + dark; default to the system
color scheme (`useColorScheme()`).

---

## Color tokens

Semantic names — never reference raw hex in components.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F6F7F9` | `#0E1014` | Screen background |
| `surface` | `#FFFFFF` | `#161A21` | Cards, sheets, inputs |
| `surfaceAlt` | `#EEF0F4` | `#1E232C` | Secondary fills, code blocks, tonal buttons |
| `border` | `#E1E4EA` | `#2A313C` | Hairlines, input borders |
| `textPrimary` | `#14171F` | `#ECEFF4` | Titles, body |
| `textSecondary` | `#586173` | `#A6AFBD` | Subtitles, labels |
| `textMuted` | `#8A93A2` | `#6B7480` | Placeholders, captions |
| `primary` | `#3B5BDB` | `#5C7CFA` | Primary actions, focus, active |
| `primaryPressed` | `#2F49B0` | `#4263EB` | Pressed primary |
| `onPrimary` | `#FFFFFF` | `#0B0D11` | Text/icon on `primary` |
| `success` | `#2F9E44` | `#51CF66` | Saved, strong password |
| `warning` | `#E8920C` | `#FCC419` | Weak password, caution |
| `danger` | `#E03131` | `#FF6B6B` | Delete, wrong password, errors |
| `focusRing` | `primary @ 35%` | `primary @ 45%` | Input focus halo |
| `overlay` | `#0E1014 @ 45%` | `#000000 @ 55%` | Modal scrim |

Primary = indigo (trust, not playful). Use `success`/`warning`/`danger` only for meaning, never decoration.

---

## Typography

System font stack (native feel + performance): iOS San Francisco, Android Roboto — i.e. RN
default `System`. **Passwords, recovery codes, and any secret use a monospace** (`Menlo`/
`RobotoMono`) with `fontVariant: ['tabular-nums']` and slight letter-spacing for legibility.

| Style | Size / Weight / LineHeight | Use |
|---|---|---|
| `display` | 32 / 700 / 38 | Onboarding hero only |
| `title` | 24 / 700 / 30 | Screen large title |
| `heading` | 20 / 600 / 26 | Section headers |
| `body` | 16 / 400 / 24 | Default text (base) |
| `bodyStrong` | 16 / 600 / 24 | Button labels, emphasis |
| `subhead` | 14 / 500 / 20 | Input labels, list subtitles |
| `caption` | 13 / 400 / 18 | Helper text, errors, meta |
| `mono` | 17 / 500 / 24, tabular | Secrets, recovery codes |

Respect OS Dynamic Type (`fontScale`) — don't hard-cap text. Letter-spacing `-0.3` on
`display`/`title`, `0` elsewhere.

---

## Spacing, radii, elevation

**Spacing** — 4pt grid: `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · 3xl 32 · 4xl 40 · 5xl 48`.
Screen horizontal padding = `xl (20)`. Vertical rhythm between blocks = `2xl (24)`.

**Radii:** `sm 8 · md 12 · lg 16 · pill 999`. Inputs/buttons `md`, cards/sheets `lg`, chips `pill`.

**Elevation** — keep flat-ish. Light: soft shadow (`e1`: y2 blur8 `#14171F @ 6%`; `e2`: y6 blur16
`@ 10%`). Dark: prefer `border` + `surfaceAlt` over shadows (shadows read poorly on dark). Bottom
sheets/modals = `e2`.

---

## Component conventions

- **Buttons** — height 52, radius `md`, label `bodyStrong`, min touch 48, full-width in forms.
  Variants: `primary` (filled `primary`/`onPrimary`), `secondary` (tonal `surfaceAlt`/`textPrimary`),
  `ghost` (text-only `primary`), `destructive` (filled `danger`). Pressed → `primaryPressed` / 92%
  scale-less opacity. Disabled → 40% opacity, no press. Show a spinner in-place when async.
- **Text inputs** — height 52, radius `md`, `surface` bg, 1px `border`; focus = `primary` border +
  `focusRing` halo. Label `subhead` above, helper/error `caption` below (error → `danger`, set
  `accessibilityLabel`). Secret fields: `secureTextEntry` with a show/hide eye toggle; revealed
  text renders in `mono`.
- **List row (vault entry)** — min height 64, `surface`, leading 40px avatar (favicon/letter),
  title `bodyStrong`, subtitle (username) `subhead`/`textSecondary`, trailing quick-copy or chevron.
  Hairline `border` divider. Whole row pressable; long-press = context actions.
- **Screen + header** — SafeArea-aware. Pattern: large `title`, back affordance (left), optional
  single right action. Content scrolls under a compact sticky title on scroll. Use the navigator's
  native stack transitions.
- **Password strength meter** — 4 segments, `danger → warning → primary → success`.
- **Recovery-code block** — `mono` on `surfaceAlt`, grouped (e.g. `XXXX-XXXX-…`), prominent copy
  button + "saved it" confirmation. Treat as sensitive: no analytics, no logging.
- **Feedback** — toast/snackbar for "Copied"/"Saved"; bottom sheet for confirmations and the
  biometric prompt. Destructive confirms use `danger`.

---

## Motion & haptics

Durations 150–250ms, ease-out on enter / ease-in on exit. Animate with Reanimated /
`LayoutAnimation` sparingly (lists, sheet present, strength meter). Honor reduce-motion
(`AccessibilityInfo`). Haptics (`expo-haptics`): light on copy, success on unlock/save, error on
wrong password/biometric fail.

---

## Iconography & a11y

- One icon set, consistent stroke: **Lucide** (`lucide-react-native`) — clean, security-friendly.
- Contrast ≥ AA (4.5:1 text). Touch targets ≥ 48. Every actionable element gets an
  `accessibilityLabel`/`accessibilityRole`. Secret screens should set Android `FLAG_SECURE`
  (block screenshots) — wire in the native layer.

---

## Bilingual (PT default, EN)

All copy comes from i18n (`addNamespace`), never hardcoded. **Portuguese strings run ~15–30%
longer than English** — so:
- No fixed-width buttons/labels with centered text that can truncate; let them grow or wrap.
- Prefer multiline-tolerant layouts; avoid single-line `numberOfLines={1}` on primary labels.
- Test every screen with the PT strings (the longer case) before calling it done.
