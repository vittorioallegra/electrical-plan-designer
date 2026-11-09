# Spec: Box columns (boxes stacked at one plan point)

Status: agreed (2026-11-09), pending the mockup of the column symbol and the exploded list;
to be implemented before the first release
(the `.epd` schema is still at version 1 and can change in place).

## Context

On site, boxes are often stacked on the same wall at the same plan position:

- a low socket box (0.30 m) under a switch box (1.10 m) by a door;
- a set of switches split over two or three boxes one above the other;
- a junction box near the ceiling above a switch box.

Between two stacked boxes there is a short vertical conduit, and the cables of every circuit
that goes on to the box above or below run through it. The plan is a top view, so the boxes
share one point, but the BOM must count each box, its contents and the vertical conduit
between them.

## Current State (verified 2026-11-09, commit 9c8d126)

| Concern | Today | Where |
|---|---|---|
| Box height | Per node: `mounting` (`socket`, `switch`, `ceiling`, `custom`) and `customHeight`; defaults from `settings.mountingHeights`, clamped to the floor height | `packages/domain/src/schema.ts:92`, `lengths.ts` (`mountingDefault`, `height_clamped`) |
| Vertical length | A same-floor segment with `runElevation: 'direct'` measures plan length + \|Δheight\| | `lengths.ts` (`segmentLengthMm`) |
| Stacking | Refused: a new box within 12 px of another node is not placed ("no stacking boxes") | `apps/web/src/features/editor/utils/commands.ts` (`nodeAt`), `canvas/hooks/usePlanPointer.ts` |
| Selection | Hit test returns nodes nearest first; two nodes at one point cannot both be reached | `canvas/hitTest.ts` |
| Precedent | Riser points of one `riserGroupId` on adjacent floors get derived riser segments | `packages/domain/src/risers.ts` (`rebuildRisers`), `edits.ts` (`linkRiser`, `pasteNodes`) |

Workaround today: two boxes a few centimetres apart, joined by a conduit set to **Direct**. The
BOM is close (plus the small plan offset), but the plan shows two symbols where there is one
spot on the wall, and the vertical conduit has to be drawn by hand.

## Proposed Change

### 1. Model

- `PlanNode` gets an optional `stackId`. Boxes (`junction_box`, `terminal_box`) on the same
  floor with the same `stackId` form a **column**. Panels and riser points never join one.
- Invariants (checked by the schema validation, kept by every edit):
  - all members of a column share `floorId` and `position`;
  - a column has at least two members; an edit that leaves one member removes its `stackId`.
- Each member keeps its own label, mounting, height, box item, contents, status and circuits:
  BOM, checks, quotes and the panel see ordinary boxes.

### 2. Vertical conduits (derived, like risers)

- `rebuildStacks(doc, settings, genId)` in `packages/domain` (next to `rebuildRisers`) orders
  the members of each column by height and keeps exactly one segment between each pair of
  neighbours: `runElevation: 'direct'`, no vertices. Its length is \|Δheight\| through the
  existing `segmentLengthMm`, so routing, conduit fill and the BOM need no change.
- The conduit item of a column's vertical segments is kept when they are rebuilt (as
  `rebuildRisers` keeps a group's conduit); a new column uses the default conduit. The
  segment inspector can change the conduit item; the segment cannot be deleted by itself.
- It runs after every edit that can change membership, order or heights: placing, deleting,
  pasting, moving into or out of a column, changing a member's mounting or custom height,
  changing the project's mounting heights or a floor's height. Like `rebuildRisers`, it
  returns the removed segment ids, so manual routes through them are reported invalid.
- A conduit drawn on the plan connects to one specific member (the one it is drawn from or
  to), so a run can arrive at the top box and leave from the bottom one.

### 3. Editor

- **Placing**: placing a box on an existing box (within the current 12 px) adds it to that
  box's column, creating the column when needed. The new box takes its preset's mounting, as
  today. Placing on a panel or a riser point is still refused.
- **Plan symbol**: a column must read as "several boxes here" at a glance. It is drawn once
  as a stack: the top member's symbol in front with one offset outline behind it per further
  member (up to two outlines), plus a count badge (`×2`, `×3`); the label lists the members'
  labels from top to bottom (`S4 · S1`). Symbol, badge and label follow DESIGN.md (tokens,
  sizes); a mockup is agreed before coding. Vertical segments have no plan length: no line
  and no length label is drawn for them.
- **Selection by exploding**: a click on a column does not select a box; it **explodes** the
  column. A list of the members, top to bottom, opens anchored next to the point, each row
  with the member's symbol, label and height (and a warning mark when it has one); the column
  symbol stays highlighted while it is open. A click on a row selects that box (inspector,
  highlight in the list) and keeps the list open, so another member is one click away;
  Escape, a click elsewhere on the plan or a tool change closes it. Hovering a row highlights
  that member's conduits on the plan.
  - Keyboard: with the column focused, Enter explodes it; arrows move between rows, Enter
    selects, Escape closes.
  - Conduit drawing that starts or ends on a column explodes it the same way, and the row
    picked is the conduit's end.
  - A box selection (drag rectangle) includes every member without exploding.
  - Dragging a column (press and move) moves it without exploding.
