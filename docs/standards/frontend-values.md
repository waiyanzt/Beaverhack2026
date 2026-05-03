# AuTuber Frontend Engineering Values

This document outlines the core principles, styling guidelines, and component architecture for the AuTuber desktop application interface.

## 1. Core Philosophy: The "Utility App" Aesthetic

AuTuber is primarily a **background agent**. The UI exists only for configuration, monitoring, and manual overrides.

* **Do not build a SaaS dashboard.** Avoid heavy sidebars, excessive charting, or distracting backgrounds.

* **Prioritize density and clarity.** Information should be readable at a glance.

* **Unobtrusive presence.** The app should feel native, lightweight, and fast, utilizing a clean, light theme that doesn't distract the streamer.

## 2. Tech Stack

* **Framework:** React 19 (via Vite)

* **Styling:** Tailwind CSS

* **Icons:** `lucide-react`

* **Environment:** Electron Renderer Process

## 3. Tailwind CSS Styling Guidelines

We rely strictly on Tailwind utility classes for styling. Do not write custom CSS unless absolutely necessary for complex animations not supported by Tailwind.

### Color Palette

We use the default Tailwind color palette, heavily leaning on `slate` for our neutral structure.

* **Backgrounds:** `bg-slate-50` for the app background, `bg-white` for cards and foreground elements.

* **Text:** `text-slate-800` or `text-slate-900` for primary text, `text-slate-500` for secondary/descriptions.

* **Borders:** `border-slate-200` for structural separation.

* **Primary Brand/Action:** `blue` (e.g., `bg-blue-600`, `text-blue-700`).

* **Semantic Status Colors:**

  * **Success/Connected:** `emerald` (`bg-emerald-50`, `text-emerald-600`)

  * **Warning/Working:** `amber` (`text-amber-600`, `bg-amber-400 animate-pulse`)

  * **Error/Disconnected:** `rose` (`text-rose-500`)

### Typography

* Use the default sans-serif stack.

* Maintain clear hierarchy:

  * **App Header:** `text-lg font-bold`

  * **Card Titles:** `text-sm font-semibold`

  * **Standard Text:** `text-sm`

  * **Metadata/Labels:** `text-xs font-medium` or `text-xs font-bold uppercase tracking-wider`

* **Logs/Code:** Always use `font-mono text-[11px]` or `text-xs` for log outputs and raw data to ensure neat formatting.

### Borders, Shadows & Radii

* **Cards & Modals:** `rounded-xl` or `rounded-2xl` with a subtle `shadow-sm` and `border border-slate-200`.

* **Buttons & Inputs:** `rounded-lg` or `rounded-md`.

* **Hover States:** Always include `transition-colors` or `transition-all`. Use `hover:bg-slate-50` or `hover:shadow-md` to provide physical feedback to the user.

### Example Card Structure

```jsx
<div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
  <div className="flex justify-between items-start mb-4">
    {/* Header Content */}
  </div>
  {/* Body Content */}
</div>