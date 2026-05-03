# Styles

Global CSS stylesheets for the renderer.

## Purpose

Houses global CSS applied to the entire application. These styles set baseline typography, font stacks, and smoothing for all pages and components.

## Key Files

- `globals.css` — Global CSS reset and typography defaults. Applied via import in `main.tsx`.

## Architecture & Patterns

**Global First**
- Single global stylesheet with no scoping
- System font stack for cross-platform compatibility
- Font smoothing enabled for macOS and Linux

**No CSS-in-JS**
- Plain CSS files, no PostCSS, no SASS
- Works alongside component-scoped CSS (e.g., App.css)

## Gotchas & Notes

**Bare Minimum**
- Only sets `body` and `code` styles
- Component-level styles (App.css, future component CSS files) override or extend these globals
- No CSS reset framework (normalize.css, reset.css); uses minimal inline rules
