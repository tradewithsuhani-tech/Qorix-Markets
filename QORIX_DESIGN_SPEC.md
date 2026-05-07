# Qorix Markets — Mobile App Design Spec

Complete design system & screen reference for native (Flutter) re-implementation.
Use the demo APK side-by-side with this doc — APK = visual reference, this doc = exact tokens.

---

## 1. Brand & Theme

- **Theme:** Dark-only (premium fintech)
- **Vibe:** Glassmorphism, soft glows, gradients, subtle animations
- **Inspiration:** Linear, Robinhood, Phantom Wallet
- **Typography:** System default (San Francisco on iOS, Roboto on Android). Use **Inter** as fallback if shipping a custom font.

### Brand gradient (used for primary CTAs & headers)
```
Linear gradient → 0°  #3B82F6 (blue)  → 50% #8B5CF6 (purple) → 100% #EC4899 (pink)
```

---

## 2. Color Palette (HEX codes — copy-paste ready)

### Backgrounds
| Token | Hex | Usage |
|---|---|---|
| `background` | `#0B1014` | App root background (deep obsidian) |
| `card` | `#11161E` | Primary card surfaces |
| `card2` | `#161D27` | Elevated/nested cards |
| `secondary` / `muted` / `input` | `#161D27` | Inputs, chips, subtle surfaces |

### Text
| Token | Hex | Usage |
|---|---|---|
| `foreground` / `text` | `#F9FAFB` | Primary text (white-ish) |
| `textSecondary` | `#8B95A7` | Subtitles, labels |
| `textMuted` | `#5A6378` | Captions, tiny labels |

### Borders
| Token | RGBA | Usage |
|---|---|---|
| `border` | `rgba(148, 163, 184, 0.10)` | Default card border |
| `borderBright` | `rgba(148, 163, 184, 0.20)` | Hover/active border |

### Brand & accents
| Token | Hex | Usage |
|---|---|---|
| `primary` / `brandMid` | `#8B5CF6` | Primary buttons, focus |
| `brandStart` / `blue` / `accent` | `#3B82F6` | Info, links |
| `blueLight` | `#60A5FA` | Sparklines, highlights |
| `purple` | `#A855F7` | Bot strategy "trend" |
| `pink` / `brandEnd` | `#EC4899` | Bot strategy "scalp", brand end |
| `gold` | `#A855F7` | VIP tier accents |

### Semantic
| Token | Hex | Usage |
|---|---|---|
| `green` | `#22C55E` | Profit, success, "BUY" |
| `greenLight` | `#4ADE80` | Soft success |
| `red` / `destructive` | `#EF4444` | Loss, error, "SELL" |
| `orange` / `yellow` | `#F59E0B` | Warning, pending |

### Utilities
- **Border radius (default):** `12px` — applies to cards, buttons, inputs
- **Pill / chip radius:** `999px` (fully round)
- **Modal sheet radius:** `24px` top corners only

---

## 3. Spacing & Layout

- **Base unit:** `4px` (use multiples: 4, 8, 12, 16, 20, 24, 32)
- **Screen horizontal padding:** `16px`
- **Card padding:** `16px` (compact) or `20px` (hero cards)
- **Card-to-card gap:** `12px`
- **Bottom-tab height:** `64px` + safe-area inset
- **Top header:** `~67px` from safe-area top (web) or `16px` padding (native)

---

## 4. Typography Scale

| Style | Size | Weight | Line height | Usage |
|---|---|---|---|---|
| Display | 32-36px | 800 | 1.2 | Balance hero, NAV |
| H1 | 24px | 700 | 1.3 | Screen titles |
| H2 | 20px | 600 | 1.3 | Card titles |
| Body | 14-15px | 500 | 1.5 | Default text |
| Label | 11-12px | 600 (uppercase, +0.5 letter-spacing) | 1.2 | Section labels |
| Caption | 10-11px | 500 | 1.3 | Footer, metadata |

---

## 5. Components

### Button (primary)
- Height: `48px`
- Background: brand gradient (blue → purple → pink)
- Text: `#FFFFFF`, weight 600, size 15px
- Border radius: `12px`
- Active state: scale `0.98` + opacity `0.94`
- Haptic: medium impact on press

