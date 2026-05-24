# Qorix Markets — Mobile UI Design System

> Optimized for Flutter implementation

---

## 1. Brand Identity

**Brand Name:** Qorix Markets  
**Tagline:** Automated Trading. Real Results. Zero Manual Effort.  
**Design Language:** Premium dark fintech — glassmorphism, electric glow, obsidian surfaces  
**Inspiration:** Binance dark mode + Robinhood premium + Bloomberg terminal

---

## 2. Color System

### Core Palette (Flutter `Color` values)

```dart
// lib/core/theme/colors.dart

class QorixColors {
  // ─── Backgrounds ───────────────────────────────────────
  static const Color background    = Color(0xFF0B1014); // Deep obsidian
  static const Color card          = Color(0xFF11161E); // Card surface
  static const Color cardElevated  = Color(0xFF161D28); // Raised card
  static const Color input         = Color(0xFF0F1823); // Input fields
  static const Color secondary     = Color(0xFF1A2332); // Secondary bg

  // ─── Borders ───────────────────────────────────────────
  static const Color border        = Color(0x1A94A3B8); // 10% slate-400
  static const Color borderBright  = Color(0x26FFFFFF); // 15% white

  // ─── Text ──────────────────────────────────────────────
  static const Color foreground     = Color(0xFFF9FAFB); // Primary text
  static const Color textSecondary  = Color(0xFF94A3B8); // Subtitle
  static const Color textMuted      = Color(0xFF475569); // Hint/disabled

  // ─── Brand Accents ─────────────────────────────────────
  static const Color blue          = Color(0xFF3B82F6); // Electric blue (web)
  static const Color purple        = Color(0xFF8B5CF6); // Brand purple (mobile)
  static const Color purpleLight   = Color(0xFFA78BFA); // Purple lighter
  static const Color pink          = Color(0xFFEC4899); // Accent pink

  // ─── Semantic ──────────────────────────────────────────
  static const Color green         = Color(0xFF22C55E); // Profit / success
  static const Color greenDark     = Color(0xFF16A34A); // Darker green
  static const Color red           = Color(0xFFEF4444); // Loss / error
  static const Color orange        = Color(0xFFF59E0B); // Warning / VIP gold
  static const Color gold          = Color(0xFFEAB308); // Premium gold
  static const Color amber         = Color(0xFFF59E0B); // USDT wallet accent

  // ─── Primary CTA ───────────────────────────────────────
  static const Color primary            = purple;
  static const Color primaryForeground  = Color(0xFFFFFFFF);
}
```

### Gradient System

```dart
// ─── Brand gradient (header, CTA buttons) ──────────────────
static const LinearGradient brandGradient = LinearGradient(
  begin: Alignment.centerLeft,
  end: Alignment.centerRight,
  colors: [Color(0xFF3B82F6), Color(0xFF8B5CF6), Color(0xFFEC4899)],
  stops: [0.0, 0.5, 1.0],
);

// ─── Profit (green glow card) ───────────────────────────────
static const LinearGradient profitGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF22C55E), Color(0xFF16A34A)],
);

// ─── Card glass surface ─────────────────────────────────────
static const LinearGradient glassGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0x0FFFFFFF), Color(0x05FFFFFF)],
);

// ─── Deep card (premium sections) ──────────────────────────
static const LinearGradient deepCardGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF0F1823), Color(0xFF0B1219)],
);
```

---

## 3. Typography

### Font Recommendation for Flutter
**Primary:** `Inter` (Google Fonts)  
**Monospace (prices/numbers):** `Space Mono` or `JetBrains Mono`

```yaml
# pubspec.yaml
fonts:
  - family: Inter
    fonts:
      - asset: fonts/Inter-Regular.ttf    # weight: 400
      - asset: fonts/Inter-Medium.ttf     # weight: 500
      - asset: fonts/Inter-SemiBold.ttf   # weight: 600
      - asset: fonts/Inter-Bold.ttf       # weight: 700
      - asset: fonts/Inter-ExtraBold.ttf  # weight: 800
```

### Type Scale

