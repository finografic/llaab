---
id: "credential-management-ec2-instance-connect"
type: "wiki"
topic_key: "credential-management-ec2-instance-connect"
title: "Keyless EC2 Access Through Instance Connect"
aliases: []
summary: "Created new wiki topic on keyless EC2 access via Instance Connect, covering static credential theft surface elimination, ephemeral shell access mechanism, IAM role identity replacing network-bound trust, and least-privilege blast-radius containment with per-request SigV4 authorization."
status: "seed"
tags: 
  - d:infra
  - keyless-access
  - ec2-instance-connect
  - credential-management
  - signature-v4
  - api-gateway
  - iam-authorization
  - temporary-credentials
links: []
source_refs: [{"id":"canonical-zero-trust-explained-in-5-minutes-5-2026-07-18t08-00-20-2-23-1","kind":"transcript","node_id":"zero-trust-explained-in-5-minutes","title":"Zero Trust Explained in 5 Minutes","url":"https://youtu.be/q2phcnesXvY?si=tdUW68S_V7mOvXw-&t=143","locator":"2:23","verification":"source-backed","excerpt":"On that method, authorization changes from none to AWS IAM. From this moment, every request must arrive carrying a cryptographic signature generated from real AWS credentials. No signature, the gateway answers with a 403, and our lambda never even wakes up. Anonymous traffic doesn't get to talk to our code at all. That's the protected side. Now, the other half of the handshake, the side that has to prove itself.","validation_notes":[]},{"id":"canonical-zero-trust-explained-in-5-minutes-5-2026-07-18t08-00-20-2-50-2","kind":"transcript","node_id":"zero-trust-explained-in-5-minutes","title":"Zero Trust Explained in 5 Minutes","url":"https://youtu.be/q2phcnesXvY?si=tdUW68S_V7mOvXw-&t=170","locator":"2:50","verification":"source-backed","excerpt":"Our internal client needs somewhere to live, so we create a network for it. A VPC with a public subnet, an internet gateway, and a route out. And here's the twist. In the old model, this network would be the security. Anything inside it, trusted. In ours, the VPC gives us isolation and control over traffic, and that's all. Being inside it earns a machine exactly nothing. Into that subnet, we launch the client, a small EC2 instance.","validation_notes":[]},{"id":"canonical-zero-trust-explained-in-5-minutes-5-2026-07-18t08-00-20-3-18-3","kind":"transcript","node_id":"zero-trust-explained-in-5-minutes","title":"Zero Trust Explained in 5 Minutes","url":"https://youtu.be/q2phcnesXvY?si=tdUW68S_V7mOvXw-&t=198","locator":"3:18","verification":"source-backed","excerpt":"Notice what we don't give it. No SSH key pair at all. When we need a shell, we'll connect through instance connect. No keys to leak, no passwords to steal. What it does get is the only thing that matters here, an identity. We attach an IAM role with exactly one permission, invoke API Gateway. This machine can't read the table directly, can't touch the lambda. All it can do is knock on the front door and prove who it is.","validation_notes":[]},{"id":"canonical-zero-trust-explained-in-5-minutes-2-2026-07-18t08-00-20-1-46-1","kind":"transcript","node_id":"zero-trust-explained-in-5-minutes","title":"Zero Trust Explained in 5 Minutes","url":"https://youtu.be/q2phcnesXvY?si=tdUW68S_V7mOvXw-&t=106","locator":"1:46","verification":"source-backed","excerpt":"Now, something has to read that table. We'll add a Lambda function. And here is where zero trust gets concrete. The IAM role we give this function is read-only on DynamoDB. It can fetch inventory. It is physically incapable of changing or deleting it. If an attacker ever hijacked this code, the blast radius is already capped. That's least privilege. Every piece gets the minimum it needs, nothing more. The lambda needs a front door, so we put API Gateway in front of it. A REST API with one route, a get for the inventory. And then we flip the most important switch in this entire build.","validation_notes":[]}]
source_canonical_idea_ids: 
  - canonical-zero-trust-explained-in-5-minutes-5-2026-07-18T08-00-20
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
generation_duration_ms: 69398
---

