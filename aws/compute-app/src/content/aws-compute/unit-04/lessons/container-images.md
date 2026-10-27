# Images, layers, and Dockerfiles

**Prerequisite:** Containers and isolation. **Sources:** [Amazon ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html), [container decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-container-service.html).

## Learning objectives
- Build a small deterministic image and understand layer cache invalidation.
- Apply multi-stage builds, non-root execution, and artifact provenance.
- Diagnose architecture, tag, and registry-pull failures.

## Problem

“Works on my machine” often means host libraries or untracked files leaked into runtime. Bloated images lengthen pulls and widen vulnerabilities. Mutable tags make rollback ambiguous.

## Definition and terminology

An OCI image consists of manifests and content-addressed layers. Dockerfile instructions generally create layers; cache reuse depends on instruction and input changes. Multi-stage build keeps compilers and development tools out of the runtime image. A tag is a human-readable reference that can move; digest identifies exact content. Registry authentication and image pull permissions are separate from task application permissions.

## Internal operation

Build context is sent to the builder; `.dockerignore` controls what enters it. Layer cache is reused when prior instruction and inputs match. BuildKit can run build steps and export artifacts. At deploy, ECS agent or Fargate runtime pulls manifest and layers from ECR, then starts the command. If image architecture, CPU ABI, or native extension differs, the process can fail despite successful pull.

## Execution lifecycle

Commit source → lock dependencies → build stage → run tests/scans → package runtime stage → tag and push → resolve digest → update task definition → pull and launch → verify startup and health.

## Worked example 1

Copying `package.json` and lockfile before source allows dependency layer cache to survive ordinary code changes. Copying the whole repository first invalidates dependency install whenever any file changes. This affects build time, not runtime correctness; keep required generated assets in the final stage.

## Worked example 2

A laptop on ARM builds an image with a native dependency; an x86_64 EC2 task cannot load it. Build for the target platform or publish a correctly tested multi-architecture manifest. Add architecture verification to CI and inspect task stopped reason before changing IAM.

## Configuration lab

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
USER node
CMD ["node", "dist/server.js"]
```

Validate that production dependencies are complete; this sample assumes lockfile and build output match. Never copy `.env`, SSH keys, or local cloud credentials into the build context.

## Alternatives and decision boundary

Use a language runtime image when rebuild speed matters and image size is acceptable. Distroless/minimal images reduce packages but may require external debugging tools. Build once and promote the same digest across environments; do not rebuild separately per environment without a reason.

## Tradeoffs

Smaller image improves pull/start time and reduces packages but can make debugging harder. Reproducible pinned bases improve provenance but need regular security updates. Multi-arch publication adds build/test complexity.

## Failure analysis

Pull denied: check execution role, ECR repo policy, Region/account, and token path. `exec format error`: architecture mismatch. Missing shared library: runtime stage omitted dependency. Slow rollout: inspect layer size, cache, NAT/endpoint path, and ECR pull throughput.

## Debugging procedure

Record image URI and digest, platform, task stopped reason, and builder metadata. Run the exact digest locally using target platform. Inspect layers for secrets and unnecessary files. Compare ECR scan findings and build SBOM before promotion.

## Production checklist
- Lockfile and base image are pinned and updated.
- Build context excludes secrets and local artifacts.
- CI tests exact digest and target architecture.
- ECR lifecycle, encryption, scan, and pull policy are configured.

## Practical exercise

Reduce a 1.2 GB app image. Measure compressed size, pull time, startup p95, and vulnerability count. Prove the optimized image contains all runtime libraries and no build token.

## Exercise checks
- Image digest, not a mutable tag alone, identifies release.
- Build and runtime dependencies are distinguished.
- Registry access uses task execution permissions, not app credentials.

## Quick reference
- Order Dockerfile instructions for useful cache reuse.
- Multi-stage build separates compiler and runtime artifacts.
- Match image architecture to selected capacity.

## Image artifact and process contract

An OCI manifest points to image config and layers. Layer order affects caching; `.dockerignore` keeps secrets and local output out of the build context. Multi-stage builds omit compilers from runtime images but do not replace vulnerability and permission review. Match image architecture to target capacity; ARM development output may fail on x86 nodes. Record platform and digest.

Use exec-form entrypoints where possible so the process receives termination signals. The app should stop accepting requests, drain bounded in-flight work, close dependencies, and exit before forced termination. ECS CPU/memory and Kubernetes requests/limits have different scheduling/runtime meanings. Exit 137 alone does not prove OOM; correlate platform reason, memory metrics, host events, and logs.

## Worked incident

Image runs on an ARM laptop but fails on x86 production. Inspect manifest and runtime architecture before changing IAM or routes. Build a target platform or multi-platform manifest, test it on target runtime, and pin the digest in deployment.

## Hinglish explanation

Image ke architecture, layer, entrypoint aur signal handling matter karte hain. Local success target architecture prove nahi karta. Shutdown mein request drain aur pool close karo. Exit code akela cause nahi batata; runtime reason aur metrics dekho.

## Minimal production Dockerfile pattern

This example shows a multi-stage build. Pin reviewed base-image digests in a real release and keep dependency lockfiles in the cached layer.

```dockerfile
FROM node:22-alpine AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /src/package*.json ./
COPY --from=build --chown=node:node /src/node_modules ./node_modules
COPY --from=build --chown=node:node /src/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

The final stage excludes the source tree and build tools, but still includes runtime dependencies. Confirm the application does not need omitted assets, that the non-root user can read files, and that writable paths are explicit. Add `.dockerignore` entries for `.git`, local secrets, coverage output, and dependency folders CI rebuilds. Never copy `.env`. Pin the final image by digest and smoke-test the same platform and command ECS will use. A smaller image can reduce transfer time, but do not remove runtime debugging or trust material without a plan for diagnosis and verification.

### Diagnose a container that exits immediately

Read the task's stopped reason and exit code, then compare command, entrypoint, environment, filesystem permissions, architecture, and secret/config injection with the last healthy revision. An image that exits locally with code 0 may contain a short-lived command where the service expected a long-running process. A missing executable may be architecture or path mismatch; permission denied may be a non-root ownership issue. Reproduce with the same digest and command, then change one input at a time. Do not add a wrapper to hide a bad exit; if a wrapper is needed, ensure it propagates signals and exit status.
