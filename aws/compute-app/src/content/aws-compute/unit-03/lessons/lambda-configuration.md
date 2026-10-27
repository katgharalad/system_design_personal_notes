# Lambda configuration, runtimes, memory, and timeout

**Prerequisite:** Execution lifecycle, networking, and concurrency. **Sources:** [Timeout configuration](https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html), [environment variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html), [execution lifecycle](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html), [Lambda best practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html).

## Learning objectives
- Select memory, timeout, architecture, ephemeral storage, runtime, and environment from workload measurements.
- Separate initialization cost, handler time, network wait, and billed duration.
- Write handlers that reuse clients safely without treating memory or `/tmp` as durable storage.
- Use bounded timeouts and cancellation so retries do not amplify downstream work.

## Problem: small settings change the whole request path

Lambda configuration is workload design. Memory affects the available CPU share and can change duration. Timeout controls how long one invocation may run, but it does not guarantee that a downstream call stops when the invocation is about to time out. `/tmp` is temporary per environment. Environment variables configure a version, but they are not a general secret vault. Runtime versions receive maintenance and deprecation changes. Architecture selection affects native dependencies and available price/performance. A function that “works” with defaults can still violate latency, cost, or recovery requirements.

Start with a measured input: payload-size distribution, CPU time, memory high-water mark, network wait, p95/p99 duration, cold-start sensitivity, temporary working-set size, and concurrency. Choose a candidate configuration, run representative load, and keep the result plus source date. Do not tune from one successful console invocation.

## Runtime lifecycle and configuration boundaries

The execution environment lifecycle has Init, Invoke, and Shutdown phases. Runtime, extensions, imports, and code outside the handler can run during initialization. A handler invocation receives event data and a context with a request ID and remaining time. After a successful invoke, Lambda may reuse an environment. It may also reset or shut down the environment. Module-level clients and immutable lookup data can be reused as an optimization; user-specific request data must not leak through module globals between invocations. Do not rely on a cleanup hook for correctness.

Separate configuration types:

- **Deploy-time configuration:** runtime, architecture, handler, memory, timeout, ephemeral storage, layers, VPC, execution role, environment values.
- **Versioned code/configuration:** published Lambda version captures code and most configuration as an immutable unit; aliases provide stable caller names that point to versions.
- **Runtime secrets:** fetch through an approved secrets mechanism with a scoped role; define rotation and refresh behavior.
- **Per-invocation data:** event and context; never place request-specific state in shared global memory.

Changing an environment variable updates function configuration and can affect versions and deployment flows. A secret in an environment variable can be exposed through configuration access to principals who can read it. Encryption at rest does not remove the need to restrict `GetFunctionConfiguration`, control deployment identities, and avoid logging values.

## Memory, CPU, and architecture

Lambda allocates CPU in relation to configured memory. More memory can reduce CPU-bound duration and can improve throughput enough to lower total compute cost, even though the per-time resource rate is higher. For an I/O-bound function, extra CPU may not help if database, DNS, or external API latency dominates. Benchmark multiple memory settings against successful useful work, p95/p99, error rate, and downstream pressure.

For example, variant A uses 512 MB, runs 800 ms, and processes 100 images/minute. Variant B uses 1,024 MB, runs 350 ms, and processes 230 images/minute. Compare GB-seconds per successful image: A is `0.5 GB × 0.8 s = 0.4 GB-s`; B is `1 GB × 0.35 s = 0.35 GB-s`, before request charges and free-tier/pricing details. B may be cheaper per output and lower concurrency at the same RPS. These invented measurements are illustrative, not an AWS benchmark. Repeat with realistic payloads and warm/cold paths.

The `arm64` and `x86_64` architectures need matching binaries, layers, and native packages. A container image or layer that contains the wrong architecture can fail during initialization with executable format errors or missing libraries. Build and test artifacts for the selected architecture; do not infer compatibility from source-language portability.

## Timeout and cancellation design

Standard Lambda Event Function invocation timeout is configurable up to 15 minutes in the current default execution model. Lambda Managed Instances and Durable Functions have distinct duration models; do not apply the 15-minute statement universally. Durable execution timeout controls the whole workflow, while each individual function invocation still has its own timeout. Recheck current service documentation when selecting a long-running model.

Set a function timeout from a request budget, not from the maximum allowed value. Example: caller timeout 2 seconds; API Gateway integration budget 1.8 seconds; reserve 250 ms for serialization and response means application work may have only about 1.55 seconds, further divided across database and third-party calls. If the handler waits 1 second for a database then 2 seconds for an API, a 3-second function timeout cannot satisfy a 2-second caller SLA.

Use the context deadline to stop starting work when too little time remains. Set downstream timeouts below the remaining function time and use abort signals where the client supports them. A timeout does not prove that a remote service stopped processing. If the caller retries while the original side effect is still running, duplicate operations can occur. Use idempotency and durable operation state.

```ts
type LambdaContext = { getRemainingTimeInMillis(): number };

export async function handler(event: { id: string }, context: LambdaContext) {
  const reserveForResponseMs = 250;
  const maxDownstreamMs = Math.min(
    1_200,
    context.getRemainingTimeInMillis() - reserveForResponseMs,
  );
  if (maxDownstreamMs <= 0) throw new Error('insufficient invocation budget');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), maxDownstreamMs);
  try {
    return await fetchRecord(event.id, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
```

This is a teaching sketch. Verify that the specific HTTP/database client honors cancellation. A client timeout that only stops waiting may leave server-side work active.

## Ephemeral storage and `/tmp`