```dart
class QorixTextStyles {
  // ─── Display ──────────────────────────────────────
  static const TextStyle display = TextStyle(
    fontFamily: 'Inter',
    fontSize: 36,
    fontWeight: FontWeight.w800,
    color: QorixColors.foreground,
    letterSpacing: -0.5,
  );

  // ─── Headings ─────────────────────────────────────
  static const TextStyle h1 = TextStyle(
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: FontWeight.w700,
    color: QorixColors.foreground,
    letterSpacing: -0.3,
  );

  static const TextStyle h2 = TextStyle(
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: FontWeight.w700,
    color: QorixColors.foreground,
  );

  static const TextStyle h3 = TextStyle(
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: QorixColors.foreground,
  );

  // ─── Body ─────────────────────────────────────────
  static const TextStyle bodyLarge = TextStyle(
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: FontWeight.w500,
    color: QorixColors.foreground,
    height: 1.5,
  );

  static const TextStyle body = TextStyle(
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: QorixColors.foreground,
    height: 1.5,
  );

  static const TextStyle bodySmall = TextStyle(
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: QorixColors.textSecondary,
    height: 1.5,
  );

  // ─── Labels ───────────────────────────────────────
  static const TextStyle label = TextStyle(
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: QorixColors.textSecondary,
    letterSpacing: 0.3,
  );

  static const TextStyle labelSmall = TextStyle(
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: FontWeight.w700,
    color: QorixColors.textMuted,
    letterSpacing: 1.2,
  );

  // ─── Numbers / Prices ─────────────────────────────
  static const TextStyle priceXL = TextStyle(
    fontFamily: 'Space Mono',
    fontSize: 32,
    fontWeight: FontWeight.w700,
    color: QorixColors.foreground,
    letterSpacing: -0.5,
  );

  static const TextStyle priceLarge = TextStyle(
    fontFamily: 'Space Mono',
    fontSize: 22,
    fontWeight: FontWeight.w700,
    color: QorixColors.foreground,
  );

  static const TextStyle price = TextStyle(
    fontFamily: 'Space Mono',
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: QorixColors.foreground,
  );

  // ─── Buttons ──────────────────────────────────────
  static const TextStyle buttonLarge = TextStyle(
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.3,
    color: Colors.white,
  );

  static const TextStyle button = TextStyle(
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.3,
    color: Colors.white,
  );
}
```

---

## 4. Spacing System

Base unit: **4px**

```dart
class QorixSpacing {
  static const double xs  = 4.0;   // 1 unit
  static const double sm  = 8.0;   // 2 units
  static const double md  = 12.0;  // 3 units
  static const double base= 16.0;  // 4 units — screen padding
  static const double lg  = 20.0;  // 5 units
  static const double xl  = 24.0;  // 6 units
  static const double xxl = 32.0;  // 8 units
  static const double xxxl= 48.0;  // 12 units

  // Screen-level padding
  static const EdgeInsets screen = EdgeInsets.symmetric(horizontal: 16.0);
  static const EdgeInsets card   = EdgeInsets.all(16.0);
  static const EdgeInsets cardSm = EdgeInsets.all(12.0);
}
```

---

## 5. Border Radius System

```dart
class QorixRadius {
  static const double sm    = 8.0;
  static const double md    = 10.0;
  static const double base  = 12.0;  // Default cards, buttons
  static const double lg    = 16.0;  // Hero cards
  static const double xl    = 20.0;  // Bottom sheets
  static const double xxl   = 24.0;  // Large panels
  static const double pill  = 999.0; // Badges, tags

  static const BorderRadius smAll   = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius mdAll   = BorderRadius.all(Radius.circular(md));
  static const BorderRadius baseAll = BorderRadius.all(Radius.circular(base));
  static const BorderRadius lgAll   = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius pillAll = BorderRadius.all(Radius.circular(pill));
}
```

---

## 6. Glassmorphism — Flutter Implementation

