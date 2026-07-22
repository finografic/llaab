---
id: "blast-radius-iam-roles"
type: "wiki"
topic_key: "blast-radius-iam-roles"
title: "Blast Radius Containment via Least-Privilege IAM Roles"
aliases: []
summary: "Created new wiki topic on blast radius containment via least-privilege IAM roles, covering minimum-permission role scoping as a defense-in-depth control, upstream API Gateway authorization as a complementary layer, and the distinction between network isolation and implicit trust."
status: "seed"
tags: 
  - d:infra
  - least-privilege
  - iam-roles
  - blast-radius
  - signature-v4
  - api-gateway
  - iam-authorization
  - temporary-credentials
links: []
source_refs: [{"id":"canonical-zero-trust-explained-in-5-minutes-3-2026-07-18t08-00-20-1-11-1","kind":"transcript","node_id":"zero-trust-explained-in-5-minutes","title":"Zero Trust Explained in 5 Minutes","url":"https://youtu.be/q2phcnesXvY?si=tdUW68S_V7mOvXw-&t=71","locator":"1:11","verification":"source-backed","excerpt":"Let's get into it. There are two sides to this build. Something worth protecting and something that has to prove itself to reach it. Protected side first, starting with the thing an attacker would actually want. That's a DynamoDB table holding our internal inventory. Inside it, we'll plant one item. A gadget whose status says exactly what's at stake. Top secret. DynamoDB encrypts this at rest, so even if someone got hold of the physical storage underneath, the bytes are useless to them. First zero-trust principle, before we've built any API at all, protect the data itself, not just the road to it.","validation_notes":[]},{"id":"canonical-zero-trust-explained-in-5-minutes-3-2026-07-18t08-00-20-1-46-2","kind":"transcript","node_id":"zero-trust-explained-in-5-minutes","title":"Zero Trust Explained in 5 Minutes","url":"https://youtu.be/q2phcnesXvY?si=tdUW68S_V7mOvXw-&t=106","locator":"1:46","verification":"source-backed","excerpt":"Now, something has to read that table. We'll add a Lambda function. And here is where zero trust gets concrete. The IAM role we give this function is read-only on DynamoDB. It can fetch inventory. It is physically incapable of changing or deleting it. If an attacker ever hijacked this code, the blast radius is already capped. That's least privilege. Every piece gets the minimum it needs, nothing more. The lambda needs a front door, so we put API Gateway in front of it. A REST API with one route, a get for the inventory. And then we flip the most important switch in this entire build.","validation_notes":[]},{"id":"canonical-zero-trust-explained-in-5-minutes-3-2026-07-18t08-00-20-2-23-3","kind":"transcript","node_id":"zero-trust-explained-in-5-minutes","title":"Zero Trust Explained in 5 Minutes","url":"https://youtu.be/q2phcnesXvY?si=tdUW68S_V7mOvXw-&t=143","locator":"2:23","verification":"source-backed","excerpt":"On that method, authorization changes from none to AWS IAM. From this moment, every request must arrive carrying a cryptographic signature generated from real AWS credentials. No signature, the gateway answers with a 403, and our lambda never even wakes up. Anonymous traffic doesn't get to talk to our code at all. That's the protected side. Now, the other half of the handshake, the side that has to prove itself.","validation_notes":[]},{"id":"canonical-zero-trust-explained-in-5-minutes-2-2026-07-18t08-00-20-2-50-3","kind":"transcript","node_id":"zero-trust-explained-in-5-minutes","title":"Zero Trust Explained in 5 Minutes","url":"https://youtu.be/q2phcnesXvY?si=tdUW68S_V7mOvXw-&t=170","locator":"2:50","verification":"source-backed","excerpt":"Our internal client needs somewhere to live, so we create a network for it. A VPC with a public subnet, an internet gateway, and a route out. And here's the twist. In the old model, this network would be the security. Anything inside it, trusted. In ours, the VPC gives us isolation and control over traffic, and that's all. Being inside it earns a machine exactly nothing. Into that subnet, we launch the client, a small EC2 instance.","validation_notes":[]}]
source_canonical_idea_ids: 
  - canonical-zero-trust-explained-in-5-minutes-3-2026-07-18T08-00-20
  - canonical-zero-trust-explained-in-5-minutes-2-2026-07-18T08-00-20
