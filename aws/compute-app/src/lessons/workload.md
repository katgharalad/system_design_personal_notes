## Learning objectives

Is chapter ke baad tum workload ko service name ke bina describe kar sakte ho; concurrency aur downstream capacity estimate kar sakte ho; burst, latency, failure, security, aur cost assumptions alag rakh sakte ho; aur measurement se initial choice defend kar sakte ho.

## Problem: service name se pehle workload

Team kehti hai: “API ke liye Lambda use kar lete hain.” Lekin API ka kya kaam hai? 50-ms cache read, 10-minute image transform, aur persistent WebSocket worker teen alag problems hain. “Serverless” ya “containers” se design start karoge toh latency, state, failure recovery, aur database pressure chhoot sakte hain. [AWS compute decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html) workload type, performance, scalability, management overhead, cost, security, integration, aur reliability ko explicit decision dimensions maanta hai.

**Workload** sirf code nahi: request source, traffic shape, per-request resource demand, data dependencies, recovery target, users, deployment process, aur team ki operations capacity bhi hai. **Compute** CPU aur memory par work execute karta hai. **Storage** data ko execution ke baad preserve karta hai. **Network** clients aur dependencies ko jodta hai. Ek compute product choose karne se storage throughput, DB connections, API quotas, ya user latency automatically solve nahi hoti.

Requirements ko do columns mein likho. *Measured*: observed RPS, latency distribution, CPU time, memory peak, query count, error rate. *Required*: p95 target, acceptable backlog, RTO, RPO, data rules, budget. Unknown ko number bana kar invent mat karo. Hypothesis likho aur test ka naam do. Average aur peak alag record karo. “100 RPS” ambiguous hai: sustained 100, one-second burst 1000, ya daily average 100? Ye difference capacity model change karta hai.

## Internal model: arrival, work, wait

Ek request system mein arrive hoti hai, admission layer se guzarti hai, execution slot leti hai, dependency ko call karti hai, phir complete hoti hai. Kuch work CPU-bound hai: core continuously busy. Kuch I/O-bound hai: worker DB/network response ka wait karta hai. Memory-bound work mein concurrency badhane se out-of-memory aa sakta hai. In teenon ko “slow function” mat bolo; measure karo.

Stable interval mein approximate concurrency = **arrival rate × average time in system**. Agar 200 requests/second aur 0.4 second average execution hai, estimate 80 in-flight. 2,000 RPS par 800. Ye Little's Law ka planning use hai: same interval, stable throughput, meaningful average. Bursts, p99 duration, retries, queues, aur upstream throttling ke saath exact peak different ho sakta hai. Time in *system* aur service execution time alag ho sakte hain. Queue mein wait count karoge toh active worker count ke liye formula misuse hoga. Isliye separately record karo: arrivals, accepted requests, active executions, queue age, completed throughput.

Lambda ke liye AWS concurrent executions ko simultaneous requests ke roop mein define karta hai; approximate demand arrival rate × function duration. Actual scale behavior, quotas, event-source admission, aur reserved concurrency ko [Lambda concurrency documentation](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html) se check karo. Lambda function ka concurrency 800 ho sakta hai, lekin database ka safe active query count 80. Dono numbers interchangeable nahi.

## Worked example 1: bursty screening API

Assume property-screening API sustained 200 RPS, p95 response target 800 ms, average handler time 400 ms. Burst 2,000 RPS for 90 seconds. Har handler one PostgreSQL connection open karke one transaction karta hai. Database configured connection ceiling 150, aur load test says 100 concurrent active queries ke baad p95 rapidly badhta hai. Baseline active handler estimate 80; burst estimate 800. Agar 800 handler har ek DB connection le, connection ceiling pehle hit hogi. **Faster compute scaling database capacity increase nahi karti.**

```text
Client → API admission → Lambda/Event Function → RDS Proxy → PostgreSQL
                         ↘ CloudWatch metrics/logs      ↗ DB metrics
```

Pehla step function logs mein connection errors, duration, timeout, aur invocation errors ko time series par plot karna hai. Lambda `ConcurrentExecutions` aur `Throttles` alag dekho. DB-side connection count, CPU, transaction latency, lock waits, query plan, aur connection rejection compare karo. Lambda throttling ho toh invocation admission fail hua. DB “too many connections” ho toh function start hui, downstream connect fail hua. Ek incident mein dono bhi ho sakte hain.

[RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.howitworks.html) client connections accept karke database connections pool karta hai. Transaction complete hone par compatible back-end connection next client ke liye reuse ho sakta hai: **multiplexing**. Long transaction, session-specific state, ya unsupported behavior **pinning** cause kar sakta hai; pinned connection reuse nahi hota. [Pinning guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-pinning.html) check karo. Proxy handshake/connection pressure help kar sakta hai; 800 expensive simultaneous queries ko 100 safe active queries mein magically convert nahi karta. Jab queue at proxy badhegi, client latency aur timeout badh sakte hain. SQL optimize karo, short transactions rakho, nonurgent work queue karo, aur bounded concurrency test karo. Cap set karne se overload avoid hota hai, lekin excess synchronous users ko throttle/latency milegi; admission response aur client retry policy design karo.