- **Inspector** of a member: a **Column** section lists the members top to bottom (label,
  height); a click selects one. Actions: **Add box above**, **Add box below** (preset picker as
  for the box tool; the height defaults to the preset's mounting) and **Take out of column**
  (moves the box 0.30 m to the side, keeping its conduits).
- **Move**: dragging a column or editing X/Y of a member moves the whole column.
- **Delete** removes the selected member only; its vertical segments are rebuilt around it.
- **Copy/paste**: a copied column is pasted as a new column (new `stackId`, as pasted riser
  points get a new group); a member copied alone is pasted as a plain box.
- Every change goes through `applyCommand` (one undo step each).

### 4. Checks

- New warning `stack_same_height`: two members of a column at the same height (the vertical
  conduit between them would be 0 m). Existing checks (`height_clamped`, `box_modules`,
  `conduit_fill`, `box_not_reached`, ...) apply to each member unchanged.

### 5. Exports

- Project PDF: the plan draws a column as on the canvas; vertical segments are listed with
  their length wherever segments are listed, and never drawn (as riser segments today).
- BOM, quote PDF and CSV: no change (they already count boxes and conduit meters).

### 6. File format

- `stackId` is optional, so files without columns load unchanged. Schema versions stay at 1:
  update `projectFile/fixtures/v1.json` and add a column to the demo project
  (`scripts/build-demo-epd.mjs`, `pnpm demo:epd`).

## Acceptance Criteria

1. Placing a socket box on a switch box gives one symbol with a `×2` badge and both labels;
   the BOM lists both boxes and their contents, and conduit meters grow by
   switch height − socket height (default 0.80 m) for the vertical conduit.
2. A circuit whose targets are both boxes of a column is routed through the vertical
   conduit, and its cable meters include it.
3. Changing the socket box to a custom height of 0.50 m updates the vertical conduit to
   0.60 m; moving it above the switch box (custom 1.40 m) reorders the column and its
   vertical segment, and a manual route through the removed segment is reported invalid.
4. A click on a column explodes it into the list of its boxes, top to bottom; a click on a row
   selects that box and the list stays open; Escape or a click elsewhere closes it. A conduit
   drawn to a column explodes it too, and the row picked is the conduit's end.
5. Dragging a column moves every member; X/Y in the inspector does the same.
6. Delete on one member keeps the others; with one member left, the badge disappears and
   the box is a plain box. Undo restores the column in one step.
7. Copy and paste a column: a new, independent column with its own vertical conduits.
8. Two members at the same height raise `stack_same_height`.
9. A file saved with a column reopens identical; a file without `stackId` opens unchanged.
10. Every new string exists in `en.json` and `it.json`.

## Testing Plan

| Level | What | Where |
|---|---|---|
| Domain unit | `rebuildStacks`: ordering, one segment per neighbour pair, conduit kept, removal ids, single member loses `stackId`; schema invariants; paste remaps `stackId`; move keeps members together | `packages/domain/src/stacks.test.ts`, `edits.test.ts`, `projectFile.test.ts` |
| Domain unit | Lengths and routing through a column; BOM conduit meters; `stack_same_height` | `lengths.test.ts`, `routing.test.ts`, `bom.test.ts`, `checks.test.ts` |
| Component | Inspector Column section (list, select, add above/below, take out); exploded list (rows, keyboard, close) | `features/editor/components/*.test.tsx` |
| Browser E2E | Place a box on a box, stacked symbol and badge, explode and select a member, draw a conduit to a column, drag without exploding, delete, undo | `apps/web/e2e/` (canvas via `window.__epd.store`) |
| Fixtures | `v1.json` and the demo project include a column; the drift test stays green | `projectFile/fixtures/v1.json`, `tests/fixtures/demo-project.epd` |

Each test carries its `// protects=...; fails_when=...; no_claim=...` card.

## Rollback Plan

The change is additive: reverting the commits removes columns from the editor. Files saved
with `stackId` still load if the field stays optional in the schema; before the first release
no compatibility promise exists.

## Effort Estimate

Domain (model, `rebuildStacks`, edits, checks, fixtures) about one day; editor (placement,
symbol and badge, selection, member picker, inspector, move/delete/paste) one to two days;
exports and E2E half a day.

## Out of Scope

- Boxes side by side at the same height (multi-gang groupings): separate boxes, as today.
- An elevation (wall) view or any 3D view of the column.
- Columns across floors (that is what riser points are for).
- A column member that is a panel or a riser point.

## Decisions

- Selecting inside a column: the column explodes into a list of its boxes (agreed 2026-11-09).
- One vertical conduit between each pair of neighbours (chained); separate conduits from each
  box stay drawable by hand with boxes slightly apart (agreed 2026-11-09).
