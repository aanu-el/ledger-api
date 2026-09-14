# Issue tracker: Linear

Issues and specs for this repo live in Linear, accessed through the Linear MCP tools
(`mcp__claude_ai_Linear__*`). There is no CLI; every operation is an MCP call.

- **Workspace / team**: Eleos-personal
- **Project**: "Ledger API" — every issue for this repo belongs to it.

## Conventions

- **Create an issue**: `save_issue` with `team: "Eleos-personal"`, `project: "Ledger API"`,
  a markdown `description`, and `labels`. Use real newlines in markdown, not `\n`.
- **Read an issue**: `get_issue` by identifier (e.g. `ELE-12`); `list_comments` for discussion.
- **List issues**: `list_issues` filtered by `project: "Ledger API"` and `label`/`state` as needed.
- **Comment**: `save_comment` on the issue.
- **Apply / remove labels**: `save_issue` with `addLabels` / `removeLabels`. Labels are
  team-scoped; create missing ones with `save_issue_label` before applying.
- **Close**: `save_issue` with `state: "Done"` (or `"Canceled"` for wontfix).
- Existing topical labels (`api`, `database`, `queue`, `auth`, `testing`, `infra`, `backend`,
  `Feature`, `Bug`, `Improvement`) may be added alongside triage labels.

## When a skill says "publish to the issue tracker"

Create a Linear issue in project "Ledger API" with the spec as the description.

## When a skill says "fetch the relevant ticket"

`get_issue` with the identifier the user gives (e.g. `ELE-12`).

## Wayfinding operations

Used by `/wayfinder`. The **map** is one issue; **child** tickets are Linear sub-issues.

- **Map**: an issue labelled `wayfinder:map` holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `save_issue` with `parentId` set to the map; label `wayfinder:<type>`
  (`research`/`prototype`/`grilling`/`task`). Claimed tickets are assigned to the driving dev.
- **Blocking**: Linear issue relations (`blockedBy` in `save_issue`). A ticket is unblocked when
  every blocker is Done or Canceled.
- **Frontier**: `list_issues` with `parent` = map, open state, no assignee; drop any with an
  open blocker; first in map order wins.
- **Claim**: `save_issue` with `assignee: "me"`, the session's first write.
- **Resolve**: `save_comment` with the answer, set state Done, then append a context pointer
  to the map's Decisions-so-far.
