# Sources and caption check

This register supports `book/index.html` and its 20-lecture field book.

## Source roles

- Repository source: a link present in the original `README.md` topic section.
- Supplemental source: a current or more direct source added for study.
- Video source: a video linked by the repository or by a source page.

## Caption check

The following YouTube pages exposed English caption tracks when checked on 2026-09-16.

| Video | Caption status | Use in the book |
|---|---|---|
| [Harvard scalability lecture](https://www.youtube.com/watch?v=-W9F__D3oY4&cc_load_policy=1) | English auto-generated captions | Lecture 01 and orientation. |
| [L16: The CAP Theorem](https://www.youtube.com/watch?v=k-Yaq8AHlFA&cc_load_policy=1) | English caption track | Lecture 03. |
| [Transactions Across Datacenters](https://www.youtube.com/watch?v=srOgpXECblk&cc_load_policy=1) | English caption tracks | Lecture 04. |
| [Intro to Architecture and Systems Design Interviews](https://www.youtube.com/watch?v=ZgdS0EUmn70&cc_load_policy=1) | English auto-generated captions | Repository orientation source. |
| [Scaling up to your first 10 million users](https://www.youtube.com/watch?v=kKjm4ehYiMs&cc_load_policy=1) | English auto-generated captions | Lectures 01, 05, 08, 10, and 20. |
| [Introduction to NoSQL](https://www.youtube.com/watch?v=qI_g07C_Q5I&cc_load_policy=1) | English auto-generated captions | Lecture 11. |
| [It's All a Numbers Game](https://www.youtube.com/watch?v=1KRYH75wgy4&cc_load_policy=1) | English auto-generated captions | Lecture 18. |
| [How We've Scaled Dropbox](https://www.youtube.com/watch?v=PE4gwstWhmc&cc_load_policy=1) | English auto-generated captions | Lectures 07, 11, 13, and 20. |
| [Big and Small Data at Twitter](https://www.youtube.com/watch?v=5cKTP36HVgI&cc_load_policy=1) | English auto-generated captions | Lectures 11, 12, and 19. |
| [YouTube Scalability](https://www.youtube.com/watch?v=w5WVu624fY8&cc_load_policy=1) | English auto-generated captions | Lectures 07, 08, and 20. |
| [Operations at Twitter: Scaling Beyond 100 Million Users](https://www.youtube.com/watch?v=z8LU0Cj6BOU&cc_load_policy=1) | English auto-generated captions | Lectures 05, 08, and 19. |

The book does not copy full captions. It gives short, paraphrased study cues. Open each video with captions for the full spoken source.

## Topic map

### 01 — Performance vs Scalability

- [A Word on Scalability](https://www.allthingsdistributed.com/2006/03/a_word_on_scalability.html)
- [Scalability, Availability, Stability, Patterns](https://www.slideshare.net/slideshow/scalability-availability-stability-patterns/4062682)
- [Harvard scalability lecture](https://www.youtube.com/watch?v=-W9F__D3oY4&cc_load_policy=1)

### 02 — Latency vs Throughput

- [Understanding Latency versus Throughput](https://community.cadence.com/cadence_blogs_8/b/fv/posts/understanding-latency-vs-throughput)
- [Cornell lecture slides](https://www.cs.cornell.edu/courses/cs5150/2022sp/lecture/lec20-slides.pdf)

### 03 — Availability vs Consistency

- [CAP Theorem: Revisited](https://robertgreiner.com/cap-theorem-revisited/)
- [CAP FAQ](https://github.com/henryr/cap-faq)
- [L16: The CAP Theorem](https://www.youtube.com/watch?v=k-Yaq8AHlFA&cc_load_policy=1)

### 04 — Consistency Patterns

- [Transactions Across Datacenters](https://snarfed.org/transactions_across_datacenters_io.html)
- [Google I/O 2009 — Transactions Across Datacenters](https://www.youtube.com/watch?v=srOgpXECblk&cc_load_policy=1)
- [Eventually Consistent — Revisited](https://www.allthingsdistributed.com/2008/12/eventually_consistent.html)

### 05 — Availability Patterns

- [Availability Patterns in the System Design Primer](https://github.com/donnemartin/system-design-primer/blob/master/README.md#availability-patterns)
- [Google SRE availability table](https://sre.google/sre-book/availability-table/)
- [AWS: Static stability using Availability Zones](https://aws.amazon.com/builders-library/static-stability-using-availability-zones/)

### 06 — Domain Name System

- [RFC 1034 — Domain Names: Concepts and Facilities](https://datatracker.ietf.org/doc/html/rfc1034)
- [Cloudflare: What is a DNS server?](https://www.cloudflare.com/learning/dns/what-is-a-dns-server/)
- [Amazon Route 53 latency-based routing](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy-latency.html)

### 07 — Content Delivery Network

- [Globally distributed content delivery](https://figshare.com/articles/Globally_distributed_content_delivery/6605972)
- [Cloudflare Cache and CDN documentation](https://developers.cloudflare.com/cache/)
- [Cloudflare: Retention vs Freshness](https://developers.cloudflare.com/cache/concepts/retention-vs-freshness/)

### 08 — Load Balancer

- [AWS: What is Elastic Load Balancing?](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/what-is-load-balancing.html)
- [AWS: How Elastic Load Balancing works](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html)
- [NGINX architecture](https://www.nginx.com/blog/inside-nginx-how-we-designed-for-performance-scale/)

### 09 — Reverse Proxy

- [NGINX: Reverse proxy vs load balancer](https://www.nginx.com/resources/glossary/reverse-proxy-vs-load-balancer/)
- [NGINX proxy module documentation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [HAProxy architecture guide](http://www.haproxy.org/download/1.2/doc/architecture.txt)

### 10 — Application Layer

- [Intro to Architecting Systems for Scale](https://lethain.com/introduction-to-architecting-systems-for-scale/#platform_layer)
- [Martin Fowler: Microservices](https://martinfowler.com/articles/microservices.html)
- [HashiCorp Consul: Discover services](https://developer.hashicorp.com/consul/docs/discover)
- [AWS Prescriptive Guidance: Cloud design patterns](https://docs.aws.amazon.com/en_en/prescriptive-guidance/latest/cloud-design-patterns/introduction.html)

### 11 — Database

- [System Design Primer: Databases](https://github.com/donnemartin/system-design-primer#databases)
- [Design Mint.com](https://github.com/donnemartin/system-design-primer/tree/master/solutions/system_design/mint)
- [Amazon Aurora high availability](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Concepts.AuroraHighAvailability.html)

### 12 — Cache

- [System Design Primer: Cache](https://github.com/donnemartin/system-design-primer#cache)
- [Design a key-value store for a search engine](https://github.com/donnemartin/system-design-primer/tree/master/solutions/system_design/query_cache)
- [Amazon ElastiCache](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.html)

### 13 — Asynchronism

- [System Design Primer: Asynchronism](https://github.com/donnemartin/system-design-primer#asynchronism)
- [Design a web crawler](https://github.com/donnemartin/system-design-primer/tree/master/solutions/system_design/web_crawler)
- [Amazon SQS Developer Guide](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html)

### 14 — Communication

- [System Design Primer: Communication](https://github.com/donnemartin/system-design-primer#communication)
- [Design Pastebin.com or Bit.ly](https://github.com/donnemartin/system-design-primer/tree/master/solutions/system_design/pastebin)
- [Amazon API Gateway Developer Guide](https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html)

### 15 — TCP vs UDP

- [System Design Primer: TCP and UDP](https://github.com/donnemartin/system-design-primer#tcp-and-udp)
- [Design a chat server](https://github.com/donnemartin/system-design-primer#object-oriented-design-interview-questions-with-solutions)
- [AWS Network Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html)

### 16 — RPC vs REST

- [System Design Primer: RESTful API](https://github.com/donnemartin/system-design-primer#restful-api)
- [Design Google Docs](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions)
- [API Gateway HTTP APIs and REST APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html)

### 17 — Security

- [System Design Primer: Security](https://github.com/donnemartin/system-design-primer#security)
- [Design Mint.com](https://github.com/donnemartin/system-design-primer/tree/master/solutions/system_design/mint)
- [AWS Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html)

### 18 — Back-of-Envelope Estimation

- [System Design Primer: Back-of-the-envelope estimations](https://github.com/donnemartin/system-design-primer#back-of-the-envelope-estimations)
- [Design Amazon's sales ranking by category](https://github.com/donnemartin/system-design-primer/tree/master/solutions/system_design/sales_rank)
- [AWS Pricing Calculator](https://calculator.aws/)

### 19 — Interview Method

- [How to approach a system design interview question](https://github.com/donnemartin/system-design-primer#how-to-approach-a-system-design-interview-question)
- [Design the Twitter timeline and search](https://github.com/donnemartin/system-design-primer/tree/master/solutions/system_design/twitter)
- [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html)

### 20 — Capstone: A System That Scales

- [Design a system that scales to millions of users on AWS](https://github.com/donnemartin/system-design-primer/tree/master/solutions/system_design/scaling_aws)
- [System Design Primer interview questions with solutions](https://github.com/donnemartin/system-design-primer#system-design-interview-questions-with-solutions)
- [The pillars of the AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/the-pillars-of-the-framework.html)

## AWS source register

These sources support the AWS mapping in each lecture. The book keeps the mapping practical: service, request path, and trade-off.

| AWS area | Source |
|---|---|
| Framework | [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html) |
| Performance | [Performance Efficiency Pillar](https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/welcome.html) |
| Reliability | [Reliability Pillar](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html) |
| Security | [Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html) |
| Name routing | [Amazon Route 53 Developer Guide](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/Welcome.html) |
| Edge delivery | [Amazon CloudFront Developer Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html) |
| Traffic routing | [Elastic Load Balancing](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/what-is-load-balancing.html) |
| Public APIs | [Amazon API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html) |
| Service discovery | [AWS Cloud Map](https://docs.aws.amazon.com/cloud-map/latest/dg/what-is-cloud-map.html) |
| Relational data | [Amazon Aurora high availability](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Concepts.AuroraHighAvailability.html) |
| Distributed data | [DynamoDB global tables](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html) |
| Read guarantees | [DynamoDB read consistency](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html) |
| Cache | [Amazon ElastiCache](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.html) |
| Asynchronous work | [Amazon SQS Developer Guide](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html) |
| Transport | [AWS Network Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html) |
| Workload review | [AWS Well-Architected pillars](https://docs.aws.amazon.com/wellarchitected/latest/framework/the-pillars-of-the-framework.html) |

## Interview source note

The interview blocks use public exercises listed in the System Design Primer. They are practice prompts and public solution pages. The book does not claim that every prompt was asked by a named company or interviewer.