`/tmp` is local temporary storage scoped to an execution environment. It can help stage a downloaded object or cache a deterministic artifact within that environment, but it is not durable, shared, or guaranteed to exist on the next invocation. Do not store the only copy of customer data, a workflow checkpoint, or a distributed lock there. Size ephemeral storage for the peak working set including input, decompressed form, intermediates, and output. For a 180 MB compressed archive that expands 5×, input plus output and scratch can exceed 1 GB. Include concurrent file operations and safety margin.

Put durable input/output in S3 or another durable service. Use object versions, checksums, and completion markers if downstream consumers must not see partial output. On reuse, validate a cached file against the object version or ETag; never assume the environment has not handled another tenant’s request.

## Worked example: image resizing configuration

Each source image is 20 MB compressed, expands to a 140 MB working set, and produces three outputs totaling up to 45 MB. Peak scratch requirement is at least `20 + 140 + 45 = 205 MB`, plus libraries and temporary copies. Measure actual peak memory because decoded pixels, not compressed bytes, may dominate. Begin with 1,024 MB memory and 1 GB ephemeral storage as a test assumption, not a production conclusion. Benchmark 1,024/2,048 MB and compare processing duration, Max Memory Used, billed GB-seconds, timeout rate, and S3 throughput. If one image needs 4 minutes and the queue must drain a million images within 30 minutes, estimate throughput and required concurrency before setting the timeout. Bound concurrency by S3 request budget and downstream metadata database capacity.

## Configuration and inspection

Read-only inspection:

```bash
aws lambda get-function-configuration \
  --function-name image-resizer \
  --query '{Runtime:Runtime,Handler:Handler,Arch:Architectures,Memory:MemorySize,Timeout:Timeout,Storage:EphemeralStorage.Size,Role:Role,State:State,LastUpdate:LastUpdateStatus}'
```

An example configuration update (mutating; do not run in production during study):

```bash
aws lambda update-function-configuration \
  --function-name image-resizer \
  --memory-size 2048 \
  --timeout 90 \
  --ephemeral-storage '{"Size":2048}' \
  --architectures arm64
```

Validate the native image library for ARM before choosing `arm64`. Configuration updates can take time; wait for `LastUpdateStatus=Successful` before publishing a version or shifting an alias. Rollout should include a canary with representative input sizes.

## Failure analysis

**Timeouts began after a dependency release.** Compare `Duration`, `Init Duration`, timeout status, downstream spans, and runtime version by release. A change in `Init Duration` points toward imports, extensions, or VPC setup; a longer handler span points toward code or a dependency. Check whether client timeouts exceed the remaining invocation budget. Stop retry amplification before raising the function timeout.

**Memory errors occur only for large input files.** Segment duration and `Max Memory Used` by payload size. Compare compressed and decoded size, parallel workers, and output copies. A higher memory setting might improve CPU and memory headroom; streaming or moving the job to a different compute model may fit better if per-invocation memory or runtime bounds are fundamental.

**ARM deployment fails at Init.** Read the exact `Runtime.ImportModuleError` or loader message, inspect layer/image architecture, and compare lockfile and built artifacts. Rebuild dependencies for the selected architecture; do not switch production architecture blindly because native packages and performance differ.

## Tradeoffs and practical exercise

Configuration is an interaction surface. Larger memory can reduce duration but change cost and concurrency. Longer timeout can permit slow work but hold concurrency and connections longer. More `/tmp` can support large transforms but does not create durable storage. Provisioned concurrency reduces some initialization latency but charges for pre-initialized capacity. A container service may be better for a long-running listener, custom OS package, or task that needs sustained work beyond the selected Lambda model.

Exercise: measure a CPU-bound JSON transform at 512, 1,024, and 2,048 MB. For each, record 1,000 payloads, p50/p95 duration, max memory, errors, and GB-seconds. Then run with a DB dependency and repeat. Explain why the fastest setting may not be safest or cheapest, and pick a production timeout from the full caller budget.

## Practical exercise

For a 700 ms API request, write a timeout budget for API Gateway, Lambda, a 250 ms database call, and a 200 ms payment call. State the remaining margin and behavior when payment outcome is ambiguous. Then size `/tmp` for a 400 MB compressed input that expands four times and creates a 150 MB output. Propose one measurement that would make you change each setting.

## Exercise checks
- Report CPU-bound and dependency-bound results separately.
- Calculate cost per successful output, including retries, not just nominal memory price.
- Use p95/p99 and payload-size distribution, not only a single average.
- Keep secret values out of code, logs, and broadly readable function configuration.
- Treat `/tmp` and process memory as disposable; put durable state elsewhere.

## Quick reference
- Memory, CPU share, duration, billed usage, and concurrency interact.
- Timeout must fit caller budget and propagate to downstream calls.
- `/tmp` is temporary per environment; it is not a workflow store.
- Match native dependencies to `arm64` or `x86_64`.
- Distinguish standard Event Function, Managed Instances, and Durable Functions limits.

## Roman Hinglish explanation

Memory slider sirf RAM nahi badhata; Lambda CPU allocation bhi memory ke saath badalti hai. Isliye CPU-heavy transform zyada memory par jaldi khatam ho sakta hai. Sahi choice benchmark se aati hai: cost per successful result, p95 latency, max memory, aur retry cost dekho. Timeout ko kaam chhupane ke liye mat badhao. API ka overall deadline baanto: Lambda ke paas response aur cleanup ke liye waqt bache. `/tmp` ek execution environment ka scratch space hai; next invocation mein file milne ki guarantee nahi. Input, expanded file, intermediate, output ek saath disk par hain to sabka peak jodo. Secret environment variables mein ho to config access aur logging dono control karo; encrypted storage ka matlab runtime exposure zero nahi.
