# Content Alignment System

## Overview

All content pages automatically align with the navbar title's left edge using CSS custom properties.

## Default Behavior

Content will align with the centered title in the navbar automatically when using:
- `poem.njk` layout
- `content-aligned.njk` layout

## Customizing Title Width

If the default alignment looks off (title is very short or long), add `titleWidthOverride` to your front matter:

```yaml
---
title: Art
titleWidthOverride: 80
layout: poem.njk
---
```

### Estimating Title Width

Quick guide for different title lengths:
- Very short (< 8 chars): 80-100px
- Short (8-12 chars): 120-140px
- Medium (12-18 chars): 160-200px
- Long (18-25 chars): 220-260px
- Very long (> 25 chars): 280-320px

## CSS Variables

The system uses these CSS custom properties (defined in `style.css`):

- `--nav-brand-width`: Width of the "aidenseo" brand section
- `--nav-title-column-width`: Width available for the title
- `--title-width`: Estimated width of the title text (default: 180px)
- `--content-align-left`: Calculated left margin for aligned content

## Creating New Layouts

To align content with the title in a custom layout:

```html
<article class="content-title-aligned">
  {{ content | safe }}
</article>
```

## Mobile Behavior

On screens < 450px:
- Title is hidden in navbar
- Content becomes full-width (alignment is disabled)
- Padding is applied via `--page-pad`
