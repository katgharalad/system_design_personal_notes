## Learning objectives

Lambda Event Function ki execution ko **Init → Invoke → possible reuse → Shutdown** sequence mein explain karo. Cold aur warm path ka difference batao. Overlapping requests se environment count aur database pressure kaise badhta hai, calculate karo. Reserved concurrency aur provisioned concurrency ke alag purposes defend karo.

## Problem: a fast API with a slow first response

Ek HTTP API Lambda Event Function ko synchronously invoke karti hai. Most requests fast hain, lekin kuch first requests slow hain. Traffic burst ke waqt database connection errors bhi aate hain. “Lambda slow hai” useful diagnosis nahi hai. Pata karo: delay Init mein hai, handler mein hai, ya database mein? Kitne invocations ek time par active hain? Kis limit par request throttle hoti hai?

Is chapter ka animation **standard on-demand Lambda Event Function** dikhata hai. Lambda Managed Instances, Lambda Web Functions, aur Durable Functions ke execution rules different ho sakte hain. Animation ki horizontal distance actual milliseconds represent nahi karti. Request 2 ka reuse ek possible outcome hai, guarantee nahi.

## Internal model: one environment and one active invocation

Standard Event Function ke liye Lambda ek concurrent request ke liye ek separate execution environment use karta hai. First request par Lambda environment prepare karta hai: code load, runtime start, extensions initialize, aur handler ke bahar ka static code run. Ye **Init** hai. Init complete hone ke baad runtime event handler ko deta hai: **Invoke**. Handler result return karta hai. Environment kuch time ke liye retained/frozen ho sakta hai; next request usko reuse kar sakti hai. Reuse par normal static initialization repeat nahi hoti. Lambda kab environment remove karega, is par application depend nahi kar sakti. [AWS execution lifecycle](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html).

Ek environment ek time par ek request process karta hai. Agar A request 2 handle kar raha hai aur request 3 same time par aaye, request 3 A mein concurrently enter nahi karegi. Available capacity aur scaling behavior permit karein to Lambda environment B create karta hai. B ko apna Init chahiye. Concurrency active invocations ka count hai, lifetime mein create hue environments ka total nahi. [AWS Lambda Event Function scaling](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html).

Cold path latency = environment setup and Init + handler time + downstream wait. Warm path Init skip kar sakta hai, lekin handler aur downstream call phir bhi slow ho sakte hain. Duration traces aur logs ko same request timeline par compare karo. Error ya timeout ke baad Lambda environment reset kar sakta hai; next invoke ke saath initialization phir ho sakti hai. Isliye warm reuse ko stable state contract mat banao. [AWS lifecycle failure behavior](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html).

## Worked example 1: one cold, one warm, then overlap

Assume request 1 at t=0, environment A absent. A Init karta hai, phir request 1 Invoke hoti hai. A idle rahta hai. Request 2 later aati hai aur A reuse hota hai: is example mein no second Init. Request 2 still active hai jab request 3 arrives. A busy hai, so B Init + Invoke karta hai. Peak concurrency = 2. Agar B ka Init slow ho, request 3 ki latency request 2 se higher ho sakti hai. **Do not infer exact cold-start duration from video width.**

```text
request 1: A [Init] [Invoke 1] [idle]
request 2: A                   [Invoke 2]
request 3: B                      [Init] [Invoke 3]
peak active invokes: 2
```

## Worked example 2: load and the database limit

Assume 120 requests/second sustained, average handler duration 0.25 second. Planning estimate: concurrency ≈ 120 × 0.25 = **30**. Peak burst or longer tail latency can require more. If each active environment may hold one database connection, 30 environments can put roughly 30 connections in play. Actual connections depend on code, pooling, idle reuse, and other clients. If useful database capacity is 20, more Lambda concurrency does not create 10 extra database slots. Cap/shape work, reduce database demand, or use a suitable proxy/pool, then load test. RDS Proxy can reuse database connections, but transactions and session state can pin them; it cannot make an overloaded database infinitely capable. [AWS RDS Proxy behavior](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.howitworks.html).

```text
arrival: 120 requests/s
average handler duration: 0.25 s
estimated concurrency: 30 active invokes
measured useful DB connections: 20
decision: bound or reshape demand; test before changing the limit
```

## Practical: predict, then change assumptions

Watch the animation above. At each pause, answer before continuing. Then open the **Lambda concurrency lab**. Change arrival rate, handler duration, reserved concurrency, database budget, and connections per active invocation. Compare estimated demand with admitted concurrency and database pressure. The lab is a planning model. It does not reproduce AWS burst scaling, queue behavior, timeout distributions, or exact invocation errors.

Interview answer structure: (1) name invocation type and assumptions; (2) walk Init, Invoke, possible reuse; (3) calculate concurrency; (4) identify a downstream limit; (5) choose a control and describe what it costs; (6) specify metric and load test. Start at L01, then L02, L03, and L04. Each question changes the constraint.

## Failure analysis: three different symptoms

**First request slow:** compare Init duration and handler/downstream timing. Reduce unnecessary static imports or initialization; consider provisioned concurrency when latency target justifies its cost. Provisioned concurrency pre-initializes environments. Reserved concurrency reserves and caps capacity, but does **not** pre-initialize it. [AWS concurrency controls](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html).

**Traffic burst throttled:** inspect ConcurrentExecutions, Throttles, configured reserved concurrency, account quota, and event source. This chapter assumes synchronous direct invocation: caller receives a throttle error if capacity is unavailable. Async events and event-source mappings have retry/queue behavior that needs a separate design. Do not promise instant unlimited scale; Lambda has scaling rate and RPS constraints.

**Database errors rise while Lambda scales:** inspect active connections, query latency, pool metrics, function concurrency, retries, and error time order. Set a safe concurrency bound only after measuring capacity shared with other clients. Limit may protect database but can throttle users. If accepted work can be delayed, queueing changes the contract and needs idempotency and backlog alarms.

## Alternatives and interview reasoning

Provisioned concurrency addresses cold-start latency for pre-initialized capacity. Reserved concurrency controls a function's share and maximum concurrency. RDS Proxy may reduce connection churn for suitable database access, with pinning limits. A queue can smooth asynchronous work but adds delay and duplicate-delivery concerns. Choose against latency, budget, data consistency, and event source; there is no universal setting.

## Exercises

1. Draw A and B for three requests where request 3 overlaps request 2. Which Init steps run?
2. Calculate a planning estimate for 400 RPS × 0.18 s. Then explain why p99 latency can increase peak concurrency.
3. A database supports 25 useful connections and each active invocation can open one. What can a reserved concurrency cap of 20 protect? What user-visible failure could it cause?
4. A handler writes a row, then times out before responding. What retry and idempotency questions will you ask before increasing concurrency?

## Quick reference

- Standard Event Function: one active request per execution environment.
- Cold path includes Init. Warm reuse is possible, never guaranteed.
- Concurrent overlap requires another available environment; new one runs Init.
- Concurrency estimate ≈ arrival rate × average duration; test burst and tail behavior.
- Reserved concurrency limits allocation; provisioned concurrency prepares environments.
- Compute scale must respect database and other downstream limits.

## Sources

- [AWS Lambda execution environment lifecycle](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html)
- [AWS Lambda Event Function scaling and concurrency](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html)
- [AWS RDS Proxy connection behavior](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.howitworks.html)
