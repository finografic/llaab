# LLAAB — Project Vocabulary

> **LLAAB Ubiquitous Language (Critical)**
>
> The system must define and enforce a **shared vocabulary** between:
>
> - you (domain expert)
> - the LLM (executor)
>
> **Without shared vocabulary:**
>
> - ambiguity increases
> - results degrade
> - systems drift
>
> **With shared vocabulary:**
>
> - precision increases
> - workflows stabilize
> - agents become reliable

---

## run

**A `run` is one execution record: one time a skill, pipeline, or agent actually did something.**

In LLAAB terms, that matters because the lab is not just storing knowledge, it is also storing what happened when knowledge was used. So a `skill` is the reusable capability, and a `run` is the trace of one real attempt to use it.

A `run` schema usually answers questions like:

- what was executed
- when it started and finished
- whether it succeeded or failed
- what inputs it received
- what outputs it produced
- what nodes it created
- what model or tool was used
- what error happened, if any

That is run-logging: persisting those execution records instead of only printing them to the terminal and losing them.

Why it matters here:

- it makes execution inspectable
- it lets you debug failures later
- it creates feedback for refinement
- it turns “execution” into new knowledge, which fits the LLAAB loop

A simple mental model is:

```txt
skill = recipe
run = one cooking attempt
run logging = writing down what ingredients you used, what happened, and how it turned out
```

Right now in the repo:

- [`packages/schemas/src/run-node.schema.ts`](/Users/justin/LLAAB/packages/schemas/src/run-node.schema.ts) defines what a run record can look like
- [`packages/skills/src/runner.ts`](/Users/justin/LLAAB/packages/skills/src/runner.ts) creates an in-memory run record
- but that runner does not yet write a `run` node into `vault/runs`

So the schema exists, but persistent run-logging is the next step.

If you want, I can implement that next so every skill execution writes a real markdown `run` node.

---

## glossary

**A `glossary` is the locked vocabulary of the lab: the set of words whose meaning should stay stable across you, the codebase, and agents.**

In LLAAB terms, this matters because a system cannot become reliable if the names for its core concepts drift. A glossary is not just a nice document. It is a control mechanism against ambiguity.

A glossary usually answers questions like:

- what terms are officially part of the system
- what each term means
- what each term does not mean
- how terms relate to one another
- which wording should be preferred when there are near-synonyms

Why it matters here:

- it reduces ambiguity in prompts and implementation
- it makes agent behavior more consistent
- it keeps docs, schemas, and code aligned
- it protects the ubiquitous language from slow drift

A simple mental model is:

```txt
glossary = the dictionary of the lab
schema = the typed shape of a concept
code = the behavior that uses those concepts
```

For LLAAB, I would treat `glossary` as the preferred term for the concept list itself, and `vocabulary` as the wider language layer around it.

---

## vocabulary

**`Vocabulary` is the wider shared language of the lab: the set of meanings, distinctions, and naming rules that shape how LLAAB is described and built.**

In LLAAB terms, vocabulary is broader than glossary. The glossary is the explicit list. Vocabulary is the whole living language system around it.

Why it matters here:

- it gives names to the building blocks of the lab
- it helps schemas stay meaningful
- it helps prompts and docs say the same thing the code says
- it makes agents easier to steer

A simple mental model is:

```txt
glossary = the official list
vocabulary = the whole language environment
```

---

## node

**A `node` is one typed unit of knowledge stored in the lab.**

In LLAAB terms, a node is the basic content object of the system. It is not just a markdown file, and it is not just frontmatter. It is the combination of content plus a validated type and shape.

A node usually answers questions like:

- what kind of thing this is
- what it is called
- how it relates to other things
- what state it is in
- what content it carries

Why it matters here:

- nodes are the primary building blocks of the lab
- schemas exist mainly to define node shapes
- ingestion, execution, and refinement all create or evolve nodes

A simple mental model is:

```txt
node = one knowledge object in the lab
file = how that node is stored on disk
schema = how that node is validated
```

Right now in the repo:

- [`packages/schemas/src/base-node.schema.ts`](/Users/justin/LLAAB/packages/schemas/src/base-node.schema.ts) defines the shared node fields
- [`packages/schemas/src/node.schema.ts`](/Users/justin/LLAAB/packages/schemas/src/node.schema.ts) defines the full union of supported node types

---

## schema

**A `schema` is the typed contract that defines what a node or structure is allowed to contain.**

In LLAAB terms, schemas are where the ubiquitous language becomes executable. They turn concepts into enforceable shapes.

A schema usually answers questions like:

- what fields are required
- what fields are optional
- what values are valid
- what kind of object something is

Why it matters here:

- schemas prevent drift between intention and stored data
- schemas give the LLM and the code a shared contract
- schemas make files safer to read and write

A simple mental model is:

```txt
concept = idea in the language
schema = rulebook for that idea
node = one validated instance of it
```

Right now in the repo:

- [`packages/schemas/src/`](/Users/justin/LLAAB/packages/schemas/src/index.ts) contains the modular `*.schema.ts` files
- [`packages/schemas/src/node.schema.ts`](/Users/justin/LLAAB/packages/schemas/src/node.schema.ts) is the main union entry point

