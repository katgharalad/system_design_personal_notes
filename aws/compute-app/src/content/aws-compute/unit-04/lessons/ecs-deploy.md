# Container health, scaling, and safe deployments

**Prerequisite:** ECS networking. **Sources:** [ECS services](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_services.html), [deployment circuit breaker](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html), [ECS scaling](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/capacity-autoscaling-best-practice.html).

## Learning objectives
- Distinguish container, target, and service health.
- Explain rolling deployment percentages, circuit-breaker rollback, and graceful stop.
- Scale from request or backlog signals while respecting DB capacity.

## Problem

Deployments fail when new tasks never become healthy, old tasks stop too early, or autoscaling sees a delayed signal. Repeatedly restarting bad tasks can create churn without rollback.

## Definition and terminology

Container health check tests a process-level command. ALB health check probes a routed endpoint. Service scheduler maintains desired count and deployment state. Deployment circuit breaker can mark an ECS rolling deployment failed and optionally roll back to the last completed deployment. Application Auto Scaling changes desired count based on a policy. None of these proves business correctness without representative tests.

## Internal operation

Rolling deployments honor minimum healthy and maximum percent limits, subject to available EC2/Fargate capacity and placement. New tasks start, pass health, then old tasks are stopped and drained. Circuit breaker evaluates tasks reaching RUNNING and health signals; configuration controls failure threshold/reset behavior. Health endpoint should not return success before app is ready, but overly deep shared-dependency checks can mark all replicas down together.

## Execution lifecycle

Publish version → register task revision → start rollout → place new tasks → process starts and passes health → shift traffic → old tasks drain on SIGTERM → deployment reaches steady state or fails/rolls back.

## Worked example 1

Desired count 4, minimum healthy 100%, maximum 150%. A rollout may need up to 6 task slots while maintaining 4 healthy tasks. If EC2 cluster only fits 4 and cannot scale fast enough, deployment stalls. Lower minimum can free placement but temporarily reduce capacity; evaluate against load and SLO.

## Worked example 2

New release starts but ALB health fails due migration not yet applied. Circuit breaker rollback can restore old code only if old code remains schema-compatible. Use expand/contract database migrations: add compatible schema, deploy readers/writers, backfill, then remove old field later.

## Configuration lab

```json
{"deploymentConfiguration":{"minimumHealthyPercent":100,"maximumPercent":200,"deploymentCircuitBreaker":{"enable":true,"rollback":true}}}
```

This uses rolling deployment settings; test with actual desired count and capacity. Monitor ECS deployment events, healthy hosts, p95, 5xx, and DB connections during canary.

## Alternatives and decision boundary

Rolling update is simple and resource-efficient. Blue/green can separate traffic shift and rollback, but costs more temporary capacity and requires compatible data changes. Canary can reduce blast radius when metrics are actionable.

## Tradeoffs

Fast rollout reduces release time but raises blast radius. Conservative rollout needs spare capacity. Circuit breaker detects failure conditions but does not fix a broken external dependency or incompatible schema.

## Failure analysis

Check deployment events, stopped reasons, health-check reason, logs, resource pressure, capacity, image digest, secret retrieval, and DB schema. If tasks are healthy but latency regresses, inspect saturation and traces rather than health check alone.

## Debugging procedure

Pause or rollback per policy. Compare old/new task revision and runtime config. Identify first failing lifecycle stage; correlate with service event and app log. Verify previous version still works with current schema and data. Test corrective build in staging before resume.

## Production checklist
- Graceful shutdown time aligns with ALB deregistration and job visibility timeout.
- Deployment has surge capacity and rollback decision thresholds.
- Database changes remain compatible across overlap period.
- Scale policies include downstream capacity guardrails.

## Practical exercise

Deploy a bad health path at desired count 3. Observe circuit breaker, rollback, and old deployment steady state. Repeat with a DB-breaking schema migration and design a safe expand/contract sequence.

