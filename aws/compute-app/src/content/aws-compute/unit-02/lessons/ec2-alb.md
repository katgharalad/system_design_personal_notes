# Application Load Balancers and health checks

**Prerequisite:** EC2 networking. **Sources:** [Application Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html), [target health checks](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html).

## Learning objectives
- Trace DNS, listener, rule, target group, and target request flow.
- Distinguish liveness from readiness and explain fail-open cases.
- Configure health thresholds and deregistration around app behavior.

## Problem

Users report intermittent 502s even though instances show `running`. A load balancer routes only to targets it considers eligible; it does not understand application semantics unless the configured health endpoint represents them.

## Definition and terminology

An ALB is a Layer 7 load balancer for HTTP/HTTPS. A listener accepts connections on a port/protocol. Rules select actions by host/path/header conditions. A target group defines targets, protocol/port, health check, and routing attributes. Targets can be instance IDs, IPs, or Lambda depending on target type. Health check is a synthetic request, not a full user journey.

## Internal operation

Client resolves ALB DNS and connects to a healthy ALB node. Listener TLS policy terminates or forwards protocol; rule selects target group; ALB chooses registered healthy target and opens a separate connection. SG rules must allow client-to-ALB and ALB-to-target paths. Health checks use configured protocol, port, path, matcher, interval, timeout, and thresholds. If all targets are unhealthy, ALB behavior may fail open and route to unhealthy targets; health state is not a universal traffic kill switch.

## Execution lifecycle

Register target → health probes start → target transitions initial → healthy after successful threshold → receives traffic → fails probes → draining/unhealthy transition → replacement or recovery → re-enters healthy pool.

## Worked example 1

Desired count 6, health interval 10 s, unhealthy threshold 3. Detection time is not exactly 30 s: probe scheduling and timeout influence it. If app starts in 45 s but health grace is 20 s, replacement churn can occur. Measure startup distribution and make `/ready` return success only after required local initialization.

## Worked example 2

An API process responds 200 on `/health` while PostgreSQL is down. ALB keeps routing requests, producing customer 500s. A deep readiness check can remove every target during a database incident, which may worsen recovery. Decide whether readiness should reflect local ability to serve or critical dependency health; bound dependency timeout and avoid synchronized check storms.

## Configuration lab

```bash
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:region:account:targetgroup/api/abc
aws elbv2 describe-rules --listener-arn arn:aws:elasticloadbalancing:region:account:listener/app/api/abc/def
```

Read each target’s reason code. Confirm the health-check port and target port, expected status codes, path, and SG source. Use TLS at listener with managed certificates where appropriate.

## Alternatives and decision boundary

ALB fits HTTP routing and host/path rules. NLB fits TCP/UDP/TLS and high-throughput/low-level connection use cases. API Gateway adds API management features. A service mesh or Cloud Map addresses service-to-service discovery, not public ingress replacement in every design.

## Tradeoffs

More health semantics can detect dependency failure sooner but can remove all capacity for a shared downstream fault. Short intervals speed detection and increase probe traffic. Sticky sessions simplify some stateful apps but reduce balancing flexibility and do not replace durable session storage.

## Failure analysis

Read target reason codes; test SG path from ALB; check host/path/matcher; inspect app bind address and TLS expectation; compare target type/port. Track 4xx, 5xx, target response time, healthy host count, and app logs.

## Debugging procedure

Reproduce from inside VPC with same protocol/port. `curl` health path on target, then inspect ALB target health. Compare one healthy and one unhealthy target config. Validate with a canary rule before changing all traffic. Preserve deployment timing in incident timeline.

## Production checklist
- Health endpoint does not expose internal data.
- Startup grace and deregistration delay match graceful shutdown.
- Healthy-host count alarm and target reason runbook exist.
- No security group permits broad traffic to app port unnecessarily.

## Practical exercise

Target group is unhealthy after adding TLS on port 8443. Create a sequence to inspect protocol mismatch, SG path, certificate termination point, app listener, and matcher.

## Exercise checks
- Listener port and target port can differ.
- Health check is an HTTP request with its own protocol/path/port.
- `running` state does not guarantee target health.

## Quick reference
- Listener accepts; rule routes; target group defines backend behavior.
- Health checks decide eligibility, not total app correctness.

## Deepened mechanism: Health, registration, slow start, and overload behavior

### Worked example 3 — target registration is not readiness

An ASG launches a VM and registers it with a target group. The app needs 90 seconds to load a 2 GB ruleset. If the ALB health check starts after 10 seconds and expects `/ready` to return 200, the target remains unhealthy until initialization completes. Set health-check grace/warmup to reflect measured startup, but do not make the endpoint return healthy before the service can safely serve. Use a startup probe distinct from a liveness check: readiness controls traffic eligibility; liveness can trigger restart for a stuck process. ALB health checks do not repair the application by themselves.

ALB listener rules choose a target group based on protocol, host/path and rule priority. The target group registers instance or IP targets and checks health. The ALB normally routes to healthy targets; if all targets are unhealthy, the load balancer can fail open and route to all targets. Therefore, “all unhealthy” is not a safe traffic-blocking mechanism. For overload, shed at the application or gateway layer and return controlled errors. Verify cross-zone settings and AZ target distribution for the chosen configuration.

### Worked example 4 — draining a deployment

A target handles requests that may take 45 seconds. The ASG begins termination and ALB deregistration delay is only 20 seconds. Long requests can be interrupted. Set deregistration delay and application shutdown behavior to cover measured in-flight work, but keep the delay bounded so capacity is not held forever. On termination, stop accepting new work, finish or safely cancel in-flight requests, flush telemetry, then exit. Test with a long request during scale-in.

### Incident diagnosis

For intermittent 503, inspect ALB access logs, target health reason codes, healthy host count by AZ, listener rule match, target port, security groups and application logs. For 502, inspect connection reset, process crash and response protocol. For 504, inspect target response time and downstream waits. Compare target response time with application span timing. If health oscillates, check probe path semantics, startup duration and overloaded dependencies rather than simply increasing thresholds.

### Roman Hinglish explanation

ALB request ko listener rule se target group tak route karta hai. Target register hone ke baad health check decide karta hai traffic bhejna hai ya nahi. App ka `/ready` tabhi success de jab woh sach mein request serve kar sake. Starting check aur liveness check alag rakho. Target deregister hote waqt purani request ko time do; warna scale-in par 45-second request beech mein toot sakti hai. Saare target unhealthy hon to ALB fail-open behavior ho sakta hai, isliye health check ko circuit breaker mat samjho. 502/503/504 ko alag evidence ke saath diagnose karo.

### Direct AWS references for these mechanisms

- [ALB target health checks](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html) — health states and fail-open behavior.
- [ALB target groups](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html) — registration, routing, slow start, and deregistration attributes.
