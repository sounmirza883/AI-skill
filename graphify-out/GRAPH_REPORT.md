# Graph Report - AI-skill  (2026-11-01)

## Corpus Check
- Corpus is ~11,344 words - fits in a single context window. You may not need a graph.

## Summary
- 74 nodes · 94 edges · 9 communities
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Installer Script
- Animation Modules
- QA and Final Report
- Reference Study and Cloning
- Skill Overview and Install
- Typography and Premium Principles
- Color System and Contrast
- Workflow Phases and Motion Levels
- Motion Foundation and Accessibility

## God Nodes (most connected - your core abstractions)
1. `Animation Recipes` - 19 edges
2. `QA Checklist and Final Report` - 8 edges
3. `Module 0 Foundation (reveal, IntersectionObserver, pause toggle)` - 6 edges
4. `Studying a Reference Site (and adapting it)` - 6 edges
5. `premium-frontend skill` - 5 edges
6. `Psychology, Color and Visual System` - 5 edges
7. `Premium-perception principles (fluency, peak-end, Hick, Von Restorff, anchoring, Doherty)` - 5 edges
8. `Color system rules (neutral first, one accent, 60/30/10, OKLCH)` - 5 edges
9. `AI Agent Skills README` - 4 edges
10. `Phase 1 - Design interview` - 4 edges

## Surprising Connections (you probably didn't know these)
- `premium-frontend skill` --implements--> `Agent Skills open format (SKILL.md plus references)`  [EXTRACTED]
  skills/premium-frontend/SKILL.md → README.md
- `Premium-perception principles (fluency, peak-end, Hick, Von Restorff, anchoring, Doherty)` --rationale_for--> `Premium = restraint + precision + one memorable moment`  [INFERRED]
  skills/premium-frontend/references/psychology-and-color.md → skills/premium-frontend/SKILL.md
- `AI Agent Skills README` --references--> `premium-frontend skill`  [EXTRACTED]
  README.md → skills/premium-frontend/SKILL.md
- `prefers-reduced-motion and global pause (WCAG 2.2.2)` --implements--> `Module 0 Foundation (reveal, IntersectionObserver, pause toggle)`  [INFERRED]
  skills/premium-frontend/SKILL.md → skills/premium-frontend/references/animations.md
- `Animation module menu (15 modules)` --references--> `Animation Recipes`  [EXTRACTED]
  skills/premium-frontend/SKILL.md → skills/premium-frontend/references/animations.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Premium frontend six-phase workflow** — skills_premium_frontend_skill_phase_0_read_project, skills_premium_frontend_skill_phase_1_design_interview, skills_premium_frontend_skill_phase_2_study_references, skills_premium_frontend_skill_phase_3_design_direction, skills_premium_frontend_skill_phase_4_build, skills_premium_frontend_skill_phase_5_audit_report [EXTRACTED 1.00]
- **Skill reference files loaded per phase** — skills_premium_frontend_references_animations_animation_recipes, skills_premium_frontend_references_psychology_and_color_psychology_and_visual_system, skills_premium_frontend_references_reference_cloning_studying_a_reference_site, skills_premium_frontend_references_qa_checklist_qa_checklist_and_final_report [EXTRACTED 1.00]
- **Reduced-motion and pause compliance across looping modules** — skills_premium_frontend_skill_reduced_motion_and_pause, skills_premium_frontend_references_animations_m3_word_rotator, skills_premium_frontend_references_animations_m5_review_shuffle, skills_premium_frontend_references_animations_m8_cursor_tour, skills_premium_frontend_references_qa_checklist_motion_qa [INFERRED 0.85]

## Communities (9 total, 0 thin omitted)

### Community 0 - "Installer Script"
Cohesion: 0.14
Nodes (9): AGENTS, args, byDest, isGlobal, names, pIdx, skills, src (+1 more)

### Community 1 - "Animation Modules"
Cohesion: 0.20
Nodes (14): Animation Recipes, Module 10 Before / after, Module 12 Us vs them, Module 13 Click to success, Module 14 Micro-interactions, Module 1 Preloader / page intro, Module 2 Hero reveal, Module 4 Live activity pings (+6 more)

