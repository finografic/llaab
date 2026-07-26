---
id: "agent-orchestration-cost-optimization"
type: "wiki"
topic_key: "agent-orchestration-cost-optimization"
title: "Model Tiering for Cost-Optimized Agent Orchestration"
aliases: []
summary: "Created new wiki topic on model tiering for cost-optimized agent orchestration, covering the tiered delegation mechanism (expensive lead model with cheap worker sub-agents), per-agent model assignment via YAML front matter configuration, context isolation as a compounding delegation benefit, and structural trade-offs including one-to-one communication constraints, session limits, and when delegation is unnecessary."
status: "seed"
tags: 
  - d:llm
  - d:infra
  - d:automation
  - model-tiering
  - cost-optimization
  - agent-orchestration
  - context-management
  - unbiased-review
  - delegation
  - yaml-frontmatter
  - safety-controls
  - agent-config
  - specialist-agents
  - parallel-execution
  - orchestration-model
  - session-limits
  - when-to-delegate
links: [{"target_wiki_id":"agent-harness-harness-engineering","relation":"related-to","note":"Harness engineering encompasses the orchestration layer where model tiering and delegation patterns are implemented"},{"target_wiki_id":"action-delegation-llm-tool-use","relation":"related-to","note":"Action delegation patterns share the delegation principle of routing tasks to specialized executors rather than direct execution"},{"target_wiki_id":"agent-configuration-system-prompt-bloat","relation":"related-to","note":"Agent configuration mechanisms (YAML front matter, tool restrictions) are shared between model tiering and prompt bloat reduction"}]
source_refs: [{"id":"canonical-how-to-build-claude-subagents-better-than-99-of-people-2-2026-07-26t02-31-29-4-14-1","kind":"transcript","node_id":"how-to-build-claude-subagents-better-than-99-of-people","title":"How to Build Claude Subagents Better Than 99% of People","url":"https://www.youtube.com/watch?v=e18sdZLwP7o&t=254","locator":"4:14","verification":"source-backed","excerpt":"And the one you probably know the best is called skills. So, in the skills folder, let's just take a look at real quick my agent builder skill. What this is is it's a markdown file. This lives as markdown so that I could send it to you guys, I could put it in my community, I could send it to my team. And all you have to do is put this is put this markdown file in their .claud in a skills folder, and then they're able to use it. And so, a sub-agent is the exact same actual tangible thing as a skill.md file. It's just called something else.","validation_notes":[]},{"id":"canonical-how-to-build-claude-subagents-better-than-99-of-people-2-2026-07-26t02-31-29-4-40-2","kind":"transcript","node_id":"how-to-build-claude-subagents-better-than-99-of-people","title":"How to Build Claude Subagents Better Than 99% of People","url":"https://www.youtube.com/watch?v=e18sdZLwP7o&t=280","locator":"4:40","verification":"source-backed","excerpt":"You know, we've got the YAML front matter up here, and then we have the instructions of what the skill does and the actual steps to take. So, if I open up my agents folder, also in my .claud, you can see I've got a different a couple different agents here, right? So, this one, let's just look at is called the clickup-searcher.md. And that's an agent that's called clickup searcher. We've got the YAML front matter up here, name clickup searcher, we've got the description, we've got the model which I've defined here, we've got the color, which means if I actually use the clickup searcher agent, it shows the color. So, actually let me just show you. Can you go ahead and use the clickup searcher agent to show me what we've talked about today in the weekly commitments channel? And so, what you'll notice is I invoked that with completely natural language. I'll have the clickup searcher agent pull today's messages and then right here I can see the green color. So, that's all it means when you actually assign an agent a color. It's just so you can actually see it right there. And down here, you know, earlier, right here is where it said general purpose, what it says now is clickup searcher,","validation_notes":[]},{"id":"canonical-how-to-build-claude-subagents-better-than-99-of-people-2-2026-07-26t02-31-29-8-01-3","kind":"transcript","node_id":"how-to-build-claude-subagents-better-than-99-of-people","title":"How to Build Claude Subagents Better Than 99% of People","url":"https://www.youtube.com/watch?v=e18sdZLwP7o&t=481","locator":"8:01","verification":"source-backed","excerpt":"So, obviously, not having a weak description, so having, you know, a very precise type of description. You can even say something like use proactively if you want it to fire off, you know, pretty generously. And then, after you have the actual front matter not dialed in, it's all about the body. The body is the way that the sub agent actually works, what skills it invokes. Because, yes, sub agents can invoke skills, and skills can invoke sub agents. So, keep that in mind. They work together. They're not, um, you know, competitors.","validation_notes":[]}]
source_canonical_idea_ids: 
  - canonical-how-to-build-claude-subagents-better-than-99-of-people-2-2026-07-26T02-31-29
  - canonical-how-to-build-claude-subagents-better-than-99-of-people-1-2026-07-26T02-31-29
  - canonical-how-to-build-claude-subagents-better-than-99-of-people-3-2026-07-26T02-31-29
  - canonical-how-to-build-claude-subagents-better-than-99-of-people-4-2026-07-26T02-31-29
source_transcript_ids: 
  - how-to-build-claude-subagents-better-than-99-of-people
