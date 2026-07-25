---
id: "action-delegation-llm-tool-use"
type: "wiki"
topic_key: "action-delegation-llm-tool-use"
title: "Action Delegation in LLM Tool Use"
aliases: []
summary: "Created new wiki topic on action delegation in LLM tool use, covering the delegation mechanism where models instruct applications rather than calling APIs directly, the intent-execution boundary, the integration burden trade-off, and how MCP standardizes the delegation pattern through translation and dynamic discovery."
status: "seed"
tags: 
  - d:llm
  - llm-tool-use
  - action-delegation
  - model-architecture
  - d:integration
  - translator-pattern
  - api-compatibility
  - mcp-positioning
  - service-discovery
  - dynamic-tool-selection
  - mcp-protocol
links: [{"target_wiki_id":"agent-harness-harness-engineering","relation":"related-to","note":"Action delegation defines the intent-execution boundary between model and environment that the agent harness mediates"}]
source_refs: [{"id":"canonical-why-we-need-mcp-when-apis-already-exist-4-2026-07-22t14-00-44-0-00-1","kind":"transcript","node_id":"why-we-need-mcp-when-apis-already-exist","title":"Why We Need MCP When APIs Already Exist 🤔","url":"https://youtube.com/shorts/iGJTw_PWogs?si=2Arc-IzRHvtpEDN1&t=0","locator":"0:00","verification":"source-backed","excerpt":"Why do we need MCP when we already have APIs? Let's understand the difference between both. An API is how two programs talk to each other. Say you have written program A that needs to read messages from Slack, and Slack is our program B here. Slack exposes an endpoint, which is just a URL, something like api.slack.com/messages. Your program sends a request to this URL, and Slack sends back a response with the data. In most production cases, your app won't talk to just Slack. Your app might talk to 10 services: Slack for alerts, Gmail for email, Jira for tickets, Notion for documents, your own database for user records, and five more like them.","validation_notes":[]},{"id":"canonical-why-we-need-mcp-when-apis-already-exist-4-2026-07-22t14-00-44-0-36-2","kind":"transcript","node_id":"why-we-need-mcp-when-apis-already-exist","title":"Why We Need MCP When APIs Already Exist 🤔","url":"https://youtube.com/shorts/iGJTw_PWogs?si=2Arc-IzRHvtpEDN1&t=36","locator":"0:36","verification":"source-backed","excerpt":"For each one of those 10 services, you write the same kind of logic for every app you want to talk to. The authentication, the API calls, the error handling, the retries if API call fails. Now, let's upgrade program A. Imagine you add an LLM to the application, so that the application can think and reason about the situation. And here is the secret that makes everything else in this video easier. The model does not directly make the API call. The model tells the application what action it wants, and your application, normal software outside the model, performs that action.","validation_notes":[]},{"id":"canonical-why-we-need-mcp-when-apis-already-exist-4-2026-07-22t14-00-44-1-05-3","kind":"transcript","node_id":"why-we-need-mcp-when-apis-already-exist","title":"Why We Need MCP When APIs Already Exist 🤔","url":"https://youtube.com/shorts/iGJTw_PWogs?si=2Arc-IzRHvtpEDN1&t=65","locator":"1:05","verification":"source-backed","excerpt":"Basically, situation hasn't changed at all. You still wrote all 10 API integrations by hand. The model now decides which call to make, but you still built every single API call. Now, imagine your org builds a second app, a chat support app for customers, also powered by an LLM. This support app needs to access the same 10 services all over again. Two apps times 10 services, that is 20 piles of integration code your team is writing and maintaining. So, here's the question that led to MCP.","validation_notes":[]}]
source_canonical_idea_ids: 
  - canonical-why-we-need-mcp-when-apis-already-exist-4-2026-07-22T14-00-44
  - canonical-why-we-need-mcp-when-apis-already-exist-2-2026-07-22T14-00-44
  - canonical-why-we-need-mcp-when-apis-already-exist-3-2026-07-22T14-00-44
source_transcript_ids: 
  - why-we-need-mcp-when-apis-already-exist