**Validation:** 90-second burst replay karo. Before/after p95, successful throughput, Lambda throttles, DB connections, proxy client connections, pinned connections, wait time, query latency, aur errors compare karo. Only “no connection error” success nahi; acceptable end-user latency bhi chahiye.

## Worked example 2: image transforms

Assume upload stream 30 jobs/second sustained, 300 jobs/second for 2 minutes; each transform average 3 seconds CPU time, memory 1.5 GiB. Burst concurrency estimate 900, but users results within 10 minutes accept karte hain. Synchronous 900 workers reserve karna zaroori nahi. Queue arrival absorb kar sakti hai; bounded consumers steady throughput se backlog drain karenge. Assume consumers 150 jobs/second complete karte hain throughout burst. Agar each job truly 3 full CPU-seconds leti hai, 150/s completion ke liye ~450 vCPU continuously chahiye, before overhead; ye fleet measurement ya budget se prove karna hoga. **Actual backlog growth** = (300−150)×120 = 18,000 jobs; 32,400 sirf normal 30 jobs/second se *extra arrivals* hain, backlog nahi. Burst khatam hone par 30 jobs/second arrival continue rahe, net drain 150−30=120 jobs/second; backlog clear hone mein 18,000/120 = 150 seconds. Ye estimate tabhi valid hai jab 150 completion rate measured aur storage/DB downstream support karein. Queue age SLO 10 minutes hai toh ye plan plausible; failures/retries aur p95 duration ke liye headroom add karo.