### Community 2 - "QA and Final Report"
Cohesion: 0.22
Nodes (9): AI-look audit, Cross-browser checks, Final report template, Performance QA (LCP, CLS, INP), QA Checklist and Final Report, Responsiveness sweep (320-1920 widths, overflow finder), The AI-look blacklist, Phase 4 - Build (motion last) (+1 more)

### Community 3 - "Reference Study and Cloning"
Cohesion: 0.29
Nodes (8): Cloning boundaries (clone system, not assets), Browser tools for studying sites (Chrome DevTools MCP, Playwright MCP, Claude in Chrome), Inspiration sources (21st.dev, Aceternity UI, Magic UI, shadcn/ui, Codrops, Awwwards, Mobbin), Reference Spec template, Studying a Reference Site (and adapting it), Design token extraction console script, Choosing animation tools (CSS/IO, Motion, GSAP, Lenis), Ethics (real social proof, no fake urgency, clone craft not assets)

### Community 4 - "Skill Overview and Install"
Cohesion: 0.38
Nodes (7): Agent Skills open format (SKILL.md plus references), AI Agent Skills README, install.mjs installer, Supported coding agents and skill folders, How to think (five silent questions), premium-frontend skill, Premium = restraint + precision + one memorable moment

### Community 5 - "Typography and Premium Principles"
Cohesion: 0.33
Nodes (6): Module 11 Rolling price, Module 3 Word rotator, Premium-perception principles (fluency, peak-end, Hick, Von Restorff, anchoring, Doherty), Psychology, Color and Visual System, Space, shape and depth (spacing scale, radius, shadows, borders), Typography (pairings, fluid clamp scale, tracking)

### Community 6 - "Color System and Contrast"
Cohesion: 0.33
Nodes (6): Color psychology associations, Color system rules (neutral first, one accent, 60/30/10, OKLCH), Contrast targets (WCAG and APCA), Ready palettes (Midnight Luxe, Editorial Ivory, Fintech Trust, Clinical Calm, Electric Dev), CSS design token template (light and dark), Accessibility QA and contrast checker

### Community 7 - "Workflow Phases and Motion Levels"
Cohesion: 0.33
Nodes (6): Animation module menu (15 modules), Motion intensity levels (Calm, Confident, Expressive), Phase 0 - Read the project, Phase 1 - Design interview, Phase 2 - Study references, Phase 3 - Design direction (Design Brief)

### Community 8 - "Motion Foundation and Accessibility"
Cohesion: 0.67
Nodes (4): Module 0 Foundation (reveal, IntersectionObserver, pause toggle), Motion QA, Motion system tokens and rules, prefers-reduced-motion and global pause (WCAG 2.2.2)

## Knowledge Gaps
- **18 isolated node(s):** `How to think (five silent questions)`, `Motion intensity levels (Calm, Confident, Expressive)`, `Choosing animation tools (CSS/IO, Motion, GSAP, Lenis)`, `The AI-look blacklist`, `Module 6 Count-up stats` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 31 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Animation Recipes` connect `Animation Modules` to `QA and Final Report`, `Reference Study and Cloning`, `Typography and Premium Principles`, `Workflow Phases and Motion Levels`, `Motion Foundation and Accessibility`?**
  _High betweenness centrality (0.304) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Module 0 Foundation (reveal, IntersectionObserver, pause toggle)` (e.g. with `Motion QA` and `prefers-reduced-motion and global pause (WCAG 2.2.2)`) actually correct?**
  _`Module 0 Foundation (reveal, IntersectionObserver, pause toggle)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `How to think (five silent questions)`, `Motion intensity levels (Calm, Confident, Expressive)`, `Choosing animation tools (CSS/IO, Motion, GSAP, Lenis)` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Installer Script` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `Premium-perception principles (fluency, peak-end, Hick, Von Restorff, anchoring, Doherty)` connect `Typography and Premium Principles` to `Animation Modules`, `Skill Overview and Install`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._
- **Why does `QA Checklist and Final Report` connect `QA and Final Report` to `Motion Foundation and Accessibility`, `Color System and Contrast`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._