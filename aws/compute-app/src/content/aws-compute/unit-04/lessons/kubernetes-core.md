# Kubernetes fundamentals

**Prerequisite:** Container lifecycle. **Sources:** [EKS Kubernetes concepts](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-concepts.html), [EKS architecture](https://docs.aws.amazon.com/eks/latest/userguide/eks-architecture.html).

## Learning objectives
- Explain desired-state reconciliation and core Kubernetes objects.
- Distinguish liveness, readiness, startup probes, requests, and limits.
- Trace scheduling, rollout, and service routing.

## Problem

Kubernetes is not “a place that runs Docker.” It is an API and control-loop system. A Pod object can exist while unscheduled, a container can run while readiness fails, and a Deployment can remain unavailable while trying to reconcile its desired replicas.

## Definition and terminology

API server accepts desired objects; etcd stores cluster state; scheduler binds unscheduled Pods to nodes; controllers reconcile observed state toward desired state; kubelet on each node starts containers. A Deployment manages ReplicaSets and Pods. A Service selects Pods and provides stable discovery. Requests inform scheduling; limits constrain runtime resources. ConfigMaps and Secrets inject configuration, with encryption/access policy still required.

## Internal operation

Client applies a Deployment with `replicas: 3`. Controller creates a ReplicaSet and Pods. Scheduler chooses nodes whose resources and constraints fit requests. Kubelet pulls image and starts containers. Readiness gates Service endpoint membership; liveness can trigger restart; startup probe allows slow boot before other probes. A node failure triggers reconciliation but replacement needs capacity, image access, storage semantics, and scheduling constraints.

## Execution lifecycle

Apply YAML → admission/authn/authz → object stored → controller creates child objects → scheduler places Pod → kubelet starts image → probes pass → Service routes → rollout replaces old ReplicaSet.

## Worked example 1

Deployment requests 6 Pods at 500m CPU and 1 GiB each: scheduler needs at least 3 vCPU and 6 GiB allocatable, plus system overhead and placement constraints. Node allocatable is lower than raw EC2 capacity. If each AZ needs two Pods, topology rules can leave Pods pending when one AZ lacks room.

## Worked example 2

Liveness checks database connectivity. DB outage causes every Pod restart; reconnect storm increases DB load. Use readiness to stop sending traffic when appropriate, keep liveness focused on whether process can recover locally, and bound dependency timeouts.

## Configuration lab

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: {name: api}
spec:
  replicas: 3
  selector: {matchLabels: {app: api}}
  template:
    metadata: {labels: {app: api}}
    spec:
      containers:
        - name: api
          image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/api@sha256:REPLACE
          resources: {requests: {cpu: "500m", memory: "512Mi"}, limits: {cpu: "1", memory: "1Gi"}}
          readinessProbe: {httpGet: {path: /ready, port: 3000}}
```

This is a learning manifest, not production-complete; configure identity, secrets, security context, disruption budget, rollout, and networking.

## Alternatives and decision boundary

Kubernetes helps when standard APIs, ecosystem, and platform abstraction solve real organizational needs. ECS offers a smaller AWS-native orchestration surface. Managed platforms reduce control-plane work but do not remove app operations.

## Tradeoffs

Declarative reconciliation improves repeatability but adds API concepts, cluster upgrades, add-ons, policy, and observability. More controllers can obscure who changes a resource. Teams need an owner and support model.

## Failure analysis

`Pending`: scheduler events/resources/taints/IPs. `ImagePullBackOff`: registry, IAM, DNS, or digest. Running but not ready: probe/path/dependency. CrashLoopBackOff: exit, OOM, config, or bad liveness. Service has no endpoints: selector or readiness mismatch.

## Debugging procedure

Inspect `kubectl describe pod`, events, logs including previous container, node allocatable, Deployment/ReplicaSet conditions, and Service endpoints. Check admission policy and controller events before manually editing Pods.

## Production checklist
- Requests/limits reflect measured runtime.
- Probes model startup/readiness/liveness separately.
- Rollout, PDB, topology, IAM, and network policy are tested.
- Cluster/version/add-on upgrade ownership is explicit.

## Practical exercise

Create a local Kubernetes Deployment for the included service. Break its image, readiness path, and resource request in turn. Diagnose from events rather than guessing.

## Exercise checks
- Desired state is reconciled by controllers.
- Probe failure semantics are distinct.
- Pending Pod indicates placement/resource constraints, not app crash.

## Quick reference
- Deployment → ReplicaSet → Pod → container.
- Scheduler uses requests and constraints; limits affect runtime.

## Follow a Deployment through reconciliation

A Deployment declares replicas and a pod template; its controller creates ReplicaSets, which create Pods. The scheduler assigns eligible Pods using requests, selectors, affinity, taints, and constraints. Controllers keep retrying toward desired state. This repairs transient failures but also repeats a bad image or impossible rule. Read Events to find the blocked controller.

Readiness removes a Pod from ready endpoints; it does not restart the container. Liveness can restart it. Startup probes allow slow initialization before liveness checks. A dependency-bound liveness probe can restart every replica during an outage. HPA adjusts replica count, not node capacity; node autoscaling adds capacity later. Requests influence scheduling; limits affect runtime and memory pressure can cause OOM. NetworkPolicy only works when the network plugin enforces it.

## Worked case

Six replicas use maxUnavailable 1 and maxSurge 1. New Pods stay pending because CPU requests do not fit. Diagnose scheduler Events; add capacity or revise requests only from measurements. Do not weaken readiness to make the rollout green.

## Hinglish explanation

Deployment se ReplicaSet, phir Pod; scheduler requests aur rules dekhta hai. Readiness traffic gate hai; liveness restart kara sakta hai. HPA Pods badhata hai, node turant nahi. Pending event se exact blocker pakdo—CPU, IP, taint ya storage.

## Trace a rollout and its failure signals

When a Deployment template changes, Kubernetes creates a new ReplicaSet and gradually adjusts old and new replicas under the rollout strategy. `kubectl rollout status deployment/api` reports controller progress; `kubectl describe deployment` and ReplicaSet events show why progress stalls. A Pod may be Pending because it has no suitable node, ContainerCreating because image or network setup failed, Running but NotReady because readiness is false, or Ready while the application still violates its semantic contract. Each state needs different evidence.

Do not use liveness as a dependency health probe. If every Pod restarts whenever a shared database slows, the restart storm adds load and destroys useful in-memory state. Readiness may remove a Pod when it cannot serve, but if all Pods fail readiness the service has no endpoints. Pair probes with bounded client timeouts, circuit breaking, and an explicit overload response. For background workers, readiness may represent ability to accept a new job; do not make it depend on finishing the current job if that prevents graceful draining.

Resource scheduling uses requests against allocatable node resources. CPU request is a scheduling reservation, not a promise of dedicated CPU. A CPU limit can throttle bursts. Memory overrun can terminate the container. HPA metrics, Pod requests, node autoscaler settings, and scale delay form one control loop; test it under burst and node loss. A replica increase without capacity, IPs, storage, or dependency budget can create pending Pods rather than throughput.
