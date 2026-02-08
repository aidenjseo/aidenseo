# Project Overview: aidenseo.com

## What This Is

Aiden Seo's personal portfolio/brand website -- a static site built with Eleventy (11ty). Features a hero section with the name "aidenseo" in large typography, a Korean name overlay, and a rotating RNA sequence animation system.

## Tech Stack

- **Eleventy v3.1.2** - Static site generator
- **Nunjucks** - Templating
- **Anime.js v4.2.2** - Animation library
- **Vanilla JS (ES6 modules)** - No frameworks
- **CSS3** - Custom properties, flexbox, 3D transforms, clamp()
- **IBM Plex** font family (Google Fonts) - Sans, Serif, Mono, Condensed + international variants
- **npm** - Package manager

## Directory Structure

```
/
├── .eleventy.js          # Eleventy config
├── package.json
├── src/
│   ├── index.md          # Homepage (hero + RNA animation)
│   ├── _data/
│   │   ├── site.json     # Site metadata (title, author, year)
│   │   └── rnaSequences.json  # 6 RNA sequences with personal descriptors
│   ├── _includes/
│   │   ├── base.njk      # Base HTML layout
│   │   └── javascript/
│   │       └── rna-scripts.njk  # Script loader for RNA animation
│   └── assets/
│       ├── css/
│       │   └── style.css       # Main stylesheet (~433 lines)
│       ├── js/
│       │   ├── rna.js          # RNA animation logic (~239 lines)
│       │   ├── anime.js        # Animation wrapper
│       │   └── vendor/
│       │       └── anime.esm.js  # Anime.js v4.2.2 ESM
└── _site/                # Build output
```

## Key Features

1. **Hero Section** - Oversized "aidenseo" typography with Korean name overlay, responsive via clamp()
2. **RNA Sequence Animation** - Rotating display of RNA genetic sequences with personal descriptors:
   - Computational biology researcher @ CU Anschutz
   - Participant of YLC @ Jeffco
   - Junior @ Chatfield HS
   - Writer & poet @ aidenseo.com
   - Youth group member @ KCC
   - Watercolor & acrylic artist
3. **Navigation** - Fixed header with links to about, works, archive + LinkedIn/email

## Animation System

The RNA animation (`rna.js`) follows a lifecycle: init -> prepare -> animate -> swap.

- Timeline-based with Anime.js (sliding, scaling, wave effects)
- State managed via `isAnimating` flag
- Element pooling (activeLine/nextLine swap) to avoid reflows
- 3D transforms with perspective for GPU acceleration

## CSS Architecture

- Custom properties for spacing, colors, offsets
- Responsive breakpoints: 1000px, 720px, 450px
- Color scheme: Green (#008500), Pink (#850085), White (#fcfcfc), Black (#111111)
- `will-change` hints for animation performance

## Build & Run

```bash
npm install
npx @11ty/eleventy --serve   # Dev server
npx @11ty/eleventy           # Build to _site/
```