### Button (secondary / ghost)
- Background: `rgba(139, 92, 246, 0.12)`
- Border: `1px solid rgba(139, 92, 246, 0.4)`
- Text: `#8B5CF6`, weight 600

### Input
- Height: `48px`
- Background: `#161D27`
- Border: `1px solid rgba(148,163,184,0.10)`
- Focus border: `#8B5CF6`
- Padding: `12px 16px`
- Text: `#F9FAFB`, placeholder `#5A6378`

### Card (default)
```
background: #11161E
border: 1px solid rgba(148,163,184,0.10)
border-radius: 12px
padding: 16px
shadow: 0 4px 12px rgba(0,0,0,0.3)
```

### Card (hero / NAV)
```
background: #0E141C
border: 1px solid rgba(255,255,255,0.07)
border-radius: 16px
top accent bar: 2px linear-gradient(blue → purple → pink)
inner glow: 80px radial blur of accent color, 8% opacity, top-right corner
```

### Pill / Chip
- Height: `24-28px`
- Border radius: `999px`
- Padding: `4px 10px`
- Background: accent at 15% opacity (e.g. `rgba(34,197,94,0.15)` for green)
- Border: accent at 35% opacity
- Text: accent color, size 10-11px, weight 600, uppercase

### LIVE indicator
- Pill shape with green pulsing dot (`#22C55E`, 6px diameter)
- Text "LIVE" in green, 10px, uppercase, weight 700

### PnL badge
- Background: green/red at 15% opacity
- Text format: `+₹1,250` or `−₹450` (with arrow icon)

### Bottom Tab Bar
- Height: `64px` + safe-area
- Background: `#11161E` with top border `rgba(148,163,184,0.10)`
- 4 tabs: Home, Trade, Wallet, Profile
- Active icon: `#8B5CF6` (primary purple)
- Inactive icon: `#5A6378`
- Active label: weight 600, size 11px

---

## 6. Iconography