<!-- wiki-section:static-credential-theft-surface -->

## Static SSH credentials as a persistent attack surface

EC2 instances provisioned with SSH key pairs carry persistent credentials that remain viable indefinitely. These keys are a theft vector: if an attacker extracts a key from an operator environment or a compromised host, they gain direct shell access without traversing any authorization layer. The traditional security model compounded this exposure by treating network membership as sufficient trust—anything inside the VPC was considered trusted by default, so credential theft within that boundary went unchecked. Under zero trust, the VPC provides isolation and traffic control only; being inside the network earns a machine nothing. Removing SSH key pairs at provisioning time eliminates the credential artifact itself, closing the theft path rather than merely guarding it. [^canonical-zero-trust-explained-in-5-minutes-5-2026-07-18t08-00-20-3-18-3] [^canonical-zero-trust-explained-in-5-minutes-5-2026-07-18t08-00-20-2-50-2]

<!-- wiki-section:ephemeral-access-instance-connect -->

## Ephemeral shell access via EC2 Instance Connect

Instead of embedding SSH key pairs at launch, operators use EC2 Instance Connect to obtain shell access on demand. The service issues short-lived access credentials for the duration of a session; when the session ends, no residual credentials remain on the instance or in the access path. There are no keys to leak and no passwords to steal—the credential theft surface associated with static SSH access is removed entirely. The instance still receives an identity in the form of an IAM role, which is the only durable attribute that matters for authorization. That role, not a key pair, determines what the machine can do. [^canonical-zero-trust-explained-in-5-minutes-5-2026-07-18t08-00-20-3-18-3]

<!-- wiki-section:iam-role-identity-vs-network-trust -->

## IAM role identity replacing network-bound trust

In the keyless model, the EC2 instance's identity is its IAM role, not its network location. The VPC and its subnets provide isolation and routing control, but membership in that network confers no trust. What the instance receives instead is an attached IAM role that defines exactly what it may do. When the instance calls downstream services, each request must carry a cryptographic signature generated from temporary AWS credentials obtained through that role. Downstream gateways validate the signature before any compute resource activates; unsigned or anonymous traffic is rejected with a 403 before the target service wakes up. This shifts authorization from the network layer to per-request IAM validation, using temporary credentials that contain no hardcoded secrets. [^canonical-zero-trust-explained-in-5-minutes-5-2026-07-18t08-00-20-2-50-2] [^canonical-zero-trust-explained-in-5-minutes-5-2026-07-18t08-00-20-2-23-1] [^canonical-zero-trust-explained-in-5-minutes-5-2026-07-18t08-00-20-3-18-3]

<!-- wiki-section:least-privilege-blast-radius -->

## Least-privilege scoping and blast-radius containment

The IAM role attached to a keyless EC2 instance is scoped to the minimum permissions required for its function. In practice, this may mean a single permission—such as invoking an API Gateway—while direct access to databases or other compute resources is withheld. The machine can knock on the front door and prove who it is, but it cannot read tables directly or touch downstream Lambda functions. If an attacker compromises the instance, the blast radius is capped by the role's narrow scope. This least-privilege constraint applies symmetrically across the architecture: downstream Lambda functions receive read-only database roles, and API Gateway enforces IAM authorization before invoking compute, so every component's permissions are independently minimized. [^canonical-zero-trust-explained-in-5-minutes-5-2026-07-18t08-00-20-3-18-3] [^canonical-zero-trust-explained-in-5-minutes-2-2026-07-18t08-00-20-1-46-1] [^canonical-zero-trust-explained-in-5-minutes-5-2026-07-18t08-00-20-2-23-1]
