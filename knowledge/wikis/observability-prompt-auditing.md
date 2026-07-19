---
id: "observability-prompt-auditing"
type: "wiki"
topic_key: "observability-prompt-auditing"
title: "Auditing LLM Agent Token Payloads via Proxy Inspection"
aliases: []
summary: "Created wiki topic on proxy-based prompt auditing for LLM agents, synthesizing the primary idea (proxy inspection of token payloads) with supporting ideas on tool-disabling remediation and output-quality benefits of smaller system prompts."
status: "seed"
tags: 
  - d:llm
  - proxy-inspection
  - prompt-auditing
  - token-analysis
  - observability
  - d:automation
  - system-prompt-bloat
  - tool-disabling
  - token-optimization
  - agent-configuration
  - prompt-efficiency
  - output-quality
  - context-optimization
  - agent-distraction
links: [{"target_wiki_id":"agent-configuration-system-prompt-bloat","relation":"supports","note":"Proxy-based payload auditing is the diagnostic technique that enables identifying and disabling unused tools to reduce prompt bloat."}]
source_refs: [{"id":"canonical-claude-codes-system-tools-are-so-bloated-3-2026-07-17t14-01-06-p-1-1","kind":"transcript","node_id":"claude-codes-system-tools-are-so-bloated","title":"Claude Code's system tools are SO BLOATED","url":"https://youtube.com/shorts/oLx4yCbeklQ?si=7sfHRUddwkqMfQHM","locator":"p:1","verification":"source-backed","excerpt":"# Claude Code's system tools are SO BLOATED","validation_notes":[]},{"id":"canonical-claude-codes-system-tools-are-so-bloated-3-2026-07-17t14-01-06-0-00-2","kind":"transcript","node_id":"claude-codes-system-tools-are-so-bloated","title":"Claude Code's system tools are SO BLOATED","url":"https://youtube.com/shorts/oLx4yCbeklQ?si=7sfHRUddwkqMfQHM&t=0","locator":"0:00","verification":"source-backed","excerpt":"Most harnesses, but especially Claude Code, ship with a ton of bloat in the system prompt. There is very likely thousands and thousands of tokens of stuff you're not using in your system prompt. So, when I did mine, I found that I had an whole stuff with workflow, with design sync, with monitor, that I simply wasn't using. And that is about, you know, 8,000, 10,000 tokens per request. Fortunately, Claude Code allows you to customize this stuff, so you can actually put this in your global settings.json file, and you can disable all sorts of useless stuff. So, I didn't want it to control when I entered and exited plan mode. So, I just disabled those tools, and the tool definitions get removed from the system prompt. I personally really hate the ask user question tool, so I never use it, or I never want to see it, and so I just removed the tool definition from Claude system prompt. Equally, I don't want it to schedule crons for me, so I just deleted those as well. I don't use the custom code review skill that ships with it, so I disabled the bundled skills. I disabled everything to do with dynamic workflows. I don't use those either. I even disabled remote control, because there was a","validation_notes":[]}]
source_canonical_idea_ids: 
  - canonical-claude-codes-system-tools-are-so-bloated-3-2026-07-17T14-01-06
  - canonical-claude-codes-system-tools-are-so-bloated-1-2026-07-17T14-01-06
  - canonical-claude-codes-system-tools-are-so-bloated-2-2026-07-17T14-01-06
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
generation_duration_ms: 25452
---

<!-- wiki-section:hidden-prompt-bloat-problem -->

## Hidden System Prompt Bloat in Agent Frameworks

Agent frameworks such as Claude Code embed tool definitions directly in the system prompt. By default, every bundled tool—workflow orchestration, design sync, monitoring, plan-mode toggles, ask-user-question, cron scheduling, custom code review skills, dynamic workflows, and remote control—contributes its full definition to each request. This can inflate the system prompt to roughly 25,000 tokens, much of it describing functionality the user never invokes. The agent's own configuration UI typically does not surface this accumulated content, so the bloat remains invisible without external inspection. [^canonical-claude-codes-system-tools-are-so-bloated-3-2026-07-17t14-01-06-0-00-2]

<!-- wiki-section:proxy-inspection-mechanism -->

## How Proxy Inspection Reveals the Actual Token Payload

Placing a proxy between the agent and the LLM API lets you inspect the exact tokens shipped in each request. The proxy intercepts outgoing API calls and exposes the full system prompt, tool definitions, and any other context the framework injects—content that is otherwise opaque. This is the key mechanism for prompt auditing: rather than trusting the agent's settings panel, you observe the wire-level payload directly. The audit can reveal which tool definitions are present, how many tokens each consumes, and whether disabling a tool in configuration actually removed its definition from the request. [^canonical-claude-codes-system-tools-are-so-bloated-3-2026-07-17t14-01-06-p-1-1] [^canonical-claude-codes-system-tools-are-so-bloated-3-2026-07-17t14-01-06-0-00-2]

<!-- wiki-section:remediation-by-disabling-tools -->

## Disabling Unused Tools to Shrink the System Prompt

Once the proxy audit identifies unused tool definitions, they can be disabled in the agent's settings file (e.g., Claude Code's global settings.json). Disabling a tool removes its definition from the system prompt entirely, not just from the available actions. Examples include disabling plan-mode toggles, the ask-user-question tool, cron scheduling, bundled code-review skills, dynamic workflows, and remote control. In practice, stripping unused tools can cut the system prompt from approximately 25K tokens down to around 8K tokens per request. [^canonical-claude-codes-system-tools-are-so-bloated-3-2026-07-17t14-01-06-0-00-2]

<!-- wiki-section:quality-beyond-cost -->

## Why Smaller Prompts Improve Output Quality, Not Just Cost

Token optimization is often framed as a cost concern, but excess system-prompt context also degrades reasoning quality. When the model must parse thousands of tokens of irrelevant tool definitions, it becomes distracted from the core task. Reducing prompt size therefore improves output quality directly, because the model's attention is concentrated on the user's actual request rather than dispersed across unused capabilities. This trade-off—between framework convenience and reasoning fidelity—is the underlying motivation for auditing and trimming the payload. [^canonical-claude-codes-system-tools-are-so-bloated-3-2026-07-17t14-01-06-0-00-2]
