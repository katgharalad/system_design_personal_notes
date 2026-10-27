# Lambda concurrency, quotas, and scaling

**Prerequisite:** Lambda execution lifecycle and invocation models. **Sources:** [Lambda concurrency](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html), [scaling behavior](https://docs.aws.amazon.com/lambda/latest/dg/scaling-behavior.html), [concurrency metrics](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-concurrency.html).

## Learning objectives
- Calculate average concurrency from request rate and duration, then add peak and tail-latency caveats.
- Separate account concurrency, function reservation, provisioned environments, scaling rate, and request-rate quotas.
- Set a concurrency limit from downstream capacity and explain its user-visible effect.
- Diagnose throttles from metrics and events instead of increasing quotas blindly.

## First principles: arrivals occupy execution time

Concurrency is the number of invocations in flight at one time. It is a count of occupied execution slots, not requests per second and not the number of environments ever created. For a stable workload, Little’s Law gives a planning estimate:

```text
average concurrent invocations ≈ average arrival rate × average time in system
```

Units cancel: `(requests / second) × (seconds / request) = requests in flight`. At 400 requests/s and 0.15 s function duration, estimate `60` concurrent invocations. If average duration doubles to 0.30 s while arrival rate stays the same, demand doubles to `120`. A downstream slowdown can therefore increase concurrency even when incoming request rate is flat.

This is an average estimate. Bursts, p95/p99 duration, retries, asynchronous backlog, batch sizes, and requests that enter but do not complete all affect peak demand. Model each invocation source separately. A polling mapping’s batch size and concurrent batches do not have the same request semantics as a synchronous HTTP API.

## Four separate Lambda limits

### Account concurrency quota

The Region has an account-level concurrency quota shared by functions. AWS documentation currently describes 1,000 as a common default, but the actual account quota is authoritative. Some amount is held out of reserved allocations for unreserved functions. Read `get-account-settings` and Service Quotas in the target account. A quota increase is not a design substitute for protecting a database or third-party API.

### Function scaling rate

Lambda also limits how quickly on-demand execution environments can be added. AWS’s current Event Function scaling page states a per-function scaling rate of up to 1,000 additional environments per 10 seconds in a Region (equivalent to 10,000 additional RPS under the documentation’s quota framing). This is not the total concurrency quota. An account can have headroom and still see a sudden burst throttle while a function is scaling. The published values can change; record the retrieval date and recheck before a capacity commitment.

### Requests-per-second quota

Concurrency and RPS can bind independently. Current AWS documentation describes an RPS ceiling equal to 10 times the applicable concurrency quota. A very short function can process many requests per second while using little concurrency. For example, at 20,000 RPS and 50 ms duration, estimated concurrency is `20,000 × 0.05 = 1,000`. If the effective RPS quota is only 10,000, the system can throttle despite the concurrency calculation matching a 1,000 quota.

### Downstream capacity

The function may have quota for 5,000 concurrent invokes while the database supports 300 useful connections, or a payment API accepts only 100 requests/s. The limiting capacity is the smallest safe budget across the request path. Estimate `function concurrency × connections per invocation`, then add other clients, pool idle connections, admin work, and failover headroom. Scale Lambda only after the dependency budget has an admission policy.

## Reserved versus provisioned concurrency

Reserved concurrency sets a function’s allocation boundary: it reserves that capacity from the shared unreserved pool and sets the function’s maximum. It can isolate a critical function from noisy neighbors and cap downstream demand. It does not pre-initialize execution environments and therefore does not remove cold starts. It has no separate reservation charge, but capacity held unused is unavailable to other unreserved functions.

Provisioned concurrency prepares a chosen number of environments for a published version or alias before requests arrive. It reduces initialization latency while capacity is available; additional demand can spill to standard on-demand concurrency or be throttled depending on reserved settings and available quotas. Provisioned concurrency has a charge and takes time to allocate. It does not imply unlimited scale or eliminate handler and downstream latency.

Example: account quota 1,000; reserve 500 for a latency-sensitive API; reserve 250 for a worker; the remaining pool is 250 for unreserved functions. If the API sets provisioned concurrency to 120 and reserved concurrency to 500, the first 120 active slots can be pre-initialized. Requests above 120 may use its remaining reserved concurrency and cold-start; requests above 500 throttle. These allocations affect other functions even if the reserved capacity is idle.

## Worked example 1: safe starting cap from DB budget

API traffic: 900 RPS average, 1,800 RPS peak, p95 function duration 220 ms. Average-based estimate at peak is `1,800 × 0.22 = 396`. For rough planning, use measured peak duration, not just the mean. Suppose a load test shows p95 duration rises to 350 ms under dependency pressure: `1,800 × 0.35 = 630` concurrent requests. If each active invocation can hold one DB connection, and the database has 420 useful connections of which 100 are reserved for other services, the Lambda path budget is at most 320 before safety margin. A starting reserved cap of 250 might protect the DB, but will throttle or defer some synchronous demand. Validate expected throttled RPS and user-visible impact; the cap is a safety control, not free capacity.

## Worked example 2: burst growth rate

Suppose a function sits at 100 concurrent invocations, then traffic jumps toward 2,600. The required increase is 2,500 environments. Under the documented current rate of at most 1,000 new environments per 10 seconds per function, the theoretical ramp requires at least 25 seconds, even before code initialization, dependency warm-up, or traffic variance. This estimate is not a latency promise. A burst that completes in 5 seconds cannot wait for that ramp. Options include provisioned concurrency scheduled before a known event, a durable queue that spreads work over time, pre-warmed service capacity elsewhere, or an explicit overload response.

## Worked example 3: RPS binds before concurrency

Function duration is 30 ms and peak arrival is 18,000 RPS. Average concurrency is `18,000 × 0.03 = 540`. If its effective concurrency quota is 1,000, the concurrency number appears safe. But the documented RPS quota tied to 1,000 concurrency is 10,000 RPS. The design still needs quota review or a different request path. Also test TLS/API Gateway limits, database demand, and payload processing. Never tell an interviewer “540 concurrency proves 18k RPS is allowed.”

## Configuration and operational commands

Read quota and live configuration first:

```bash
aws lambda get-account-settings
aws lambda get-function-concurrency --function-name reservation-api
aws lambda get-provisioned-concurrency-config \
  --function-name reservation-api --qualifier prod
```

Set a cap only after calculating a safe value and identifying the caller response:

```bash
aws lambda put-function-concurrency \
  --function-name reservation-api \
  --reserved-concurrent-executions 250
```

These commands change account configuration. Do not execute against a production account during the exercise. Use a version or alias when configuring provisioned concurrency; `$LATEST` is not a published immutable version. Confirm the alias points at the intended version and watch allocation status before traffic shifting.

## Production failure: concurrency looks low, but requests throttle

Timeline: incoming rate jumps from 2,000 to 17,000 RPS; average duration 25 ms; `ConcurrentExecutions` peaks near 425; API returns 429. Candidate incorrectly raises reserved concurrency from 500 to 2,000. First inspect effective account concurrency, RPS quota, function reserved cap, `Throttles`, `ConcurrentExecutions`, `ClaimedAccountConcurrency`, and upstream API integration limits. Math gives `17,000 × 0.025 = 425`, so concurrency alone does not explain the throttle. The RPS quota may bind. Verify the account quota and the exact invocation path; request quota adjustment if justified, or buffer traffic if the caller can tolerate delay. Increasing reserved concurrency can consume shared capacity without solving the RPS ceiling.

Second incident: `ConcurrentExecutions` is flat at 200, DB connections hit 400, and errors climb. Inspect pool behavior: each environment may retain an idle client connection; active invokes may open multiple connections; other applications share the DB. Reduce connection creation, bound function concurrency, add suitable pooling/proxy, and lower worker concurrency. Connection pooling does not make slow queries faster or remove transaction pinning. Add alarms on DB connection saturation and function throttle/error rate.

## Architecture tradeoffs

Concurrency caps provide backpressure but can turn excess demand into synchronous 429s. A queue can accept and defer work, but changes the latency contract and introduces duplicate, ordering, and poison-message concerns. Provisioned concurrency buys ready environments and predictable initialization latency at a cost; it does not eliminate slow databases. Reserved concurrency protects a function’s share and bounds its scale but can strand unused capacity. Account quota increases permit more work but do not protect shared dependencies. Autoscaling concurrency is not an architecture until admission, failure behavior, and downstream capacity are specified.

## Practical exercise

An image API receives 2,400 RPS for a 90-second burst. Warm duration is 180 ms; cold path is 700 ms; DB has 260 useful connections, 60 used by other services, and each active invocation can use one. Propose a cap, estimate in-flight work in warm and cold conditions, state excess-request behavior, and compare a queue with provisioned concurrency. Then change the DB useful budget from 260 to 140 and revise the answer.

## Exercise checks
- Warm estimate: `2,400 × 0.18 = 432`; cold-path estimate at the same arrival rate: `2,400 × 0.7 = 1,680`.
- Lambda connection budget cannot exceed `260 - 60 = 200`, before safety margin and other concurrent DB use.
- A cap near 200 can protect the stated DB budget but cannot serve all 432 average in-flight requests; answer specifies throttle or queue contract.
- Provisioned concurrency reduces initialization for its ready slots but does not reduce handler duration or DB connections per active request.
- Queue choice names acceptable delay, visibility/retry, idempotency, and oldest-message alarm.

## Quick reference
- Average concurrency ≈ RPS × average duration; plan peak with measured tails.
- Check concurrency quota, scaling rate, RPS quota, and downstream capacity separately.
- Reserved concurrency isolates and caps; it does not pre-warm.
- Provisioned concurrency pre-warms at a cost; it is finite and allocates asynchronously.
- Verify current account quotas in the account; documentation defaults are not your quota.

## Roman Hinglish explanation

Concurrency ka seedha estimate hai: ek second mein kitne kaam aaye × har kaam kitni der occupied raha. 240 request/sec aur 300 ms ka matlab roughly 72 requests ek waqt mein active ho sakti hain. Par ye average math hai. Burst, slow tail, retries, aur database wait number ko badha sakte hain. Account quota, function ka reserved cap, environment banne ki scaling speed, aur RPS limit alag constraints hain. Ek limit badhaane se doosri limit nahi badalti. Reserved concurrency function ko capacity share deta hai aur usi waqt ceiling bhi lagata hai. Provisioned concurrency pehle environments ready rakhta hai, par uski cost hai aur configured pool ke upar traffic ko guarantee nahi deta. Pehle dependency ka safe budget nikalo, phir Lambda cap ko load test mein stepwise badhao.