## Exercise checks
- Deployment and runtime health are observed at separate layers.
- Rollback is supported by schema compatibility.
- Scale-out does not exceed DB connection budget.

## Quick reference
- Desired count is not healthy count.
- Rollout requires spare capacity, good health signals, and compatible data.

## Safe rollout mechanics

Image tag move ho sakta hai; digest exact content pehchanta hai. Release record mein source revision, build, digest, aur task-definition revision jodo. ECS rolling deployment ke minimum healthy aur maximum percentages task count bound karte hain; spare EC2, subnet IP, ya quota guarantee nahi. Circuit breaker startup aur health failures par deployment fail karke last completed revision par rollback kar sakta hai. Schema changes ke dauran old aur new task ek saath chal sakte hain. Expand-and-contract use karo: compatible schema add, dual-read deploy, write format badlo, backfill, phir old format baad mein hatao.

Blue/green traffic shift controlled bake window deta hai, lekin committed writes, sent messages, ya external notifications undo nahi karta. Rollback alarms aur old task-set capacity define karo. Health check data compatibility prove nahi karta.

## Worked case

A integer prices likhta hai; B decimal strings. Rollout mein dono versions chal rahe hain. B ka data A parse nahi karta, toh kuch requests fail hongi although both target groups healthy. Pehle dual-read code deploy karo, phir writes switch karo. Old support tab hatao jab old tasks aur queued messages drain ho jaayen.

## Hinglish explanation

Safe deploy mein old aur new code overlap karte hain, isliye data contract compatible rakho. Digest exact bytes batata hai, tag sirf naam. Capacity percentages host ya IP capacity nahi banate. Circuit breaker process failure pakadta hai; schema aur side effects ke liye alag plan chahiye.

## Deployment mechanics and safe rollout

An image tag is a name that can be reassigned unless repository policy prevents it. A digest identifies exact image content. Record source revision → build → image digest → task-definition revision. This lets responders identify running bytes and recreate a prior release. Use immutable release tags or deploy by digest; retain rollback digests. A lifecycle policy can delete images that a rollback still needs. See [ECR image tag mutability](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-tag-mutability.html) and [lifecycle policies](https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html).

For an ECS rolling deployment, minimum healthy and maximum percentage bound temporary task counts. They do not guarantee spare EC2 capacity, subnet addresses, or a successful image pull. A deployment circuit breaker can observe startup and health failures, mark a deployment failed, and optionally roll back to the last completed revision. Rollback needs capacity and compatible data. If schema changes while old and new tasks overlap, use expand-and-contract: add a compatible schema, deploy code that reads both forms, switch writes, backfill, then remove the old form in a later release.

Blue/green deployment shifts traffic between task sets through a load balancer. It enables a controlled bake period, but cannot undo side effects: messages already processed, writes committed, or notifications sent. Define alarms that trigger rollback and verify that the old task set still serves. Canary traffic is useful only if the sample represents production behavior and rollback arrives before broad impact.

## Worked example: healthy tasks still corrupt requests

Version A serializes `price` as an integer. Version B uses decimal strings. During a rolling deployment both versions run. If B writes data A cannot parse, some requests fail although both target groups are healthy. Deploy compatibility first: read both formats while writing the old one; then switch writes; remove old-format support only after old tasks and queued messages drain. Health is a process/traffic signal, not proof of data compatibility.

## Operational checklist

Before release, compare startup time, target health, CPU/memory, database connections, downstream limits, and headroom. Keep the previous digest, task definition, and configuration. During rollout, watch deployment state, stopped reasons, target health, error rate, latency, saturation, and queue age. A forced deployment restarts the same inputs; it does not fix a bad image or permission.

## Hinglish explanation

Safe deployment sirf “naya task healthy” nahi. Old aur new code saath chal sakte hain, isliye schema aur message format compatible rakho. Tag move ho sakta hai; digest exact image batata hai. Rolling limits capacity batate hain, spare EC2 ya subnet IP guarantee nahi. Circuit breaker completed revision par rollback karega; pehle se schema aur side effects ka plan banao.
