# AuTuber Frontend Engineering Values

This document outlines the core principles, styling guidelines, and component architecture for the AuTuber desktop application interface.

## 1. Core Philosophy: The "Utility App" Aesthetic

AuTuber is primarily a **background agent**. The UI exists only for configuration, monitoring, and manual overrides.

* **Do not build a SaaS dashboard.** Avoid heavy sidebars, excessive charting, or distracting backgrounds.

* **Prioritize density and clarity.** Information should be readable at a glance.

* **Unobtrusive presence.** The app should feel native, lightweight, and fast, using a clean, light theme that doesn't distract the streamer.

## 2. Tech Stack

* **Framework:** React 19 (via Vite)

* **Styling:** Tailwind CSS

* **Icons:** `lucide-react`

* **Environment:** Electron Renderer Process

## 3. Tailwind CSS Styling Guidelines

We rely strictly on Tailwind utility classes for styling. Do not write custom CSS unless absolutely necessary for complex animations not supported by Tailwind.

### Color Palette

The Electron renderer uses the Sakura Candy Pop palette with light neutral surfaces and pastel accents.

* **Backgrounds:** `#FFF7FB` for the app background, `#FFFFFF` / soft white tints for cards and foreground elements.

* **Text:** `#2A2A2A` for primary text, `#6B7280` for secondary/descriptions.

* **Borders:** `#FFD6E7` and `#F0F2F5` for structural separation.

* **Primary Brand/Action:** `#FF8DB8` for brand actions, with `#FF7DAF` on hover.

* **Interaction/Focus:** `#7EE9F3` for rings, selection, and interactive emphasis.

* **Semantic Status Colors:**

  * **Success/Connected:** mint-tinted surfaces with neutral text

  * **Warning/Working:** peach or yellow highlights with neutral text

  * **Error/Disconnected:** rose or coral highlights with neutral text

### Typography

* Use `Space Grotesk` for the main renderer shell and `IBM Plex Mono` for logs, raw data, and compact technical fields.

* Maintain clear hierarchy:

  * **App Header:** `text-lg font-bold`

  * **Card Titles:** `text-sm font-semibold`

  * **Standard Text:** `text-sm`

  * **Metadata/Labels:** `text-xs font-medium` or `text-xs font-bold uppercase tracking-wider`

* **Logs/Code:** Always use `font-mono text-[11px]` or `text-xs` for log outputs and raw data to ensure neat formatting.

### Borders, Shadows & Radii

* **Cards & Modals:** `rounded-xl` or `rounded-2xl` with a subtle tinted shadow and a light border.

* **Buttons & Inputs:** `rounded-lg` or `rounded-md`.

* **Hover States:** Always include `transition-colors` or `transition-all`. Use soft pink or lavender hover tints to provide physical feedback.

### Example Card Structure

```jsx
<div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
  <div className="flex justify-between items-start mb-4">
    {/* Header Content */}
  </div>
  {/* Body Content */}
</div>
