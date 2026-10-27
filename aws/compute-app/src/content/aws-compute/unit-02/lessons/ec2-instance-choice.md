# Instance families and resource selection

**Prerequisite:** EC2 architecture. **Sources:** [EC2 instance types](https://docs.aws.amazon.com/ec2/latest/instancetypes/instance-types.html), [compute decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html).

## Learning objectives
- Turn CPU, memory, accelerator, storage, and network observations into candidate families.
- Explain why vCPU count alone does not predict throughput.
- Select a benchmark that measures useful work and tail latency.

## Problem

“Use the largest general purpose instance” ignores the bottleneck. CPU-heavy compression, memory-heavy graph traversal, GPU inference, and high packet-rate networking have different limits. Wrong family selection can waste budget and still miss the SLO.

## Definition and terminology

An instance family groups hardware around a workload profile: general purpose, compute optimized, memory optimized, storage optimized, and accelerated computing are common categories. A size scales resources within a family. vCPU is a scheduling unit, not necessarily a physical core. Network and EBS bandwidth can have limits and may be expressed as baseline and burst behavior for some types. Exact attributes vary by generation, size, Region, and configuration.

## Mental model

Find the resource that constrains completed work per second. For a request server, sample CPU utilization together with run queue, memory pressure, network throughput, storage latency, and p95/p99 request latency. Low average CPU does not prove spare capacity if one thread is saturated, requests wait on I/O, or a downstream pool is exhausted.

## Internal operation

EC2 exposes a virtual machine shape backed by host resources. The guest sees logical CPUs, memory, virtual devices, and network interfaces. CPU credit behavior for burstable families, accelerator driver/runtime compatibility, EBS bandwidth, and network packet processing are family-specific. AMI architecture must match the CPU architecture. For GPU, the host type alone is not enough: install a compatible driver and CUDA/runtime stack, then validate model memory and kernel support.

## Execution lifecycle

Measure workload → form two or three family hypotheses → check architecture/AMI and service quotas → benchmark at the intended concurrency → record throughput and p95/p99 → test N-1 capacity and price → deploy gradually → revisit from production telemetry.

## Worked example 1

An API handles 400 requests/s at 30 ms CPU each: about 12 CPU-seconds per second, or 12 fully busy cores before headroom. If one chosen instance safely sustains 80 requests/s at target p95, baseline count is `ceil(400/80)=5`. For one-AZ loss across two equally sized AZs, each AZ must have capacity for the full load: ten instances at this measured rate, or a different measured shape. The estimate excludes burst length, retries, and database capacity.

## Worked example 2

A worker shows 35% CPU but p99 latency rises when resident memory reaches 95% and major page faults increase. A compute-optimized family may worsen the bottleneck. Test memory-optimized capacity and also inspect object allocation, cache size, and swap. Compare completed jobs per dollar, not just hourly instance price.

## Configuration lab

```bash
aws ec2 describe-instance-types --instance-types c7i.large m7i.large r7i.large \
  --query 'InstanceTypes[].{Type:InstanceType,VCpu:VCpuInfo.DefaultVCpus,Memory:MemoryInfo.SizeInMiB,Arch:ProcessorInfo.SupportedArchitectures}'
```

Use output to shortlist, not to select final capacity. Run the same representative dataset, runtime, and concurrency on each candidate. Record image build architecture and driver versions.

## Alternatives and decision boundary

Resize vertically if one process needs large memory or shared state; scale horizontally if work can be partitioned and state externalized. ECS/Fargate can simplify task operation but offers a different set of hardware/control options. Lambda can fit event-shaped jobs. For parallel finite work, evaluate Batch scheduling.

## Tradeoffs

Newer generation may improve performance per dollar but requires compatibility testing. Larger instances can reduce coordination overhead but increase blast radius and create scale-in steps. Specialized accelerator capacity may have quota, supply, image, and data-transfer constraints.

## Failure analysis

Look for a single saturated core, CPU throttling/credits, OOM kills, page faults, EBS queue depth, network drops, accelerator memory exhaustion, and architecture mismatch. Do not infer “CPU bound” from CPU alone; confirm the work rate stops improving as CPU rises.

## Debugging procedure

Reproduce with production-like inputs. Capture CloudWatch metrics plus process-level profiles, kernel memory data, block-device latency, and application histograms. Change one shape dimension at a time; deploy as a small canary. Compare p95/p99 and successful work per dollar.

## Production checklist
- Pin AMI architecture and driver/runtime versions.
- Define throughput and tail-latency acceptance thresholds.
- Include EBS, network, and downstream limits in capacity tests.
- Keep a fallback family and test launch capacity before a critical migration.

## Practical exercise

Profile an API under a 3× burst. Choose an initial family hypothesis from evidence, size the fleet using measured throughput, then calculate N-1 count for two AZs. State what data would invalidate your choice.

## Exercise checks
- Sizing uses a measured completed-work rate, not only vCPU count.
- One-AZ loss calculation keeps surviving capacity above required traffic.
- AMI architecture and accelerator software compatibility are checked.

## Quick reference
- Family = optimization; size = resource scale; generation = hardware revision.
- Benchmark the full path, including EBS, network, and dependencies.
- Compare p95/p99 and useful work per dollar.

## Deepened mechanism: Benchmarking resource shape instead of picking a family by name

### Worked example 3 — burstable CPU credits

Assume a small baseline service runs on a burstable instance with 20% baseline CPU and uses 60% CPU for 15 minutes each hour. The surplus is 40 percentage points for 0.25 hour, or 0.10 vCPU-hours per vCPU each hour. Whether credits accumulate or drain depends on the selected size, mode and credit balance; calculate from the exact instance’s documented baseline and vCPU count. A short benchmark that finishes before credits drain can overstate sustained capacity. Replay the workload long enough to observe credit balance, CPU, latency and throttling behavior. If utilization is continuously high, compare a fixed-performance family instead of relying on burst credits.

Instance selection is a multi-resource fit. CPU family and generation affect compute performance; memory ratio matters for working sets; EBS-optimized throughput and network bandwidth can bind independently; GPU selection requires compatible software and data pipeline. Some network and EBS capabilities are maximums that vary with instance size and sustained/burst conditions. Read the exact family specification and benchmark representative payloads. “m7g” or “c7i” is not a decision by itself; the correct comparison is useful completed work per dollar at the required latency and failure headroom.

### Worked example 4 — CPU looks idle, p99 is poor

A service has 35% average CPU but p99 latency doubles during object uploads. Measure EBS queue length and latency, network throughput, packet drops, memory pressure, garbage collection, and downstream time. If network bandwidth is saturated by uploads, a larger CPU family may not help. If memory reclaim causes stalls, CPU averages can remain low while latency worsens. Use CloudWatch detailed monitoring and guest-level telemetry where needed; distinguish instance metrics from OS metrics because the default EC2 metric set does not expose every guest resource at fine granularity.

### Interview defense

Ask which metric defines useful throughput, how long the workload runs, and whether the workload is CPU, memory, storage or network constrained. Then describe a test matrix across family, size and architecture. Include software compatibility (especially ARM/native dependencies), steady-state duration, p95/p99, error rate, EBS/network saturation and cost per successful job. Keep one alternative instance family in the test, not just one larger size.

### Roman Hinglish explanation

Instance family choose karna workload ko resource budget dena hai. CPU busy hai to compute-optimized benchmark karo; memory pressure hai to RAM; disk wait hai to EBS; packet throughput ceiling hai to network capability. Ek metric dekhkar size badhana waste ho sakta hai. Burstable family ke credits short demo mein result achha dikha sakte hain, lekin sustained load par balance girne ke baad CPU performance badal sakti hai. Test utni der chalao jitna real production burst/sustain period hai. Decision “kaunsa family popular hai” se nahi, “kitna useful work target SLO ke andar per dollar” se karo.

### Direct AWS references for these mechanisms

- [EC2 instance types](https://docs.aws.amazon.com/ec2/latest/instancetypes/instance-types.html) — current family capabilities and specifications.
- [Amazon EC2 burstable performance instances](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/burstable-credits-baseline-concepts.html) — CPU baseline and credit model.
