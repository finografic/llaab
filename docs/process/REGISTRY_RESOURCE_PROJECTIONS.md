# Registry Resource Projections

Registry pins are operational bookmarks. Resource nodes are their knowledge-base
projection.

This split lets LLAAB keep fast registry UI state in small JSON pin stores while
also making important packages and repositories visible to the vault graph,
search, review workflows, and later knowledge synthesis.

## Stores

| Layer               | Purpose                        | Location                                                     |
| ------------------- | ------------------------------ | ------------------------------------------------------------ |
| Package pins        | Fast package registry state    | `~/.llaab/pinned-packages.json` (`LLAAB_PACKAGE_PINS_PATH`)  |
| Repository pins     | Fast repository registry state | `~/.llaab/pinned-repositories.json` (`LLAAB_REPO_PINS_PATH`) |
| Resource projection | Knowledge-base representation  | `vault/nodes/resources/*.md`                                 |

The pin JSON files answer registry UI questions such as "what is pinned?" and
"what metadata did we snapshot at pin time?"

The resource nodes answer knowledge questions such as "what tools, packages,
repositories, or references are part of the system's working context?"

## Projection Flow

When a package or repository is pinned through the registry API:

1. The server fetches live registry metadata.
2. The pin is written to the relevant JSON store.
3. The pin is projected into a `ResourceNode`.
4. The API response includes the pin and the resource projection status.

Existing pins are idempotent. If a pin already exists, the server still projects
or repairs the matching resource node, then returns the existing-pin response.

Listing pins also reads the resource projection index so the UI can show whether
each pin has a linked resource node.

## Resource Identity

Projection identity is deterministic.

| Pin kind    | Resource id                  | Identity tag        | Resource type |
| ----------- | ---------------------------- | ------------------- | ------------- |
| npm package | `registry-package-{package}` | `package:{name}`    | `package`     |
| GitHub repo | `registry-repo-{owner-repo}` | `repo:{owner/repo}` | `repo`        |

The projection index scans existing `ResourceNode` files and builds lookup maps
from these identity tags. This allows the system to find a resource even if its
file id changed, as long as the identity tag remains intact.

## Projected Content

Projected resource nodes include:

- title (`Package: ...` or `Repository: ...`)
- canonical URL
- resource type
- description
- registry-derived tags
- editable `Pin Rationale` section
- fenced `json registry-pin` metadata block

Package projections add tags such as:

- `registry`
- `registry:pin`
- `registry:package`
- `ecosystem:npm`
- `package:{name}`
- `keyword:{keyword}`

Repository projections add tags such as:

- `registry`
- `registry:pin`
- `registry:repo`
- `repo:{owner/repo}`
- `language:{language}`
- `topic:{topic}`

On projection update, server-managed registry tags are replaced from current pin
metadata. User-added tags are preserved unless they use one of the projected
registry prefixes.

## Knowledge-Base Behavior

A pinned package or repository should not remain a private bookmark. Its
resource projection makes it available as a first-class vault node so future
workflows can:

- connect it to transcripts, ideas, inbox captures, and source material
- recommend relevant tools or repositories from the knowledge graph
- accumulate manual rationale and review notes
- later promote mature resource knowledge into `knowledge/`

No LLM call is required for pinning. Projection is deterministic file I/O plus
registry metadata formatting. Higher-level semantic linking can happen later in
review, consolidation, or graph-building workflows.

## Delete Semantics

Unpinning removes the pin from the JSON store. It does not currently delete the
projected resource node.

This is intentional for now: once a pin has been projected into the knowledge
base, it may have manual rationale, links, tags, or relationships worth keeping.
Cleanup or archival of orphaned resource projections should be an explicit
review workflow, not a side effect of unpinning.

## Implementation

Server projection logic lives in:

- `apps/server/src/routes/registry/registry-resource-projection.ts`
- `apps/server/src/routes/registry/registry-pins.routes.ts`
- `apps/server/src/routes/registry/registry-repo-pins.routes.ts`

Resource node schema lives in:

- `packages/schemas/src/resource-node.schema.ts`