revision: 1
created_at: "2026-07-26T02:32:38Z"
updated_at: "2026-07-26T02:32:38Z"
reviewed_at: "2026-07-26T02:32:38Z"
verification_status: "source-backed"
quality_score: 91
evidence_metrics: {"evidence_ref_count":3,"unique_canonical_idea_count":4,"unique_transcript_count":1,"unique_source_node_count":1,"unique_author_channel_count":1,"independent_source_count":1,"unknown_source_identity_count":0}
quality_dimensions: {"overall_score":91,"passed":true,"dimensions":[{"dimension":"topic_coherence","score":100,"threshold":80,"passed":true,"blocking":true,"issues":[]},{"dimension":"primary_evidence_coverage","score":100,"threshold":70,"passed":true,"blocking":true,"issues":[]},{"dimension":"citation_completeness","score":100,"threshold":80,"passed":true,"blocking":true,"issues":[]},{"dimension":"source_diversity","score":40,"threshold":0,"passed":true,"blocking":false,"issues":[{"code":"single-source","message":"Independent source corroboration is unavailable."}]},{"dimension":"duplication_avoidance","score":100,"threshold":70,"passed":true,"blocking":true,"issues":[]},{"dimension":"update_novelty","score":100,"threshold":50,"passed":true,"blocking":false,"issues":[]},{"dimension":"link_validity","score":100,"threshold":80,"passed":true,"blocking":true,"issues":[]}],"blocking_dimensions":[],"page_coverage":{"primary_total":1,"represented_primary":1,"omitted_primary":0,"excluded_for_siblings":3}}
generation_provider: "opencode"
generation_model: "glm-5.2"
generation_duration_ms: 35776
---

<!-- wiki-section:tiered-delegation-mechanism -->

## Tiered Delegation as a Cost Lever

In multi-agent systems, pairing an expensive lead model with cheaper worker sub-agents for routine tasks reduces overall cost while retaining high-quality orchestration. The lead model handles complex reasoning and coordination, while worker sub-agents—such as models in the Haiku tier—handle repetitive or well-scoped tasks at a fraction of the cost. This tiered delegation pattern functions as a core economic lever: the savings come not from reducing the number of tasks but from matching each task to the cheapest model capable of performing it adequately. The lead model's role is orchestration—deciding what to delegate, to which agent, and how to synthesize results—rather than executing every step itself. Sub-agents are invoked through natural language by the lead model, which then receives and integrates their outputs. [^canonical-how-to-build-claude-subagents-better-than-99-of-people-2-2026-07-26t02-31-29-4-14-1] [^canonical-how-to-build-claude-subagents-better-than-99-of-people-2-2026-07-26t02-31-29-4-40-2] [^canonical-how-to-build-claude-subagents-better-than-99-of-people-2-2026-07-26t02-31-29-8-01-3]

<!-- wiki-section:model-assignment-via-agent-config -->

## Assigning Model Tiers Through Agent Configuration

Model tiering is implemented at the agent-definition level. Sub-agents are defined as markdown files with YAML front matter that specifies properties including the model to use, a name, a description, and a color for visual identification in the session. The front matter enables progressive disclosure of instructions—the agent's name and description are surfaced to the orchestrating model, while the full body of instructions (steps to take, skills to invoke) is loaded only when the agent is activated. This structure means that model tiering is a per-agent configuration decision: each sub-agent's markdown file declares which model tier it runs on, allowing the system builder to assign cheaper models to routine agents and reserve expensive models for the lead orchestrator or complex specialist agents. Sub-agents can also invoke skills, and skills can invoke sub-agents, creating composable delegation chains across model tiers. A precise description in the front matter—potentially including directives like 'use proactively'—controls how generously the lead model delegates to each agent, further tuning the cost-quality balance. [^canonical-how-to-build-claude-subagents-better-than-99-of-people-2-2026-07-26t02-31-29-4-14-1] [^canonical-how-to-build-claude-subagents-better-than-99-of-people-2-2026-07-26t02-31-29-4-40-2] [^canonical-how-to-build-claude-subagents-better-than-99-of-people-2-2026-07-26t02-31-29-8-01-3]

<!-- wiki-section:context-isolation-delegation-economics -->

## Context Isolation as a Delegation Benefit

Beyond direct cost savings from cheaper models, delegating tasks to sub-agents provides context-management benefits that compound the economic advantage. Sub-agents run in fresh sessions that do not pollute the main context window. Verbose or exploratory tasks—such as searching through large datasets or generating draft content—can be offloaded to cheaper sub-agents, keeping the primary chat context clean and focused. Because sub-agents lack prior conversation memory, they also produce unbiased reviews of work done in the main session, free from anchoring on earlier context. This means the cost optimization strategy of model tiering simultaneously serves context hygiene: the cheapest model handles the most token-intensive work, and the main session retains only the summarized results. The two benefits are mutually reinforcing—delegation reduces both per-token cost and context-window pressure. [^canonical-how-to-build-claude-subagents-better-than-99-of-people-2-2026-07-26t02-31-29-4-14-1] [^canonical-how-to-build-claude-subagents-better-than-99-of-people-2-2026-07-26t02-31-29-4-40-2]

<!-- wiki-section:delegation-tradeoffs-constraints -->

## When Delegation Pays Off and When It Doesn't

The tiered delegation pattern has structural constraints that limit its applicability. Sub-agents communicate only with the main session in a one-to-one relationship—they cannot communicate with each other—so workflows requiring inter-agent coordination must route through the lead model, adding orchestration overhead. Dynamic workflows that spin up many parallel agents can rapidly consume session limits, eroding the cost advantage. Delegation is also unnecessary for quick edits or sequential interdependent steps where the overhead of spawning a sub-agent exceeds the savings from using a cheaper model. The cost optimization is most effective when tasks are independent, well-scoped, and token-intensive enough that the price differential between model tiers outweighs the orchestration overhead. Safety controls—such as tool restrictions (read-only access) and max-turns limits to prevent runaway loops—add further guardrails that prevent cheap worker agents from consuming unbounded resources, protecting the cost advantage from being undermined by runaway execution. [^canonical-how-to-build-claude-subagents-better-than-99-of-people-2-2026-07-26t02-31-29-4-40-2] [^canonical-how-to-build-claude-subagents-better-than-99-of-people-2-2026-07-26t02-31-29-8-01-3]
