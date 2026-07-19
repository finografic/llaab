---
id: "agent-distraction-context-optimization"
type: "wiki"
topic_key: "agent-distraction-context-optimization"
title: "Reducing System Prompt Bloat to Improve Agent Output Quality"
aliases: []
summary: "Created wiki topic on reducing system prompt bloat to improve agent output quality, covering the distraction mechanism, tool-disabling strategy, and proxy-based payload auditing."
status: "seed"
tags: 
  - d:llm
  - prompt-efficiency
  - output-quality
  - context-optimization
  - agent-distraction
  - d:automation
  - system-prompt-bloat
  - tool-disabling
  - token-optimization
  - agent-configuration
  - proxy-inspection
  - prompt-auditing
  - token-analysis
  - observability
links: [{"target_wiki_id":"agent-configuration-system-prompt-bloat","relation":"extends","note":"Focuses specifically on the agent-distraction mechanism behind prompt bloat, extending the broader configuration-workflow topic."}]
source_refs: [{"id":"canonical-claude-codes-system-tools-are-so-bloated-2-2026-07-17t14-01-06-p-1-1","kind":"transcript","node_id":"claude-codes-system-tools-are-so-bloated","title":"Claude Code's system tools are SO BLOATED","url":"https://youtube.com/shorts/oLx4yCbeklQ?si=7sfHRUddwkqMfQHM","locator":"p:1","verification":"source-backed","excerpt":"# Claude Code's system tools are SO BLOATED","validation_notes":[]},{"id":"canonical-claude-codes-system-tools-are-so-bloated-2-2026-07-17t14-01-06-0-00-2","kind":"transcript","node_id":"claude-codes-system-tools-are-so-bloated","title":"Claude Code's system tools are SO BLOATED","url":"https://youtube.com/shorts/oLx4yCbeklQ?si=7sfHRUddwkqMfQHM&t=0","locator":"0:00","verification":"source-backed","excerpt":"Most harnesses, but especially Claude Code, ship with a ton of bloat in the system prompt. There is very likely thousands and thousands of tokens of stuff you're not using in your system prompt. So, when I did mine, I found that I had an whole stuff with workflow, with design sync, with monitor, that I simply wasn't using. And that is about, you know, 8,000, 10,000 tokens per request. Fortunately, Claude Code allows you to customize this stuff, so you can actually put this in your global settings.json file, and you can disable all sorts of useless stuff. So, I didn't want it to control when I entered and exited plan mode. So, I just disabled those tools, and the tool definitions get removed from the system prompt. I personally really hate the ask user question tool, so I never use it, or I never want to see it, and so I just removed the tool definition from Claude system prompt. Equally, I don't want it to schedule crons for me, so I just deleted those as well. I don't use the custom code review skill that ships with it, so I disabled the bundled skills. I disabled everything to do with dynamic workflows. I don't use those either. I even disabled remote control, because there was a","validation_notes":[]}]
source_canonical_idea_ids: 
  - canonical-claude-codes-system-tools-are-so-bloated-2-2026-07-17T14-01-06
  - canonical-claude-codes-system-tools-are-so-bloated-1-2026-07-17T14-01-06
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
generation_duration_ms: 13261
---

<!-- wiki-section:distraction-mechanism -->

## Why excess context degrades reasoning

Token optimization in system prompts is not purely a cost concern. Excess context—such as tool definitions, workflow instructions, and bundled skills the user never invokes—distracts the model from the core task and directly degrades reasoning quality. The more irrelevant material the model must parse, the harder it becomes to stay focused on the user's actual intent, so shrinking the system prompt can improve output quality even when cost is not a factor. [^canonical-claude-codes-system-tools-are-so-bloated-2-2026-07-17t14-01-06-p-1-1] [^canonical-claude-codes-system-tools-are-so-bloated-2-2026-07-17t14-01-06-0-00-2]

<!-- wiki-section:tool-disabling-strategy -->

## Disabling unused tools to cut prompt size

Agent frameworks like Claude Code ship with many tool definitions embedded in the system prompt by default, bloating it to roughly 25K tokens. Disabling unused tools in settings.json removes their definitions from the system prompt entirely, cutting size dramatically—for example, from 25K down to around 8K tokens. Practical examples include disabling tools for plan-mode transitions, the ask-user-question tool, cron scheduling, bundled code-review skills, dynamic workflows, and remote control when those features are not needed. [^canonical-claude-codes-system-tools-are-so-bloated-2-2026-07-17t14-01-06-0-00-2]

<!-- wiki-section:proxy-auditing -->

## Auditing the real payload with a proxy

An agent's own configuration UI may not reveal the full system prompt content shipped to the LLM. Placing a proxy between the agent and the LLM API lets you inspect the exact tokens sent per request, exposing hidden bloat such as bundled tool definitions and workflow instructions. This observability step is useful for verifying that disabling tools actually reduces the payload and for discovering prompt content that is not surfaced in the agent's settings. [^canonical-claude-codes-system-tools-are-so-bloated-2-2026-07-17t14-01-06-0-00-2]
