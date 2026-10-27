# Amazon ECR image distribution

**Prerequisite:** Images and Dockerfiles. **Sources:** [What is ECR?](https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html), [ECS task definitions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html).

## Learning objectives
- Publish and reference an immutable image artifact.
- Distinguish build/push credentials from task image-pull permissions.
- Plan lifecycle, scan, replication, and private network access.

## Problem

A task definition references an image tag, but the tag moved after review. Or the task cannot start because the role that pulls the image lacks ECR access. Artifact identity and runtime permission must be explicit.

## Definition and terminology

ECR is a managed container image registry. Repository contains image manifests and layers, with repository policy and lifecycle controls. Image digest identifies content. ECS task execution role commonly grants the agent/runtime permission to pull a private image and publish logs; task role grants app code access to AWS APIs. Do not reuse broad credentials across these identities.

## Internal operation

CI authenticates to ECR, builds and pushes an image, and records its digest. At task start, ECS/Fargate obtains image-pull authorization using execution permissions, downloads manifest/layers through the configured network path, and starts the container. Cross-account access needs both identity and repository-side authorization. Cross-Region deployment may require replication or separately published images.

## Execution lifecycle

CI test → scan/SBOM → tag release → push → resolve digest → promote artifact → update task definition → runtime pulls → task starts → verify digest and health.

## Worked example 1

`api:production` can point to different image bytes tomorrow. Task definition reference `api@sha256:...` pins the artifact. A new deployment becomes a new task-definition revision. Rollback reuses the previous revision/digest; it does not rely on an old mutable tag.

## Worked example 2

Tasks in private subnets fail to start with image-pull timeout. Check execution role, ECR API and Docker registry endpoints, S3 layer path, DNS, SG egress, endpoint policy, and Region. A policy granting `ecr:GetAuthorizationToken` alone is not necessarily sufficient for repository layer access.

## Configuration lab

```bash
aws ecr get-login-password --region us-east-1 | docker login \
  --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
docker tag api:release 123456789012.dkr.ecr.us-east-1.amazonaws.com/api:release-2026-10
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/api:release-2026-10
```

CI should use an assumed role/federated identity, not a saved user key. Record digest, commit, build ID, scan result, and provenance.

## Alternatives and decision boundary

ECR fits AWS ECS/EKS integration and IAM-based access. Other OCI registries can fit multi-cloud or existing enterprise pipelines, but network, authentication, availability, and image replication must be designed. Registry selection does not determine orchestrator.

## Tradeoffs

Digest pinning and immutable tags improve reproducibility but need release automation. Aggressive lifecycle deletion saves storage and can remove rollback artifacts. Replication improves regional availability but introduces propagation timing and policy complexity.

## Failure analysis

Check registry URI/account/Region, execution role, repo policy, endpoint/NAT route, architecture/manifest, image digest, and lifecycle deletion. Separate pull failure from process startup failure.

## Debugging procedure

Inspect ECS stopped reason and task events, then test ECR API from correct account/Region. Compare task execution role with working service; inspect repository and endpoint policies. Confirm image digest is present before updating service.

## Production checklist
- Immutable release digest is recorded.
- Execution role is separate from app task role.
- Scan and SBOM gate promotion.
- Lifecycle policy retains known-good rollback versions.

## Practical exercise

Design CI → ECR → ECS release with cross-account staging and production. Specify identity, repo policy, digest promotion, image retention, and rollback.

## Exercise checks
- Build credentials are not shipped to task.
- Task pulls exact digest from intended Region/account.
- Rollback artifact remains available.

## Quick reference
- ECR stores image; it does not run task.
- Execution role pulls; task role authorizes application code.
- Tag is a reference; digest is content identity.

## Image identity, provenance, and retention

A tag is a mutable pointer unless repository policy prevents reassignment; a digest identifies content. Record source commit → build → digest → task/pod revision. Retain rollback digests; lifecycle rules can delete the needed image. Scanning is time-bound: define blocking findings, owner, remediation deadline, and rescanning after new disclosures. A signed image is trusted only if deployment verifies its signer and policy. Build secrets must not enter image layers; removing a secret in a later layer does not erase it from earlier layers. Private pulls need network access to ECR/image data, execution-role permission, and endpoint-policy permission.

## Incident drill

A release tag points to unexpected bytes. Compare the running digest with CI provenance, redeploy the known digest, make release tags immutable, and test rollback while the old digest is retained.

## Hinglish explanation

Tag naam hai; digest exact bytes. Source se running task tak provenance jodo. Scan purana ho sakta hai, isliye rescan aur finding owner chahiye. Secret image layer mein mat daalo. Rollback artifact ko retention policy se bachao.

## Release commands and verification

The following is a schematic CI sequence. Supply account, Region, and repository from the pipeline; do not place long-lived credentials in shell history.

```bash
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
docker buildx build --platform linux/amd64 --tag "$REPOSITORY:$GIT_SHA" --push .
aws ecr describe-images --repository-name "$REPOSITORY" \
  --image-ids imageTag="$GIT_SHA" --query 'imageDetails[0].imageDigest' --output text
```

Capture the resulting digest and place it in the task definition. For mixed ARM/x86 capacity, publish a manifest list for exact target platforms and test each one. Validate the production execution role can pull that digest in the selected account and Region. Cross-account replication also requires a destination repository policy and verification that the replicated digest matches. A successful push proves only that CI could publish; it does not prove production can pull and start the image.

Promote one built artifact: build once, scan and approve the digest, then deploy that digest to staging and production. Rebuilding per environment breaks byte-for-byte provenance. Retain build record, scan result, software bill of materials, exceptions, and deployment revision together. Protect current and last-known-good artifacts for the rollback and incident-investigation window. A release policy should say who can push, who can approve, and what security finding blocks promotion.

### Diagnose a pull failure

Separate `CannotPullContainerError` into DNS, network, authorization, repository, and artifact causes. Verify Region/account and digest first. Check task execution-role trust and ECR pull actions, then endpoint security-group ingress and private DNS, then the S3 path used for image layers. If the image exists but a layer is unavailable, inspect lifecycle cleanup or replication. A local pull tests the developer's identity and network, not the task execution role. Use the stopped reason and API evidence to confirm the task principal. After repair, launch one canary before replacing the full service.
