---
id: "agent-configuration-system-prompt-bloat"
type: "wiki"
topic_key: "agent-configuration-system-prompt-bloat"
title: "Reducing system prompt bloat by disabling unused agent tools"
aliases: []
summary: "Created new wiki topic on reducing system prompt bloat by disabling unused agent tools, covering the mechanism of tool-definition inflation, the settings.json disabling workflow, the reasoning-quality rationale, and proxy-based payload auditing."
status: "seed"
tags: 
  - d:llm
  - d:automation
  - system-prompt-bloat
  - tool-disabling
  - token-optimization
  - agent-configuration
  - prompt-efficiency
  - output-quality
  - context-optimization
  - agent-distraction
  - proxy-inspection
  - prompt-auditing
  - token-analysis
  - observability
links: []
source_refs: [{"id":"canonical-claude-codes-system-tools-are-so-bloated-1-2026-07-17t14-01-06-p-1-1","kind":"transcript","node_id":"claude-codes-system-tools-are-so-bloated","title":"Claude Code's system tools are SO BLOATED","url":"https://youtube.com/shorts/oLx4yCbeklQ?si=7sfHRUddwkqMfQHM","locator":"p:1","verification":"source-backed","excerpt":"# Claude Code's system tools are SO BLOATED","validation_notes":[]},{"id":"canonical-claude-codes-system-tools-are-so-bloated-1-2026-07-17t14-01-06-0-00-2","kind":"transcript","node_id":"claude-codes-system-tools-are-so-bloated","title":"Claude Code's system tools are SO BLOATED","url":"https://youtube.com/shorts/oLx4yCbeklQ?si=7sfHRUddwkqMfQHM&t=0","locator":"0:00","verification":"source-backed","excerpt":"Most harnesses, but especially Claude Code, ship with a ton of bloat in the system prompt. There is very likely thousands and thousands of tokens of stuff you're not using in your system prompt. So, when I did mine, I found that I had an whole stuff with workflow, with design sync, with monitor, that I simply wasn't using. And that is about, you know, 8,000, 10,000 tokens per request. Fortunately, Claude Code allows you to customize this stuff, so you can actually put this in your global settings.json file, and you can disable all sorts of useless stuff. So, I didn't want it to control when I entered and exited plan mode. So, I just disabled those tools, and the tool definitions get removed from the system prompt. I personally really hate the ask user question tool, so I never use it, or I never want to see it, and so I just removed the tool definition from Claude system prompt. Equally, I don't want it to schedule crons for me, so I just deleted those as well. I don't use the custom code review skill that ships with it, so I disabled the bundled skills. I disabled everything to do with dynamic workflows. I don't use those either. I even disabled remote control, because there was a","validation_notes":[]}]
source_canonical_idea_ids: 
  - canonical-claude-codes-system-tools-are-so-bloated-1-2026-07-17T14-01-06
  - canonical-claude-codes-system-tools-are-so-bloated-2-2026-07-17T14-01-06
  - canonical-claude-codes-system-tools-are-so-bloated-3-2026-07-17T14-01-06
source_transcript_ids: 
  - claude-codes-system-tools-are-so-bloated
revision: 1
created_at: "2026-07-19T10:57:20Z"
updated_at: "2026-07-19T10:57:20Z"
reviewed_at: "2026-07-19T10:57:20Z"
verification_status: "source-backed"
quality_score: 91
evidence_metrics: {"evidence_ref_count":2,"unique_canonical_idea_count":3,"unique_transcript_count":1,"unique_source_node_count":1,"unique_author_channel_count":1,"independent_source_count":1,"unknown_source_identity_count":0}
quality_dimensions: {"overall_score":91,"passed":true,"dimensions":[{"dimension":"topic_coherence","score":100,"threshold":80,"passed":true,"blocking":true,"issues":[]},{"dimension":"primary_evidence_coverage","score":100,"threshold":70,"passed":true,"blocking":true,"issues":[]},{"dimension":"citation_completeness","score":100,"threshold":80,"passed":true,"blocking":true,"issues":[]},{"dimension":"source_diversity","score":40,"threshold":0,"passed":true,"blocking":false,"issues":[{"code":"single-source","message":"Independent source corroboration is unavailable."}]},{"dimension":"duplication_avoidance","score":100,"threshold":70,"passed":true,"blocking":true,"issues":[]},{"dimension":"update_novelty","score":100,"threshold":50,"passed":true,"blocking":false,"issues":[]},{"dimension":"link_validity","score":100,"threshold":80,"passed":true,"blocking":true,"issues":[]}],"blocking_dimensions":[],"page_coverage":{"primary_total":1,"represented_primary":1,"omitted_primary":0,"excluded_for_siblings":2}}
generation_provider: "opencode"
generation_model: "glm-5.2"
generation_duration_ms: 19842
---

<!-- wiki-section:tool-definitions-as-bloat-source -->

## How tool definitions inflate the system prompt

Agent frameworks such as Claude Code include definitions for every available tool directly in the system prompt sent to the LLM on each request. Even tools the user never invokes—such as plan-mode toggles, the ask-user-question tool, cron scheduling, custom code review skills, dynamic workflows, and remote control—still consume thousands of tokens. In practice, a default Claude Code system prompt can reach approximately 25K tokens, with a large fraction attributable to tool definitions the user does not need. [^canonical-claude-codes-system-tools-are-so-bloated-1-2026-07-17t14-01-06-p-1-1] [^canonical-claude-codes-system-tools-are-so-bloated-1-2026-07-17t14-01-06-0-00-2]

<!-- wiki-section:disabling-tools-via-settings -->

## Disabling unused tools via configuration

Claude Code exposes a settings.json file (global or project-level) where individual tools and bundled skills can be disabled. When a tool is disabled, its full definition is removed from the system prompt rather than merely hidden from the user. Examples of commonly pruned tools include plan-mode entry/exit controls, the ask-user-question tool, cron scheduling, bundled code review skills, dynamic workflows, and remote control. By selectively disabling everything not in active use, the system prompt can shrink from ~25K tokens to roughly 8K tokens per request. [^canonical-claude-codes-system-tools-are-so-bloated-1-2026-07-17t14-01-06-0-00-2]

<!-- wiki-section:quality-beyond-cost -->

## Why smaller prompts improve reasoning, not just cost

Token optimization is often framed as a cost concern, but excess system-prompt context also degrades output quality. When the model must parse large volumes of irrelevant tool definitions, it becomes distracted from the core task, which can erode reasoning performance. Trimming the prompt to only the tools and instructions that matter helps the model focus, making prompt reduction a quality lever as well as an efficiency one. [^canonical-claude-codes-system-tools-are-so-bloated-1-2026-07-17t14-01-06-0-00-2]

<!-- wiki-section:auditing-actual-payload -->

## Auditing the real token payload with a proxy

An agent's own configuration UI may not surface the full extent of system-prompt bloat, since injected tool definitions and framework boilerplate can be invisible to the user. Placing a proxy between the agent and the LLM API makes it possible to inspect the exact tokens shipped in each request, revealing hidden content and confirming that disabled tools have actually been removed from the payload. This observability step is useful both before optimization (to identify what to prune) and after (to verify the reduction took effect). [^canonical-claude-codes-system-tools-are-so-bloated-1-2026-07-17t14-01-06-0-00-2]