---

## source

**A `source` is the origin of knowledge: the person, channel, repo, publication, or other entity content comes from.**

In LLAAB terms, a source is not the same thing as a resource. A source is where knowledge originates. A resource is a usable external thing the lab may refer to.

Why it matters here:

- it helps track provenance
- it helps group related content
- it supports follow-up ingestion and relationship building

A simple mental model is:

```txt
source = who or what content comes from
resource = the external thing itself
transcript = content derived from a source
```

Right now in the repo:

- [`packages/schemas/src/source-node.schema.ts`](/Users/justin/LLAAB/packages/schemas/src/source-node.schema.ts) defines `source`
- YouTube ingestion already attempts to create source nodes for channels

---

## resource

**A `resource` is an external thing the lab wants to remember, reference, or use.**

In LLAAB terms, a resource may be a tool, article, repo, library, dataset, or reference. It is not necessarily the origin of knowledge in the same way a source is.

Why it matters here:

- it gives the lab a place to store useful external references
- it provides a landing place for article and repo ingestion right now
- it separates “reference material” from executable knowledge

A simple mental model is:

```txt
resource = useful external thing
source = where knowledge originates
skill = knowledge the lab can execute
```

Right now in the repo:

- [`packages/schemas/src/resource-node.schema.ts`](/Users/justin/LLAAB/packages/schemas/src/resource-node.schema.ts) defines resource nodes
- article and repo ingestion currently land as `resource` nodes

---

## transcript

**A `transcript` is structured content captured from an external source, especially long-form spoken or written material.**

In LLAAB terms, a transcript is usually an intermediate but valuable node: it preserves the source content in a form that can be read, summarized, linked, and later extracted into ideas or skills.

Why it matters here:

- it is a key bridge between raw ingestion and structured knowledge
- it keeps source material inspectable
- it gives extraction a stable working surface

A simple mental model is:

```txt
source content -> transcript -> extracted ideas/skills
```

Right now in the repo:

- [`packages/schemas/src/transcript-node.schema.ts`](/Users/justin/LLAAB/packages/schemas/src/transcript-node.schema.ts) defines transcript nodes
- [`packages/ingestion/src/pipeline.ts`](/Users/justin/LLAAB/packages/ingestion/src/pipeline.ts) creates transcript nodes for YouTube ingestion

---

## skill

**A `skill` is reusable, executable knowledge.**

In LLAAB terms, a skill is more than a note and less than a fully autonomous agent. It is a defined capability that can be run, combined, refined, and eventually logged through runs.

Why it matters here:

- skills are where knowledge starts becoming action
- they are the bridge between notes and automation
- they are the natural unit of execution for the lab

A simple mental model is:

```txt
idea = possible capability
skill = defined capability
run = one execution of that capability
```

Right now in the repo:

- [`packages/schemas/src/skill-node.schema.ts`](/Users/justin/LLAAB/packages/schemas/src/skill-node.schema.ts) defines the skill shape
- [`packages/skills/src/`](/Users/justin/LLAAB/packages/skills/src/index.ts) is the beginning of the skill execution layer

---

## ingestion

**`Ingestion` is the process of taking external input and turning it into structured lab content.**

In LLAAB terms, ingestion is not one function. It is the pipeline that moves from outside material into typed nodes inside the vault.

A typical ingestion flow answers questions like:

- what was brought in
- where it came from
- how it was cleaned
- how it was structured
- what node or nodes were created

Why it matters here:

- it is how backlogged sources become part of the lab
- it is one of the first places where the whole system loop becomes real
- it is the path you already want to use instead of external note tools

A simple mental model is:

```txt
input -> fetch -> clean -> structure -> extract -> store
```

Right now in the repo:

- [`packages/ingestion/src/pipeline.ts`](/Users/justin/LLAAB/packages/ingestion/src/pipeline.ts) contains the current pipeline entry point
- YouTube is the most concrete first feature target in this area

---

## pipeline

**A `pipeline` is the ordered sequence of stages that transforms an input into a result.**

In LLAAB terms, pipeline is the right word when the emphasis is on stage-by-stage transformation. A run is one execution record of that process. A skill is a reusable capability. The words overlap, but they are not identical.

Why it matters here:

- it clarifies how ingestion and other multi-step flows are structured
- it helps separate definition from execution
- it supports inspectable transformation stages

A simple mental model is:

```txt
skill = capability
pipeline = staged process
run = one execution record
```

---

## vault

**The `vault` is the file-based source of truth for the lab’s knowledge objects.**

In LLAAB terms, the vault is where nodes live on disk. It is not a cache and not a hidden database. It is the inspectable, editable storage layer.

Why it matters here:

- it keeps the system local-first
- it preserves transparency
- it allows direct inspection and git tracking

A simple mental model is:

```txt
vault = the lab's filesystem memory
```

Right now in the repo:

- core node helpers write into `vault/`
- transcript, source, run, and typed node locations are determined from there
