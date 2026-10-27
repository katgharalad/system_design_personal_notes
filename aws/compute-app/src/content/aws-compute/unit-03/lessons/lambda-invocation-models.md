# Lambda invocation models and event contracts

**Prerequisite:** Compute workload profile. **Sources:** [Invocation methods](https://docs.aws.amazon.com/lambda/latest/dg/lambda-invocation.html), [event-driven architectures](https://docs.aws.amazon.com/lambda/latest/dg/concepts-event-driven-architectures.html), [event source mappings](https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html), [API Gateway integration](https://docs.aws.amazon.com/lambda/latest/dg/services-apigateway.html).

## Learning objectives
- Distinguish synchronous invocation, asynchronous invocation, and poll-based event source mapping.
- Identify who acknowledges success, retries failure, and owns buffering in each path.
- Design a stable event contract and make duplicate delivery safe.
- Calculate how batch size and service time affect throughput and backlog.

## Problem: a trigger is not a delivery guarantee

“S3 invokes Lambda” hides the most important system questions. Does S3 call Lambda directly? Does Lambda poll a queue? Does the caller wait for a response? Who retries? What happens if the handler commits a database write but times out before the invoker learns the result? These answers differ by integration. A trigger is a connection between services; it does not imply one universal retry or ordering model.

Before selecting an integration, write the event producer, transport, consumer, acknowledgement point, retry owner, duplicate behavior, ordering need, and maximum acceptable delay. Then draw the state change. For a reservation event, “message accepted” is not the same as “reservation committed”; the system must expose which of those states the caller can observe.

## Definitions and three invocation paths

### Synchronous request/response

The caller invokes the function and waits for the function result. Direct Invoke uses `RequestResponse`; API Gateway can synchronously invoke a Lambda integration and return a mapped HTTP response. The request path is:

```text
client -> API Gateway -> Lambda Invoke -> handler -> response -> API Gateway -> client
```

The caller or front-door service sees success or failure and owns what to do next. Lambda does not automatically retry a failed synchronous invocation on behalf of a direct caller. A timeout leaves an ambiguous outcome: the handler may have performed a side effect before the response was lost. Client retries therefore need an idempotency key or equivalent conditional write.

### Asynchronous push

The producer sends an event and Lambda accepts it into its managed asynchronous queue. The producer receives acceptance before handler completion. Lambda later invokes the function. S3 object notifications, EventBridge rules, and direct `InvocationType=Event` are examples of asynchronous push paths, with source-specific delivery behavior around them.

The acceptance response means the event entered the asynchronous path; it does not mean business processing completed. Lambda retries certain function errors according to asynchronous invocation rules and can send records to a configured destination or dead-letter queue after failure. The producer may have its own retry policy if it cannot confirm acceptance. That creates more than one possible retry layer.

### Poll-based event source mapping

An event source mapping is a Lambda resource. Lambda-managed pollers read records from a supported queue or stream and invoke the function with a batch. SQS, Kinesis, and DynamoDB Streams use this model. The source retains records until the integration-specific acknowledgement point. A failed batch can be retried; duplicate processing is possible. Ordering and failure blast radius depend on the source, batch settings, and partial failure support.

```text
producer -> durable queue/stream <- Lambda poller -> batch -> handler
                                           ^             |
                                           +-- retry / acknowledgement
```

This is not the same as a service pushing one event directly to Lambda. Polling introduces queue age, batch size, visibility or retention windows, poller concurrency, and backpressure controls. It can buffer a burst. It also means accepted work may wait, so the product contract must allow delay.

## Execution lifecycle and acknowledgement

For every delivery path, distinguish four facts:

1. The source has accepted the event.
2. Lambda has started an invocation.
3. The business side effect has committed.
4. The source has received or recorded successful completion.

A crash between steps 3 and 4 can cause the event to be delivered again. Exactly-once business effects do not come from transport alone. Use a durable idempotency record or a naturally idempotent operation. For a payment-like effect, persist a unique operation key under a database constraint, and make duplicate requests return the prior result rather than charge again.

For a stream, a batch failure may hold up progress at a shard or partition, depending on the source. For SQS, a failed message becomes visible after its visibility timeout and can be received again; a redrive policy can eventually move it to a DLQ. For asynchronous invocation, Lambda manages an internal queue and its retry/destination configuration. Ask the exact source-specific question instead of saying “Lambda retries three times” for every trigger.

## Worked example: reservation API and receipt email

The customer submits a reservation and expects an immediate confirmation. The API must synchronously validate availability and commit the reservation. Sending email can be delayed. If the API waits for email delivery, the customer-facing latency now depends on a third-party email path. Instead:

1. API validates the request and idempotency key.
2. One database transaction reserves inventory and writes an outbox row.
3. API returns the committed reservation ID.
4. An outbox publisher sends `ReservationConfirmed` to SQS.
5. Lambda polls a batch, sends the email, and records the result with a stable event ID.
6. On a retry, the worker checks its idempotency record and avoids sending a second effect where the provider supports an idempotency key.

The outbox closes the gap between a committed database transaction and a message publish. Without it, the process can commit the reservation and crash before publishing, or publish then roll back the reservation. The worker still needs duplicate handling because delivery may repeat.

## Worked example: choosing batch size

Assume 24,000 records arrive over 10 minutes. Each record needs 80 ms average CPU and a Lambda batch has 100 records. Ignoring init and downstream wait, a full batch needs about 8 seconds of CPU work if processed serially. At 40 concurrent invocations, idealized throughput is `40 × 100 / 8 = 500 records/s`. The arrival rate is `24,000 / 600 = 40 records/s`, so this capacity has headroom. But if each invocation spends 1.5 seconds waiting on a database and the function performs sequential writes, actual wall time is 9.5 seconds and concurrency demand, database connections, and timeout margin change.

Do not conclude that batch size 100 is always better. Large batches reduce invocation overhead, but increase memory use, duration, retry blast radius, and the amount of successfully processed work that may be repeated after a whole-batch failure. Partial batch response can narrow retry to failed records for supported mappings. Measure record size, duration distribution, error rate, and dependency capacity.

## Configuration lab: SQS mapping

Illustrative configuration only. Replace ARNs, role, queue policy, and limits with values from the target account. This creates an AWS resource and may incur charges if run.

```bash
aws lambda create-event-source-mapping \
  --function-name arn:aws:lambda:us-east-1:123456789012:function:receipt-worker \
  --event-source-arn arn:aws:sqs:us-east-1:123456789012:receipts \
  --batch-size 10 \
  --function-response-types ReportBatchItemFailures
```

The function's execution role needs permission to consume messages and decrypt a customer-managed KMS key if applicable. The queue and function must satisfy regional requirements. Configure visibility timeout with the function timeout and batch behavior in mind. Set a redrive policy and alarm on DLQ depth and oldest-message age. The command alone does not configure the queue's redrive policy, IAM role, encryption, or idempotency.

Example partial response in TypeScript:

```ts
type SqsRecord = { messageId: string; body: string };
type SqsEvent = { Records: SqsRecord[] };

export async function handler(event: SqsEvent) {
  const failures: Array<{ itemIdentifier: string }> = [];
  for (const record of event.Records) {
    try {
      await processOnce(record.messageId, record.body);
    } catch (error) {
      console.error('record failed', { messageId: record.messageId, error });
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
}
```

`processOnce` must commit its idempotency marker with the business effect or use a durable unique operation key. Logging and continuing after every failure is safe only if the mapping is configured for partial batch response. Otherwise, the handler response has different acknowledgement semantics.

## Failure investigation

### Queue age rises while invocation count stays low

Check `ApproximateAgeOfOldestMessage`, visible and in-flight messages, event source mapping state, function errors/throttles, reserved concurrency, mapping maximum concurrency, poller configuration, and account quota. Inspect IAM errors and KMS decrypt failures. Determine whether low concurrency is intentional backpressure or an inactive/broken mapping. Do not increase concurrency until the database and downstream API can absorb it.

### Message repeats after a successful write

Compare the event ID, database idempotency row, handler completion timestamp, and queue receive count. If the write committed but the function timed out before returning success, a retry is expected. Make the effect idempotent and ensure the record acknowledgement follows durable completion. Increasing visibility timeout may reduce overlapping retries, but it does not eliminate duplicate delivery.

### Entire batch repeats for one poison record

Confirm event source and partial batch response configuration. For SQS, return failed message IDs when enabled. For stream sources, inspect retry, bisect, record age, and shard/partition progress settings. A poison item can block later records when ordering is required. Route terminal failures for inspection without silently discarding valid work.

## Alternatives and decision boundaries

Choose synchronous integration when the caller needs a result before it can proceed and the end-to-end latency budget fits. Choose asynchronous push when the producer can accept an acknowledgement that means “queued for processing,” and source semantics fit the failure contract. Choose queue/stream polling when durable buffering, consumer-controlled throughput, batching, or replay matters.

SQS buffers independent work and supports competing consumers; FIFO queues add ordering and deduplication features with their own throughput and grouping constraints. Kinesis or DynamoDB Streams fit ordered shard/partition records and replay windows, but a slow or failing consumer can delay progress. EventBridge routes events among targets and supports filtering; it is not a replacement for a work queue when consumer backpressure and job visibility are central. Step Functions is useful for explicit multi-step orchestration and compensation; it adds workflow state and service configuration.

## Practical exercise

Design a thumbnail pipeline. S3 receives an object, a queue buffers work, and a Lambda worker writes a derived image. Specify the trigger/poll path, event schema, idempotency key, retry owner, acknowledgement point, DLQ, ordering requirement, and metrics. Calculate drain time for 18,000 queued objects if measured safe throughput is 75 objects/s and new traffic continues at 15 objects/s.

## Exercise checks
- Net drain rate is `75 - 15 = 60 objects/s`; idealized drain time is `18,000 / 60 = 300 seconds`.
- The answer says which service accepts the original event and which component owns each retry.
- Duplicate object events cannot create conflicting output or overwrite a newer version silently.
- Queue age and DLQ depth have alarms with a named replay owner.
- Concurrency is bounded by measured downstream capacity.

## Quick reference
- Sync: caller waits for result; caller/integration owns retry decision.
- Async push: producer gets acceptance; processing completes later.
- Event source mapping: Lambda polls a queue or stream and invokes batches.
- Every delivery can repeat; protect business effects with idempotency.
- Batch, timeout, visibility, retry, ordering, and concurrency are one design.

## Roman Hinglish explanation

Trigger ka naam delivery contract nahi batata. API Gateway sync invoke kare to caller result ya error ka wait karta hai. Direct async invoke mein Lambda pehle event accept karta hai; handler baad mein chalta hai, isliye acceptance ko completion mat samjho. SQS case alag hai: event source mapping queue poll karti hai, records ka batch banati hai, aur handler ko deti hai. Failure par message phir visible ho sakta hai. Har path mein likho: kaun event bhejta hai, acknowledgement ka matlab kya hai, aur retry kis component ke control mein hai. Customer ko turant answer chahiye to sync contract rakho. Delay allowed ho to durable status aur async worker use karo. Dono mein duplicate side effect ka plan zaroori hai.