```dart
// lib/shared/widgets/glass_card.dart

class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets? padding;
  final double borderRadius;
  final Color? borderColor;

  const GlassCard({
    required this.child,
    this.padding,
    this.borderRadius = 12.0,
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: padding ?? const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0x0FFFFFFF),  // rgba(255,255,255,0.06)
                Color(0x05FFFFFF),  // rgba(255,255,255,0.02)
              ],
            ),
            borderRadius: BorderRadius.circular(borderRadius),
            border: Border.all(
              color: borderColor ?? const Color(0x1AFFFFFF), // 10% white
              width: 1.0,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}
```

---

## 7. Shadow & Glow Effects

```dart
class QorixShadows {
  // Standard card shadow
  static const List<BoxShadow> card = [
    BoxShadow(
      color: Color(0x4D000000),  // rgba(0,0,0,0.30)
      blurRadius: 12,
      offset: Offset(0, 4),
    ),
  ];

  // Blue glow (primary actions)
  static const List<BoxShadow> blueGlow = [
    BoxShadow(
      color: Color(0x1F3B82F6),  // rgba(59,130,246,0.12)
      blurRadius: 30,
      spreadRadius: 0,
    ),
  ];

  // Green glow (profit / success)
  static const List<BoxShadow> greenGlow = [
    BoxShadow(
      color: Color(0x8C10B981),  // rgba(16,185,129,0.55)
      blurRadius: 14,
      spreadRadius: -2,
    ),
  ];

  // Purple glow (brand accent)
  static const List<BoxShadow> purpleGlow = [
    BoxShadow(
      color: Color(0x338B5CF6),  // rgba(139,92,246,0.20)
      blurRadius: 20,
      spreadRadius: -4,
    ),
  ];

  // Button press glow
  static const List<BoxShadow> buttonGlow = [
    BoxShadow(
      color: Color(0x668B5CF6),  // rgba(139,92,246,0.40)
      blurRadius: 16,
      spreadRadius: -4,
    ),
  ];
}
```

---

## 8. Component Specifications

### Primary Button

```dart
// Height: 56px | Radius: 12px | Purple gradient fill
Container(
  height: 56,
  decoration: BoxDecoration(
    borderRadius: BorderRadius.circular(12),
    gradient: const LinearGradient(
      colors: [Color(0xFF7C3AED), Color(0xFF8B5CF6)],
    ),
    boxShadow: QorixShadows.purpleGlow,
  ),
  child: Material(
    color: Colors.transparent,
    child: InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onPressed,
      child: Center(
        child: Text(label, style: QorixTextStyles.buttonLarge),
      ),
    ),
  ),
)
```

### Balance Card (Main Wallet Card)

```dart
// Purple-tinted glass card with large balance display
// Border: 1.5px purple when active, 1px border when idle
// Show balance / Hide (eye toggle)
// Buttons: Deposit | Withdraw | Transfer (3 action row)
// Colors: background = card, accent = purple
// PnL: green for positive, red for negative
```

### Balance Breakdown Tiles (4-grid)

```dart
// 2x2 grid of stat tiles
// Tile 1: Main INR (icon: trending-up, color: foreground)
// Tile 2: USDT Wallet (icon: zap, color: amber/orange)
// Tile 3: Funding/Trading (icon: briefcase, color: blue)
// Tile 4: Profit (icon: activity, color: green)
// Each tile: label (uppercase 10px) + value + border accent line
```

### Transaction Item

```dart
// Left: Icon circle (color by type) + title + description
// Right: ±amount (green=credit, red=debit) + status badge
// Types → icon mapping:
//   deposit    → arrow-down-circle (green)
//   withdrawal → arrow-up-circle (red/orange)
//   profit     → trending-up (green)
//   transfer   → refresh-cw (blue)
//   fee        → minus-circle (gray)
```

### Trade Item

```dart
// Left: Symbol badge + direction (BUY=green, SELL=red)
// Center: Entry → Exit price
// Right: PnL amount (green/red) + percentage
// Asset class badge: equity/fno/crypto (different colors)
```

### Input Field

```dart
// Background: input color (0xFF0F1823)
// Border: border color default, purple on focus
// Height: 52-56px
// Radius: 12px
// Font: Inter Medium 14px
// Prefix icon inside left edge
```

### Status Badge / Pill