source_transcript_ids: 
  - zero-trust-explained-in-5-minutes
revision: 1
created_at: "2026-07-22T10:22:23Z"
updated_at: "2026-07-22T10:22:23Z"
reviewed_at: "2026-07-22T10:22:23Z"
verification_status: "source-backed"
quality_score: 91
evidence_metrics: {"evidence_ref_count":4,"unique_canonical_idea_count":2,"unique_transcript_count":1,"unique_source_node_count":1,"unique_author_channel_count":1,"independent_source_count":1,"unknown_source_identity_count":0}
quality_dimensions: {"overall_score":91,"passed":true,"dimensions":[{"dimension":"topic_coherence","score":100,"threshold":80,"passed":true,"blocking":true,"issues":[]},{"dimension":"primary_evidence_coverage","score":100,"threshold":70,"passed":true,"blocking":true,"issues":[]},{"dimension":"citation_completeness","score":100,"threshold":80,"passed":true,"blocking":true,"issues":[]},{"dimension":"source_diversity","score":40,"threshold":0,"passed":true,"blocking":false,"issues":[{"code":"single-source","message":"Independent source corroboration is unavailable."}]},{"dimension":"duplication_avoidance","score":100,"threshold":70,"passed":true,"blocking":true,"issues":[]},{"dimension":"update_novelty","score":100,"threshold":50,"passed":true,"blocking":false,"issues":[]},{"dimension":"link_validity","score":100,"threshold":80,"passed":true,"blocking":true,"issues":[]}],"blocking_dimensions":[],"page_coverage":{"primary_total":1,"represented_primary":1,"omitted_primary":0,"excluded_for_siblings":1}}
generation_provider: "opencode"
generation_model: "glm-5.2"
generation_duration_ms: 69475
---

<!-- wiki-section:blast-radius-capping -->

## Capping blast radius with minimum-permission roles

When an application is compromised, the permissions attached to its IAM role define the ceiling on what an attacker can do. Scoping that role to only the actions the code legitimately needs—such as read-only access to a specific DynamoDB table—means a hijacked Lambda can fetch inventory records but cannot modify or delete them. The blast radius is capped at the role's permission boundary regardless of what the attacker attempts. This principle extends a layered defense that starts with protecting the data itself, such as encrypting tables at rest, so that even physical storage compromise yields useless bytes. [^canonical-zero-trust-explained-in-5-minutes-3-2026-07-18t08-00-20-1-46-2] [^canonical-zero-trust-explained-in-5-minutes-3-2026-07-18t08-00-20-1-11-1]

<!-- wiki-section:upstream-authorization -->

## Upstream authorization as a complementary layer

Least-privilege roles limit what compromised code can do, but per-request authorization at the API Gateway blocks unauthorized traffic before compute resources even activate. When IAM authorization is enabled on a gateway method, every request must carry a SigV4 cryptographic signature generated from real AWS credentials. Unsigned requests receive a 403 and the downstream Lambda never wakes up. This upstream gate and the downstream role scoping are complementary: the gateway prevents anonymous access, while the IAM role ensures that even authenticated, legitimate code cannot exceed its intended permissions. [^canonical-zero-trust-explained-in-5-minutes-3-2026-07-18t08-00-20-2-23-3] [^canonical-zero-trust-explained-in-5-minutes-3-2026-07-18t08-00-20-1-46-2]

<!-- wiki-section:network-isolation-vs-trust -->

## Network isolation without implicit trust

A VPC provides isolation and traffic control, but in a zero-trust model, being inside the network earns a machine nothing. The older perimeter model treated network membership as sufficient trust; the zero-trust approach separates connectivity from authorization. A client EC2 instance in a public subnet can reach the internet through a gateway, but it still must present valid credentials to call the API. This distinction matters because it shifts the security boundary from network placement to identity and permissions—exactly the scope that least-privilege IAM roles govern. [^canonical-zero-trust-explained-in-5-minutes-2-2026-07-18t08-00-20-2-50-3]