revision: 1
created_at: "2026-07-24T12:45:18Z"
updated_at: "2026-07-24T12:45:18Z"
reviewed_at: "2026-07-24T12:45:18Z"
verification_status: "source-backed"
quality_score: 91
evidence_metrics: {"evidence_ref_count":3,"unique_canonical_idea_count":3,"unique_transcript_count":1,"unique_source_node_count":1,"unique_author_channel_count":1,"independent_source_count":1,"unknown_source_identity_count":0}
quality_dimensions: {"overall_score":91,"passed":true,"dimensions":[{"dimension":"topic_coherence","score":100,"threshold":80,"passed":true,"blocking":true,"issues":[]},{"dimension":"primary_evidence_coverage","score":100,"threshold":70,"passed":true,"blocking":true,"issues":[]},{"dimension":"citation_completeness","score":100,"threshold":80,"passed":true,"blocking":true,"issues":[]},{"dimension":"source_diversity","score":40,"threshold":0,"passed":true,"blocking":false,"issues":[{"code":"single-source","message":"Independent source corroboration is unavailable."}]},{"dimension":"duplication_avoidance","score":100,"threshold":70,"passed":true,"blocking":true,"issues":[]},{"dimension":"update_novelty","score":100,"threshold":50,"passed":true,"blocking":false,"issues":[]},{"dimension":"link_validity","score":100,"threshold":80,"passed":true,"blocking":true,"issues":[]}],"blocking_dimensions":[],"page_coverage":{"primary_total":1,"represented_primary":1,"omitted_primary":0,"excluded_for_siblings":2}}
generation_provider: "opencode"
generation_model: "glm-5.2"
generation_duration_ms: 23194
---

<!-- wiki-section:delegation-mechanism -->

## How Action Delegation Works

In an LLM-powered application, the model reasons about the situation and determines which action it wants performed, but it does not issue the raw API call itself. Instead, the model communicates its desired action to the application—the normal software running outside the model—and the application carries out the actual request. This means the model's role is to decide and instruct, while the application's role is to execute. The model never touches the underlying service endpoints directly; all authentication, request formatting, and network calls remain the application's responsibility. [^canonical-why-we-need-mcp-when-apis-already-exist-4-2026-07-22t14-00-44-0-36-2]

<!-- wiki-section:intent-vs-execution-boundary -->

## The Boundary Between Intent and Execution

Action delegation creates a clean separation of concerns: the LLM operates at the level of intent—deciding what should happen and why—while the application handles the mechanics of making it happen. This boundary means the model is not burdened with low-level protocol details, error handling, or retry logic. Those concerns stay in the application layer where they can be implemented and maintained with standard software engineering practices. The model's output is a high-level instruction, not a raw HTTP request. [^canonical-why-we-need-mcp-when-apis-already-exist-4-2026-07-22t14-00-44-0-36-2] [^canonical-why-we-need-mcp-when-apis-already-exist-4-2026-07-22t14-00-44-0-00-1]

<!-- wiki-section:integration-burden-tradeoff -->

## Delegation Does Not Eliminate Integration Work

A key trade-off of the delegation model is that adding an LLM to an application does not remove the need to build API integrations by hand. If an application needs to talk to ten services—Slack, Gmail, Jira, Notion, a database, and others—a developer must still write the authentication, API calls, error handling, and retry logic for each one. The model decides which call to make, but every integration must be pre-built. When a second LLM-powered app needs the same ten services, the integration code is duplicated, creating a maintenance burden that scales with the number of apps multiplied by the number of services. [^canonical-why-we-need-mcp-when-apis-already-exist-4-2026-07-22t14-00-44-1-05-3]

<!-- wiki-section:mcp-as-delegation-infrastructure -->

## How MCP Standardizes the Delegation Pattern

The repeated integration burden of the delegation model motivates protocols like MCP. Rather than replacing existing APIs, MCP sits in front of them as a translation layer that exposes API capabilities in a uniform, model-consumable format. MCP servers advertise their available actions at runtime, so clients can dynamically discover and select tools without hard-coded integration lists. This means the application no longer needs to hand-write a unique integration for every service; instead, it connects to MCP servers that wrap existing API infrastructure and present capabilities in a standard interface the model can understand and delegate to. [^canonical-why-we-need-mcp-when-apis-already-exist-4-2026-07-22t14-00-44-1-05-3] [^canonical-why-we-need-mcp-when-apis-already-exist-4-2026-07-22t14-00-44-0-00-1]