```dart
// Padding: horizontal 8px, vertical 3px
// Radius: 999 (pill)
// completed  → green bg + text
// pending    → orange bg + text
// failed     → red bg + text
// Font: 10px bold uppercase
```

---

## 9. Animation Guidelines

### Timing Constants

```dart
class QorixAnimations {
  static const Duration fast    = Duration(milliseconds: 200);
  static const Duration normal  = Duration(milliseconds: 300);
  static const Duration slow    = Duration(milliseconds: 500);
  static const Duration page    = Duration(milliseconds: 400);

  // Stagger delay between list items
  static const Duration stagger = Duration(milliseconds: 50);
}
```

### Screen Entry
- All screens: `FadeInDown` from 20px above, 400ms
- List items: staggered `FadeInDown` with 50ms delay each
- Modals: `SlideTransition` from bottom

### Price Tick Animation
- On price update: flash `foreground` → `green`/`red` → back in 700ms
- Use `AnimatedSwitcher` with custom `CrossFadeState`

### Number Counter
- Animate from old value to new value on wallet balance update
- Duration: 800ms, curve: `Curves.easeOutCubic`

### Skeleton Loading
- Use `shimmer` package
- Base: `card` color, highlight: slightly lighter card
- All list items, balance cards, charts

---

## 10. Bottom Navigation Bar

```dart
// Height: 72px + bottom safe area
// Background: card color with top border
// 5 items: Home, Trades, Wallet, P2P, Profile
// Active: purple icon + label
// Inactive: textMuted icon, no label
// Badge: red dot for notifications (top-right of bell icon)
// Special center button (Wallet): larger, slightly elevated — optional
```

---

## 11. Chart Specifications

### Equity Curve
- Type: Area chart (filled below line)
- Line color: `green` (#22C55E)
- Fill: linear gradient, `green` at top → transparent
- X-axis: date labels (skip intermediate)
- Y-axis: $ values
- Touch: vertical crosshair + tooltip
- Package: `fl_chart` (`LineChart`)

### Daily PnL Bars
- Type: Bar chart
- Positive bars: green with 30% opacity fill
- Negative bars: red with 30% opacity fill
- Bar width: responsive to count
- Package: `fl_chart` (`BarChart`)

### Candlestick (Terminal)
- Custom painter or `k_chart` package
- Dark background, green candles up, red candles down
- Volume bars below in muted colors

---

## 12. Icons

Use `Feather Icons` (matching existing mobile app) or `Lucide`:
- Flutter package: `feather_icons` or `lucide_flutter`

Key icon mappings:
```
dashboard  → home
wallet     → credit-card  
trades     → activity
p2p        → repeat
profile    → user
deposit    → arrow-down-circle
withdraw   → arrow-up-circle
transfer   → refresh-cw
profit     → trending-up
settings   → settings
logout     → log-out
kyc        → shield
2fa        → lock
devices    → smartphone
referral   → users
```

---

## 13. Theme Configuration (Flutter ThemeData)

```dart
ThemeData(
  brightness: Brightness.dark,
  scaffoldBackgroundColor: QorixColors.background,
  cardColor: QorixColors.card,
  fontFamily: 'Inter',
  colorScheme: ColorScheme.dark(
    primary: QorixColors.purple,
    secondary: QorixColors.blue,
    surface: QorixColors.card,
    background: QorixColors.background,
    error: QorixColors.red,
    onPrimary: Colors.white,
    onSurface: QorixColors.foreground,
    onBackground: QorixColors.foreground,
  ),
  appBarTheme: AppBarTheme(
    backgroundColor: QorixColors.background,
    elevation: 0,
    iconTheme: IconThemeData(color: QorixColors.foreground),
    titleTextStyle: QorixTextStyles.h2,
  ),
  dividerTheme: DividerThemeData(
    color: QorixColors.border,
    thickness: 1,
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: QorixColors.input,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: QorixColors.border),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: QorixColors.purple, width: 1.5),
    ),
    hintStyle: QorixTextStyles.body.copyWith(color: QorixColors.textMuted),
    contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
  ),
)
```