- **Library used:** Feather Icons (https://feathericons.com)
- **Default size:** `16px` (inline), `20px` (buttons), `24px` (tabs)
- **Default color:** `textMuted` `#5A6378`
- **Active color:** matches accent context

For Flutter use **`flutter_feather_icons`** package (1:1 match).

---

## 7. Animations & Motion

- **Library used:** Framer Motion / Reanimated
- **Screen entry:** Fade + slide up `20px`, duration `400ms`, easing `ease-out`
- **List item stagger:** `60ms` delay between items
- **Button press:** scale `1 → 0.98`, opacity `1 → 0.94`, duration `120ms`
- **Sparkline draw:** `1.6px` stroke, animate path length `0 → 1` over `800ms`
- **Tab switch:** instant (no transition)
- **Haptics:** Medium impact on tap, Light on toggle

For Flutter: use `flutter_animate` package + `Haptics` from services.

---

## 8. Screen Inventory (with route paths)

### Bottom-tab screens (`app/(tabs)/`)
| Screen | Route | Purpose |
|---|---|---|
| Home | `/` | Dashboard: balance hero, daily P&L, active investment, quick actions |
| Trades | `/trades` | Bot picker + per-bot trade history with filters |
| Wallet | `/wallet` | Main/Trading/Profit balances + transaction list |
| Profile | `/profile` | Account, KYC, devices, settings, logout |
| Terminal | `/terminal` | Live trading terminal (animated bot activity) |

### Auth flow (`app/(auth)/`)
- `login`, `signup`, `forgot-password`, `verify-otp`

### Money flow
- `/deposit` — method picker (UPI / Net Banking / Crypto)
- `/deposit-upi`, `/deposit-upi-pay`
- `/deposit-netbanking`, `/deposit-netbanking-details`, `/deposit-netbanking-verify`
- `/deposit-crypto` — TRC20 USDT QR + address copy
- `/deposit-success`
- `/withdraw` — method picker
- `/withdraw-bank`, `/withdraw-upi`, `/withdraw-crypto`, `/withdraw-success`
- `/transfer` — between main / trading / profit balances

### Investment
- `/deploy` — bot deploy form (amount + risk select)
- `/risk-select` — 3% / 5% / 10% drawdown
- `/income` — earnings breakdown (daily / referral / VIP bonus)

### Account / security
- `/kyc` — status + flow
- `/kyc-submit` — document upload form
- `/devices` — logged-in devices list
- `/two-factor` — 2FA setup with QR + backup codes
- `/change-password`
- `/add-bank` — bank account form
- `/notifications` — notification list
- `/transaction-history`

---

## 9. Bot Strategies (4 fixed)

| ID | Name | Accent | Returns | Description |
|---|---|---|---|---|
| `trend` | Trend-following Bot | `#A855F7` purple | +17% | Momentum |
| `arbitrage` | Arbitrage Bot | `#3B82F6` blue | +12% | Spread |
| `scalp` | Scalping Bot | `#EC4899` pink | +9% | HFT |
| `grid` | Grid Trading Bot | `#22C55E` green | +14% | Range |

Each bot card shows: AUM (e.g. ₹4.8 Cr), investors count, win rate %, avg monthly return, sparkline chart.

---

## 10. Risk Levels

| Level | Drawdown limit | Color |
|---|---|---|
| Conservative | 3% | green `#22C55E` |
| Moderate | 5% | gold `#A855F7` |
| Aggressive | 10% | red `#EF4444` |

---

## 11. VIP Tiers

| Tier | Min amount | Color |
|---|---|---|
| None | $0 | grey |
| Silver | $500 | `#94A3B8` |
| Gold | $1,000 | `#F59E0B` |
| Platinum | $5,000 | `#A855F7` (gradient) |

VIP perks shown as chip on profile screen + dashboard.

---

## 12. Currency Display

- **Internal currency:** USDT (USD Tether)
- **Display currency:** INR (₹)
- **FX rate (hardcoded constant):** `1 USDT = 83.5 INR` — see `lib/tx-mapper.ts`
- **Format:** `₹1,250` (no decimals for whole rupees), `₹1,250.45` (with decimals when needed)
- Use Indian number system: `1,00,000` not `100,000`

---

## 13. Empty / Loading / Error States

### Loading
- Skeleton shimmer on cards (background `#161D27`, shimmer overlay `rgba(255,255,255,0.04)`)
- Animation: 1.5s left-to-right loop

### Empty
- Centered icon (Feather, 48px, `#5A6378`)
- Title (`#F9FAFB`, weight 600, 16px)
- Subtitle (`#8B95A7`, 13px)
- Optional CTA button (primary)

### Error
- Title: "Something went wrong"
- Subtitle: "Please reload the app to continue."
- "Try Again" button (purple `#8B5CF6` background, white text)

---

## 14. Reference Assets

- **Demo APK:** install on Android, all screens populated with dummy data
- **Web counterpart:** https://qorixmarkets.com (same color tokens, same screens)
- **Icon library:** Feather Icons → `flutter_feather_icons`
- **Source colors file:** `artifacts/qorix-mobile/constants/colors.ts`
- **Source bot strategies:** `artifacts/qorix-mobile/constants/bots.ts`

---

## 15. Flutter Package Recommendations

| React Native package | Flutter equivalent |
|---|---|
| `react-native-reanimated` | `flutter_animate` |
| `expo-linear-gradient` | `flutter` built-in `LinearGradient` |
| `@expo/vector-icons` (Feather) | `flutter_feather_icons` |
| `expo-haptics` | `haptic_feedback` |
| `react-native-qrcode-svg` | `qr_flutter` |
| `react-native-svg` | `flutter_svg` |
| `expo-router` | `go_router` |
| `@tanstack/react-query` | `dio` + `flutter_riverpod` |
| `framer-motion` | `flutter_animate` + `Hero` widget |

---

## 16. Visual Hierarchy Rules

1. **One hero element per screen** — usually the balance/NAV card at top
2. **Three accent colors max per screen** — avoid rainbow
3. **Glow effects sparingly** — only on primary CTAs and active states
4. **Numbers prominent** — use larger weight (700-800) for monetary values
5. **Labels small & uppercase** — section headers as `text-xs uppercase tracking-wide`
6. **Borders soft** — never pure white/black, always `rgba(148,163,184, 0.10–0.20)`

---

**Questions during build?** Refer to demo APK first — what you see is the source of truth.
