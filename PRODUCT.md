# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Software engineers who are learning system design or preparing for a system design interview.

## Product Purpose

Provide a short, ordered set of lecture notes from the System Design Primer. Help the reader understand system design terms, request paths, and trade-offs. Success means the reader can explain each topic and apply it to a simple design question.

## Positioning

The book turns a large, link-heavy reference into a first-pass study sequence. It keeps the original repository as the source of topic order and diagrams, and adds verified source links and caption-derived video cues.

## Operating Context

The reader studies in a browser. The reader may read on a laptop or print the notes. The reader uses source links for deeper study. The reader uses the notes for spaced review and interview practice.

## Capabilities and Constraints

- The book covers twenty lectures. The first ten follow the repository's main topic order. The next ten turn the repository's database, cache, communication, security, estimation, and interview material into a study sequence.
- The lectures are Performance vs Scalability; Latency vs Throughput; Availability vs Consistency; Consistency Patterns; Availability Patterns; Domain Name System; Content Delivery Network; Load Balancer; Reverse Proxy; Application Layer; Database; Cache; Asynchronism; Communication; TCP vs UDP; RPC vs REST; Security; Back-of-Envelope Estimation; Interview Method; and Capstone: A System That Scales.
- Every lecture includes an AWS mapping. It names the AWS service, the request-path use, and one AWS-specific trade-off or failure case.
- Every lecture includes a public interview exercise or prompt that is linked to its repository source.
- The notes use short sentences, defined terms, active voice, and one instruction at a time.
- The book must not invent benchmarks, customer claims, product claims, or system guarantees.
- Full video captions are not reproduced. The book records caption availability and uses short, paraphrased caption-derived study cues.

## Evidence on Hand

- The repository README is the primary content source: `README.md`.
- Repository diagrams are in `images/`.
- Repository source links are preserved in the book source list.
- Verified source links include All Things Distributed, Cadence Community, Robert Greiner, Cloudflare, AWS, Google SRE, NGINX, HashiCorp Consul, and Martin Fowler.
- AWS links cover the Well-Architected Framework, Route 53, CloudFront, Elastic Load Balancing, API Gateway, Cloud Map, Aurora, DynamoDB, ElastiCache, SQS, IAM, KMS, WAF, and CloudWatch.
- YouTube caption tracks were found for the repository's CAP theorem video, Harvard scalability lecture, Transactions Across Datacenters, and architecture interview video.

## Product Principles

- Teach the request path before the implementation detail.
- State the trade-off before recommending a pattern.
- Use one term for one concept.
- Keep examples small and explicit.
- Link to the source that supports each important idea.

## Accessibility & Inclusion

- Use semantic HTML and keyboard-visible focus.
- Keep body text readable on small screens and in print.
- Provide text alternatives for diagrams.
- Do not rely on color alone to identify state.
