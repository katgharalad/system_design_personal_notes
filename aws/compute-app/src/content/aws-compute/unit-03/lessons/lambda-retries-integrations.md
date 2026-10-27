# Lambda retries, event sources, and idempotency

**Prerequisite:** Invocation models, concurrency, and SQS. **Sources:** [Invocation retry behavior](https://docs.aws.amazon.com/lambda/latest/dg/invocation-retries.html), [event source mappings](https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html), [SQS mapping configuration](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-configure.html), [SQS error handling](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html), [at-least-once SQS delivery](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html).

## Learning objectives
- Identify the retry owner for synchronous calls, asynchronous invocation, SQS, and stream mappings.
- Make side effects safe when an event or batch is delivered more than once.
- Configure batch failure behavior, visibility timeout, retry age/attempt limits, and DLQ/replay.
- Diagnose retry amplification, poison records, and stalled stream progress.

## First principles: failure can be ambiguous

A caller sends an event. Lambda performs a database write. The function times out before returning success. Did the write happen? It may have. A retry can therefore repeat an effect even when the first attempt looked like a failure. The same ambiguity appears when a batch partially succeeds but the invoker sees one failed response.

Do not promise exactly-once processing because a queue, event source mapping, or handler retries. Design for repeated delivery and make the business operation idempotent. Use a stable operation key, a database uniqueness constraint, and a durable result. If the effect is external, use the provider’s idempotency key where available or store an outbox/workflow state and reconcile uncertain outcomes.

## Retry ownership by invocation type

### Synchronous Invoke or API request

The caller waits for the response. A direct synchronous Lambda invocation does not automatically retry function errors for the caller. API Gateway commonly returns the integration error to its client; client retry behavior is a separate decision. Retrying a non-idempotent operation after a timeout can duplicate it. The request should carry an idempotency key, and the handler should return the prior result when the key already committed.

### Asynchronous Invoke

The caller gets an acceptance response while Lambda processes the event later. Lambda’s asynchronous invocation queue handles delivery and retry of eligible function errors according to documented defaults/configuration. Configure maximum event age, retry attempts, and on-failure destination or DLQ for the function. The source may also retry if it cannot confirm Lambda accepted the event, so duplicate-safe handling remains required.

### SQS event source mapping

Lambda pollers receive messages, invoke a batch, and acknowledge successful records by deleting them from the queue. If processing fails, messages can become visible again after the queue visibility timeout. Standard queues may deliver a message more than once. FIFO queues add ordering and deduplication properties, but consumers still need idempotency because downstream effects and acknowledgement can fail at different points.

AWS’s current SQS mapping guidance says to set queue visibility timeout to at least six times the function timeout, plus `MaximumBatchingWindowInSeconds` when a batching window is configured. This gives room for processing and mapping retries. Verify the current guidance and account for expected runtime and any extension behavior. A too-short timeout can allow overlapping processing; an excessively long timeout delays retry of a crashed worker.

### Stream event source mapping

Lambda polls records in batches from a stream such as Kinesis or DynamoDB Streams. A failed batch can be retried. Depending on source settings, a poison record can block progress for a shard or partition and delay newer records. Use maximum retry/record age, bisect-on-error where supported, partial batch response, and failure destinations to bound impact. Ordering requirements may prevent simply skipping a bad record.

## Idempotency design

For an SQS event with business key `invoice:2026-10-27:1234`, create a table with a unique key and a durable status/result. One transaction should claim the key and commit the side effect or an outbox command. A retry that finds `SUCCEEDED` returns success. A retry that finds `IN_PROGRESS` needs a lease/timeout and reconciliation policy. Do not mark success before the side effect; do not perform the side effect before recording enough state to deduplicate.

If one transaction cannot include the external effect, use a state machine such as `PENDING → SENT → CONFIRMED`, and reconcile uncertain outcomes. For a payment API, use the same idempotency key on every attempt if the provider supports it. For S3 output, write a deterministic key and version/checksum; publish a completion marker only after the final object is durable. “Check then write” without a unique constraint has a race when two duplicates run concurrently.

## Batch semantics and partial failure

Suppose a batch contains 10 SQS records. The handler processes 9 and one fails. Without partial batch response, the entire batch can become visible again, so the 9 successful records may be processed again. With `ReportBatchItemFailures`, return the failed message identifiers; only those records are retried. This narrows duplicate work but does not remove duplicates for the failing item. The handler must catch and report per-record failures accurately. If it catches every exception and returns an empty failure list, it tells Lambda the batch succeeded and loses work.

For FIFO sources, preserving order may require stopping after the first failed record and reporting that and later unprocessed records as failed. For standard SQS, independent messages can often continue processing in the batch. Confirm source-specific behavior before using parallelism.

```ts
type Record = { messageId: string; body: string };
type Event = { Records: Record[] };

export async function handler(event: Event) {
  const failed: Array<{ itemIdentifier: string }> = [];
  for (const record of event.Records) {
    try {
      await processIdempotently(record.messageId, record.body);
    } catch (error) {
      console.error('processing failed', { messageId: record.messageId, error });
      failed.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failed };
}
```

Configure the mapping with `FunctionResponseTypes: ["ReportBatchItemFailures"]`. The function response shape is part of the protocol; returning `batchItemFailures` without enabling the feature does not turn on partial acknowledgement.

With `ReportBatchItemFailures` enabled, Lambda does not scale down SQS polling when function invocations fail. This can preserve throughput during expected per-message failures, but it can also keep pressure on a struggling dependency. Keep a mapping concurrency ceiling aligned with database capacity and alert on message age and DLQ growth. If the handler throws instead of returning a valid partial response, Lambda treats the whole batch as failed.

## Worked example 1: batch duration and queue capacity

Queue receives 12,000 messages in 4 minutes: 50 msg/s. A Lambda invocation processes 20 messages in an average 4 seconds. At 30 concurrent invocations, ideal throughput is `30 × 20 / 4 = 150 msg/s`. If 20% of records fail transiently, useful throughput may be closer to 120 successful msg/s before repeated work. If processing rate later falls to 35 msg/s while arrival remains 50 msg/s, backlog grows by 15 msg/s. In 10 minutes that is 9,000 messages. Alarm on `ApproximateAgeOfOldestMessage`, not only visible-message count; a growing age shows SLO degradation even if the queue still accepts messages.

Do not raise concurrency immediately. Estimate database connections as `active invocations × per-invocation pool connections`. Thirty invocations each holding 5 connections can demand 150 connections. If database budget allows 90 for this worker, cap mapping concurrency or reduce pool size, then measure job age and completion latency.

## Worked example 2: poison record on an ordered stream

One malformed record repeatedly fails. If the source preserves per-shard ordering, newer records behind it may not advance. Inspect iterator age, batch failure logs, retry count, record sequence number, and destination delivery. Decide whether to correct and replay, split batches, or route the record to an approved failure destination. Skipping is a data-integrity decision: record why, who approved it, and how to reconcile downstream state. Do not discard an event silently just to lower the alarm.

## Worked example 3: timeout after a committed write

Handler updates a reservation row, then spends too long notifying a third-party API and times out. The SQS message reappears. On retry, the handler must detect the committed reservation and continue notification using an outbox/idempotency key, not decrement inventory again. Keep the transaction short; external calls should not hold DB locks. Record notification attempts and provider response. If provider status is unknown, reconcile rather than issuing a new non-idempotent request.

## Configuration lab: SQS retry controls

Illustrative commands; they mutate AWS resources and can incur cost. Review account, Region, queue policy, and exact timeout first.

```bash
aws lambda create-event-source-mapping \
  --function-name receipt-worker:live \
  --event-source-arn arn:aws:sqs:us-east-1:123456789012:receipts \
  --batch-size 10 \
  --function-response-types ReportBatchItemFailures \
  --maximum-batching-window-in-seconds 2

aws lambda list-event-source-mappings \
  --function-name receipt-worker:live
```

Also configure queue redrive policy (`maxReceiveCount` and DLQ ARN), encryption, visibility timeout, and alarms. The mapping has its own enabled/disabled state and maximum concurrency controls. Mapping-level concurrency should fit both function reserved concurrency and downstream capacity. A queue DLQ stores messages for later inspection; it does not repair them automatically.

## Production incident: retries double the database load

Symptoms: queue age grows, DB connections surge, Lambda errors rise, and retry count increases. Build one timeline from SQS visible/in-flight count, oldest message age, receive count, Lambda `Errors`, `Throttles`, `Duration`, `ConcurrentExecutions`, DB connections, query latency, and deploy time. Determine whether function defects cause retries, DB overload causes timeouts, or mapping concurrency exceeds the DB budget. Mitigate by capping mapping concurrency and reducing retry amplification; preserve messages in queue/DLQ. Fix the actual query/connection issue. Validate drain rate under controlled load and replay a sample from DLQ with idempotency checks. Raising concurrency can worsen the database outage.

## Alternatives and tradeoffs

An SQS queue is appropriate when work can wait and independent messages can be processed by competing consumers. Streams fit ordered, replayable change records but couple progress to shard/partition behavior. Asynchronous direct invocation removes caller wait but offers less visible backpressure than a queue the team owns. Step Functions can make multi-step retry/compensation state explicit; it does not remove idempotency needs. A synchronous API is simpler when the caller needs an immediate result and work fits its latency budget.

## Practical exercise

Implement a worker that processes invoice events. Inject failure before database commit, after database commit, and after provider acceptance but before response. For each failure point, state whether the source retries, how the idempotency key works, what durable state proves success, and how an operator reconciles an uncertain provider outcome.

## Exercise checks
- The retry owner and acknowledgement point are named for each failure point.
- The invoice key has a durable uniqueness constraint, not just an in-memory set.
- Successful work in a partly failed batch is not repeated unnecessarily when partial responses are enabled.
- Queue visibility and function timeout are compatible; poison-message policy is explicit.
- DLQ replay has an owner, audit trail, and duplicate-safe effect.

## Quick reference
- Retry rules depend on synchronous caller, async invocation, or event source mapping.
- Delivery can repeat; business side effects must be idempotent.
- Partial batch response narrows retry only when configured and implemented correctly.
- Queue age, in-flight count, receive count, Lambda errors, and dependency saturation belong on one timeline.
- DLQ is a holding place; replay and reconciliation are separate work.

## Roman Hinglish explanation

Distributed system mein timeout ka matlab aksar “result pata nahi” hota hai, “kaam hua hi nahi” nahi. Handler database write kar sakta hai aur SQS ack se pehle crash ho sakta hai. Queue wahi message dobara degi. Idempotency key ko durable store mein atomic condition ke saath likho; process memory ka set restart par gayab ho jaata hai aur concurrent duplicate ko rok nahi sakta. Batch mein ek record fail ho to partial response successful records ko dobara chalne se bacha sakta hai, lekin sirf tab jab records independent hon. Visibility timeout, Lambda timeout, retry count aur DLQ ek saath tune karo. DLQ ke events ko ek saath replay karna bhi traffic burst hai. Pehle cause fix karo, phir rate-limited replay aur duplicate-safe effects verify karo.
