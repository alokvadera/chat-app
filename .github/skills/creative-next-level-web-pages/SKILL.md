---
name: creative-next-level-web-pages
description: 'Design bold, creative, next-level web pages for chat apps and modern products. Use when prompts ask for unique landing pages, hero sections, visual direction, typography systems, motion concepts, or non-generic frontend design.'
argument-hint: 'Page goal + audience + vibe + constraints (e.g., "chat app landing page for Gen Z founders, playful brutalist, mobile-first")'
user-invocable: true
---

# Creative Next-Level Web Pages

## What This Skill Produces
This skill outputs a complete, implementation-ready design workflow for a high-impact web page:
- A distinct visual concept (not template-like)
- A layout and content hierarchy for the target page
- A typography and color token system
- A motion plan with purposeful animation
- Responsive behavior rules for desktop and mobile
- A final quality gate checklist before implementation handoff

## When To Use
Use this skill when the user asks for:
- Creative or "next-level" web page design
- A landing page concept for a chat app or SaaS product
- A non-generic visual direction with strong personality
- UI ideas that should feel intentional, bold, and memorable

Typical triggers:
- `design creative page`
- `next level landing page`
- `make this UI feel unique`
- `fresh hero section for chat app`

## Inputs To Gather First
Collect these inputs up front. If one is missing, make a reasonable default and state it.
1. Page goal: signup, launch waitlist, feature education, pricing conversion, brand awareness
2. Audience: who the page is for and their expectations
3. Brand vibe: examples like cinematic, minimal editorial, playful brutalist, neo-retro tech
4. Constraints: existing design system, deadline, stack, accessibility requirements
5. Content assets: logo, screenshots, product copy, testimonials, illustrations

If style direction is missing, default to: playful brutalist (bold type, high-contrast blocks, energetic composition) and state that assumption explicitly.

## Workflow
1. Define the creative tension
- Frame one contrast that drives the concept (for example: "structured product trust" + "playful social energy").
- Convert that contrast into 3 design adjectives (for example: precise, kinetic, warm).

2. Choose a visual direction
- Propose 2 to 3 distinct concepts with a short name each.
- Always include one playful brutalist option first unless the user specifies another direction.
- For each concept, specify:
  - Core mood
  - Composition style
  - Signature graphic motif
  - Risk level (safe, balanced, bold)
- Select one concept with a short rationale tied to the page goal.

3. Build the page narrative
- Define section order using story flow, not boilerplate:
  - Hero (clear promise)
  - Proof (social or product credibility)
  - Feature storytelling
  - Interaction moment (demo/preview)
  - Primary CTA and reassurance
- Ensure each section has one job and one measurable outcome.

4. Create expressive design tokens
- Define CSS custom properties for:
  - `--color-*` semantic tokens
  - `--font-*` pairings (display/body)
  - `--space-*` rhythm scale
  - `--radius-*` and `--shadow-*`
- Avoid default-font-only direction. Use a purposeful display/body pairing.
- Build a background atmosphere (gradient, mesh, subtle pattern, or geometric layers).

5. Design motion with intent
- Add 2 to 4 meaningful animations only:
  - Page-load reveal sequence
  - Staggered section entrances
  - One signature interaction animation
- Tie each animation to communication purpose, not decoration.
- Respect reduced-motion preference.

6. Make responsiveness first-class
- Define breakpoints and behavior for mobile, tablet, desktop.
- On mobile, prioritize:
  - Headline readability
  - CTA visibility above fold
  - Gesture-safe spacing
  - Animation simplification
- Ensure visual identity survives at small viewport widths.

7. Validate and refine
- Run the quality gate checklist below.
- Remove generic sections or repeated patterns.
- Tighten typography rhythm and contrast balance.

## Decision Branches
1. Existing design system present?
- Yes: preserve core tokens/components, innovate through composition, art direction, and motion.
- No: define a compact token system first, then build layout.

2. Is the page conversion-focused?
- Yes: prioritize copy clarity, proof placement, and CTA hierarchy.
- No: prioritize storytelling, brand world-building, and memorable interaction.

3. Are assets limited?
- Yes: use type-forward design, abstract motifs, and modular cards.
- No: use richer media choreography (screenshots/video snippets/illustration layers).

4. Performance constrained?
- Yes: prefer CSS transforms, gradients, and lightweight SVG motifs.
- No: allow richer effects with strict fallback behavior.

## Quality Gate (Completion Checks)
Treat the output as complete only if all checks pass.
1. Distinctiveness: design does not resemble a default template.
2. Visual hierarchy: key message and CTA are immediately clear.
3. Typography: expressive but readable across breakpoints.
4. Color and contrast: brand-consistent and accessible.
5. Motion quality: purposeful, smooth, and not excessive.
6. Responsiveness: polished on desktop and mobile.
7. Accessibility: keyboard navigation and reduced-motion support considered.
8. Feasibility: can be implemented in the project stack without unrealistic dependencies.

## Output Format To Return In Chats
When this skill is invoked, return results in this order:
1. Concept summary (name, mood, and why it fits)
2. Section-by-section page blueprint
3. Token direction (type, color, spacing, effects)
4. Motion plan (what animates, timing intent, reduced-motion fallback)
5. Mobile adaptations
6. Quality gate pass/fail notes with fixes

## Example Prompt Invocations
- `/creative-next-level-web-pages Chat app landing page for remote teams, editorial + kinetic vibe, conversion-first, mobile-first.`
- `/creative-next-level-web-pages Reimagine our hero and feature sections to feel bold but trustworthy for enterprise buyers.`
- `/creative-next-level-web-pages Portfolio-style marketing page for a messaging startup, high personality, strong motion.`