Lambda, ECS/Fargate, AWS Batch, ya EC2 selection execution duration, packaging, CPU/memory shape, queue integration, and economics se decide hoga. Standard Lambda Event Function timeout [900 seconds](https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html) tak configure hota hai; Lambda Managed Instances ke kuch asynchronous/event-source invocations [90 minutes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances-best-practices.html) tak, aur durable function workflows asynchronous state ke saath [one year](https://docs.aws.amazon.com/lambda/latest/dg/durable-invoking.html) tak span kar sakte hain. In models ko ek hi 15-minute rule mein mat milao. Long-running CPU process aur durable *workflow lifetime* same cheez nahi.

## Practical lab: free local capacity worksheet

Ye lab AWS resource create nahi karti. Terminal mein script run karo. Inputs deliberately measured ya stated assumptions hone chahiye.

```python
from math import ceil

def plan(rps, duration_s, safe_concurrency_per_worker, azs=2):
    if min(rps, duration_s, safe_concurrency_per_worker) <= 0 or azs < 1:
        raise ValueError('positive workload values required')
    active = rps * duration_s
    workers = ceil(active / safe_concurrency_per_worker)
    # N-1 AZ plan: each surviving AZ must host full baseline after one AZ fails.
    surviving_azs = max(1, azs - 1)
    per_survivor = ceil(workers / surviving_azs)
    return active, workers, per_survivor

print(plan(1200, 0.25, 30, 2))  # (300.0, 10, 10)
```

`safe_concurrency_per_worker` load test se aana chahiye. Last number *capacity target* hai, automatic placement guarantee nahi. Two AZ design mein one AZ failure ke baad 10 workers ek AZ mein launch/run ho sakne chahiye; quota, instance supply, subnet IPs, launch time, aur DB capacity verify karo. Three AZ design mein surviving two AZs each 5 worker capacity se baseline cover kar sakte hain, assuming routing and data path survive.

## Failure analysis: retry amplification

Incident: 14:00 deployment ke baad DB latency 40 ms se 600 ms. API client 2-second timeout par up to 3 retries karta hai. 14:03 p95 4 seconds, 5xx 12%, Lambda concurrency 4×, DB CPU 95%, Lambda throttles zero. Compute demand primary cause nahi ho sakti; slow DB request duration badha rahi hai, duration concurrency badha raha hai, retries extra arrivals create kar rahe hain. Timeline mein deployment diff aur top slow queries inspect karo. Query plan/index regression aur lock waits check karo. Retry traffic fraction application logs mein request IDs se estimate karo.

Mitigate: bad deployment rollback; nonurgent work pause; retry budget cap; jittered backoff; DB-safe concurrency bound; user-facing overload response. Root cause fix ke baad production-like load par repeat. DB restart sirf symptom temporarily hide karega; evidence preserve karo. Operations principle: before scaling out, **bottleneck aur feedback loop** identify karo.

## Alternatives and interview reasoning

Synchronous Lambda useful jab short event work, variable demand, managed execution fit ho. ECS/Fargate useful jab packaged long-lived HTTP worker ya containerized job operational model fit kare. EC2 useful jab OS/host control, specialized instance, or stable high utilization justify kare. Queue useful jab user response delay accept kare. AWS Batch finite batch workloads ke liye evaluate karo. In options ko “best” rank dene se pehle assumptions bolo. Continuous utilization, instance family, Region, data transfer, and support cost ke saath cost estimate banao; generic price memory se quote mat karo.

Interview mein sequence rakho: requirement → measured demand → concurrency/capacity math → dependencies → candidate choice → failure path → verification → decision trigger. Agar interviewer traffic 10× kare, math recompute karo. Agar p95 target strict kare, queue may not fit. Agar DB single writer hai, compute scale alone fail karega. Agar stateful connections required hain, execution model reconsider karo.

## Capacity review before choosing a service

Ek production review mein “2000 RPS par 800 concurrency” likhna first line hai, final capacity plan nahi. Request journey ko components mein split karo: API gateway/ALB admission, handler CPU, DB transaction, external API, result write. Agar 400 ms handler mein DB transaction sirf 40 ms hai, 800 simultaneous handlers ka matlab necessarily 800 *active queries* nahi; lekin agar har handler connection open karke wait ke poore 400 ms hold karta hai, connection pressure real ho sakta hai. Instrument transaction start/end timestamps aur client pool acquisition wait. DB connection `max` ko useful throughput target mat samjho: CPU, locks, storage I/O, aur query plans pehle saturate kar sakte hain. Measured “100 safe active queries” example-specific value hai, AWS quota nahi.

Admission budget ko three paths mein divide kar sakte ho: critical synchronous requests, nonurgent asynchronous jobs, aur overload rejection. Critical path ke liye explicit timeout chain banao: client timeout > API timeout > function/dependency timeouts sensible order mein, taaki a client timed out but backend still doing expensive work situation samajh aaye. Retries ko unlimited mat rakho; each retry new work create karta hai. Queue path mein durable message, visibility/retry policy, dead-letter handling, and idempotency key define karo. Overload path mein predictable response and `Retry-After`-style client guidance evaluate karo instead of random connection errors. Ye choices user experience ko affect karti hain, so product owner ke latency and completion targets chahiye.

Cost worksheet bhi same honesty maangta hai. Per-request compute duration/memory, idle capacity, deployment headroom, log volume, data transfer, NAT, queue, DB, and operations effort count karo. Lambda vs Fargate vs EC2 price sirf one line item se compare mat karo. Synthetic load test ka billed cost bhi budget mein rakho. Financial estimate Region, purchase model, utilization, and real usage distribution ke saath update hoga; is chapter ka numerical model price quote nahi. [Well-Architected cost and performance questions](https://docs.aws.amazon.com/wellarchitected/latest/framework/appendix.html) architecture review ko measured outcomes se connect karte hain.

## Exercises with checks

1. 600 RPS, average 350 ms, measured safe 21 concurrent requests per replica. Active estimate aur baseline replica count nikalo. **Check:** 210 in-flight; 10 replicas before failure and deploy headroom.
2. 500 jobs/second for 1 minute, 50 jobs/second normal, 200 completions/second fixed. Burst backlog aur drain time calculate karo. **Check:** (500−200)×60 = 18,000 queued jobs; after burst net drain 200−50=150/second; 18,000/150 = 120 seconds. Extra arrivals above normal (27,000) backlog se different hain. Explain why variable duration changes result.
3. Screening API mein Lambda `Throttles=0`, DB connection errors spike, query latency steady. First three hypotheses? **Check:** per-invocation new connection, missing/ineffective pooling, connection leak/pinning. Verify with proxy and DB metrics before fix.

## Video companion

[AWS re:Invent 2023: Capacity, availability, cost efficiency — Pick three](https://www.youtube.com/watch?v=E0dYLPXrX_w) ke English auto-captions verified hain. Talk capacity, availability, aur cost ko ek saath decision dimensions ke roop mein discuss karti hai; workload SLO ke bina purchase/capacity strategy choose mat karo. Video historical case studies ke liye useful hai. Current service limits aur prices ke liye linked AWS documentation use karo. Auto-captions imperfect ho sakte hain.

## Quick reference

- Workload facts: arrivals, burst duration, execution distribution, CPU/memory, state, latency SLO, downstream capacity, security, RTO/RPO, team, budget.
- Active work ≈ arrival rate × service time; use matching interval and explicit assumptions.
- Queue backlog = arrivals − completions over time; queue age matters more than queue length alone.
- Lambda concurrency, DB connections, active DB queries, and queue depth are different metrics.
- RDS Proxy pools and multiplexes compatible DB connections; pinning and expensive SQL limit benefit.
- Standard Event Function invocation limit differs from Managed Instances and durable workflow lifetime.
- Measure successful throughput and user latency after any capacity change.

**Evidence:** [compute guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html), [Lambda concurrency](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html), [Lambda timeout](https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html), [RDS Proxy mechanism](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.howitworks.html), [RDS Proxy pinning](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-pinning.html), [Well-Architected review questions](https://docs.aws.amazon.com/wellarchitected/latest/framework/appendix.html).
