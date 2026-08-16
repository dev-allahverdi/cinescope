---
name: CineScope
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#3a393a'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e5e2e3'
  on-surface-variant: '#e9bcb6'
  inverse-surface: '#e5e2e3'
  inverse-on-surface: '#313031'
  outline: '#af8782'
  outline-variant: '#5e3f3b'
  surface-tint: '#ffb4aa'
  primary: '#ffb4aa'
  on-primary: '#690003'
  primary-container: '#e50914'
  on-primary-container: '#fff7f6'
  inverse-primary: '#c0000c'
  secondary: '#c8c6c8'
  on-secondary: '#303032'
  secondary-container: '#474649'
  on-secondary-container: '#b6b4b7'
  tertiary: '#a7c8ff'
  on-tertiary: '#003061'
  tertiary-container: '#0072d7'
  on-tertiary-container: '#f8f9ff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad5'
  primary-fixed-dim: '#ffb4aa'
  on-primary-fixed: '#410001'
  on-primary-fixed-variant: '#930007'
  secondary-fixed: '#e4e2e4'
  secondary-fixed-dim: '#c8c6c8'
  on-secondary-fixed: '#1b1b1d'
  on-secondary-fixed-variant: '#474649'
  tertiary-fixed: '#d5e3ff'
  tertiary-fixed-dim: '#a7c8ff'
  on-tertiary-fixed: '#001b3c'
  on-tertiary-fixed-variant: '#004689'
  background: '#131314'
  on-background: '#e5e2e3'
  surface-variant: '#353436'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

The design system is engineered for a premium, cinematic experience that prioritizes high-fidelity visual content. It evokes the atmosphere of a darkened theater, where the interface recedes to allow the cinematography to take center stage. 

The style is **Modern Corporate with Minimal Glassmorphism**. It utilizes a sophisticated "Dark-First" philosophy, focusing on depth through tonal layering rather than traditional heavy drop shadows. The aesthetic is professional, reliable, and immersive, targeting film enthusiasts who value a clean, distraction-free discovery process. Surface transitions are subtle, using translucent overlays and frosted glass effects to maintain a sense of place within a vast library of media.

## Colors

This design system uses a restrained, high-contrast palette designed for both dark and light environments.

**Dark Mode (Default):**
- **Background:** Primary canvas is `#0a0a0b`, providing a true-black cinematic feel.
- **Surface:** Secondary containers and sections use `#161618`.
- **Elevated:** Cards and floating modals use `#222224`.
- **Accent:** A punchy Crimson (`#e50914`) is used sparingly for critical actions, play buttons, and active indicators.

**Light Mode (Alternative):**
- **Background:** A premium light gray (`#f5f5f7`) replaces the dark background.
- **Surface:** Pure white surfaces are used for cards to maintain a crisp, clean editorial look.
- **Typography:** Shifts to high-contrast dark grays to ensure legibility.

**States:**
- Success and ratings utilize the primary Crimson or a muted gold for awards.
- Borders are kept at low-contrast (`#2d2d30` in dark mode) to define structure without adding visual noise.

## Typography

The design system relies on **Inter** for its systematic, utilitarian, and modern characteristics. The hierarchy is intentionally dramatic to mirror movie posters and editorial film reviews.

- **Display Styles:** Reserved for movie titles and hero section headlines. Use heavy weights (ExtraBold/Black) with tight letter spacing for a high-impact, cinematic feel.
- **Body Styles:** Optimized for readability. Line heights are generous (1.5x) to ensure synopsis text is comfortable to read against dark backgrounds.
- **Label Styles:** All-caps labeling is used for metadata like "GENRE," "RELEASE DATE," or "DIRECTOR" to create a distinct visual texture compared to narrative text.
- **Mobile Scaling:** Large display types scale down significantly on mobile to prevent awkward line breaks while maintaining weight and impact.

## Layout & Spacing

The design system follows a strict **8px spacing grid** to ensure mathematical harmony across all components.

- **Grid System:** Uses a 12-column fluid grid for desktop with 24px gutters. On mobile, the system shifts to a 4-column grid with 16px margins.
- **Content Blocks:** Vertical rhythm is maintained by using 16px (md) and 32px (xl) increments to separate major sections like "Trending Now" and "Recommended for You."
- **Aspect Ratios:** Movie posters must strictly adhere to a 2:3 ratio, while hero backdrops use a 16:9 or 21:9 cinematic ratio to reinforce the platform's purpose.

## Elevation & Depth

This design system avoids heavy, muddy shadows. Instead, it uses **Tonal Layers** and **Minimal Glassmorphism** to convey depth.

- **Level 0 (Base):** The dark background (`#0a0a0b`).
- **Level 1 (Surface):** Content sections slightly lighter than the base.
- **Level 2 (Cards):** Distinct containers using `#222224` with a 1px solid border (`#2d2d30`).
- **Glassmorphism:** Navigation bars and hovering metadata overlays utilize a `20px` backdrop blur with a `10%` white or black tint (depending on mode). This creates a sense of the interface floating above the vibrant movie posters.
- **Selection State:** Active elements may feature a subtle outer glow using a low-opacity version of the Primary Crimson (`#e50914`) to simulate light bleed from a screen.

## Shapes

The shape language is **Soft and Precise**. It rejects the overly playful nature of highly rounded "bubble" UI in favor of a more serious, architectural feel.

- **Standard Components:** Buttons, input fields, and small cards use a **4px (0.25rem)** radius.
- **Large Components:** Large movie posters and hero carousels use an **8px (0.5rem)** radius to soften the massive screen real estate they occupy.
- **Circular Elements:** Profile avatars and "Play" icons within buttons are the only elements allowed to be fully circular.

## Components

- **Buttons:** Primary buttons are solid Crimson (`#e50914`) with white text. Secondary buttons are "Ghost" style with a `#2d2d30` border and a subtle backdrop blur.
- **Movie Cards:** Feature a 2:3 aspect ratio poster. On hover, a gradient overlay appears from the bottom, revealing the title and a "Watchlist" plus-icon.
- **Chips/Tags:** Used for genres (e.g., "Sci-Fi", "Drama"). They feature a dark gray fill with a thin border and no background blur to keep them subordinate to posters.
- **Input Fields:** Minimalist design. A bottom border that transforms into a full Crimson outline only when focused.
- **Progress Bars:** Used for "Continue Watching." A thin 2px bar at the bottom of the card using the Crimson accent.
- **Navigation:** Top-fixed, using the Glassmorphic effect to blur the movie content as it scrolls underneath, maintaining a permanent "Cinema" vibe.