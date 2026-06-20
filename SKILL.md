---
name: a11y-delta-auditor
description: >-
  Accessibility audit delta — surfaces only new axe-core WCAG violations
  introduced since the last baseline, not pre-existing issues. Use when adding
  UI features and needing to gate CI on net-new accessibility regressions without
  blocking on inherited technical debt. Also triggers on: EAA compliance,
  WCAG 2.1/2.2, accessibility testing, axe, Playwright a11y.
license: MIT
---

# A11y Delta Auditor

Catch only the accessibility violations you introduced — not the ones you inherited.
