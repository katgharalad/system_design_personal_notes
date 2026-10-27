# Lambda identity, permissions, secrets, and isolation

**Prerequisite:** IAM roles, resource policies, encryption, and VPC boundaries. **Sources:** [Lambda execution role](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html), [resource-based policies](https://docs.aws.amazon.com/lambda/latest/dg/access-control-resource-based.html), [Lambda shared responsibility](https://docs.aws.amazon.com/lambda/latest/dg/runtime-management-shared.html), [environment variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html).

## Learning objectives
- Distinguish the identity that deploys/invokes a function from the identity the function uses.
- Apply least privilege to execution roles, resource policies, secret retrieval, KMS, and network access.
- Explain why environment encryption does not make a secret safe from principals who can read function configuration.
- Diagnose AccessDenied errors by finding the missing policy layer.

## Problem: “Lambda role” is ambiguous

When an S3 event should invoke a function, at least two permission directions exist. The function needs permission to read or write S3 objects; S3 needs permission to invoke the function. These use different policies. The execution role grants permissions to code while it runs. A resource-based policy on the function can grant an AWS service or another account permission to invoke it. The deployment principal needs separate control-plane permissions to create code, pass the role, and configure triggers.

Confusing these directions creates overbroad policies such as `lambda:*` and `s3:*` on `Resource: "*"`. It also produces misleading debugging: a successful deploy does not prove the function can read a secret, and an attached execution role does not prove API Gateway can invoke the function.

## Identity model

### Deployment principal

CI/CD or an engineer calls Lambda control-plane APIs. It needs narrowly scoped actions for the named functions/aliases and `iam:PassRole` only for the approved execution role. Protect this principal with federation, short sessions, and audited release permissions. Do not give application runtime code deployment authority.

### Execution role

Lambda assumes the function’s execution role at runtime. Its trust policy allows the Lambda service principal to assume it. Its permission policy grants the function access to logs, a specific secret, a specific S3 prefix, a queue, or a table. Different functions with different data ownership should usually use different roles. Shared role reuse makes accidental privilege inheritance harder to audit.

### Resource-based policy

The function resource policy controls who can call `lambda:InvokeFunction`, often a service principal scoped by source account and source resource ARN. API Gateway integration, S3 notifications, SNS, and cross-account callers have source-specific policy needs. A resource policy granting invoke permission does not grant the function access to the caller’s data.

### Resource and KMS policies

The target service may also have a resource policy, bucket policy, queue policy, key policy, or VPC endpoint policy. An Allow in the role policy can still be denied by an explicit Deny, a permissions boundary, SCP, session policy, or resource policy. KMS decrypt requires both IAM authorization and key-policy compatibility. Trace the principal and resource on each hop.

## Least privilege by data path

For an image worker that reads `s3://media-prod/incoming/` and writes derivatives to `s3://media-prod/derived/`, scope `s3:GetObject` to the input prefix and `s3:PutObject` to the output prefix. If the bucket uses a customer-managed KMS key, grant only required decrypt/encrypt actions on that key and ensure the key policy permits the role. CloudWatch logging permissions should target the necessary log groups. The handler should not get `iam:PassRole`, `lambda:UpdateFunctionCode`, or access to unrelated production buckets.

Secrets should be fetched at runtime from Secrets Manager or another approved store using a scoped resource ARN. Cache a secret within an environment only with an explicit rotation policy: define max cache age and behavior when the secret rotates during an active execution. Avoid logging retrieved values. Do not place long-lived secrets directly in source code or a broadly readable deployment artifact.

## Execution lifecycle and threat boundaries

1. Trusted deployment pipeline publishes code and assigns an execution role.
2. Triggering service is authorized by the function resource policy or integration configuration.
3. Lambda starts the runtime in its managed execution environment and provides temporary role credentials.
4. Code calls downstream APIs using those credentials; each target evaluates its own authorization.
5. Logs/traces are emitted under the configured role and data controls.

The function runs customer code, so validate dependencies, artifacts, build provenance, and configuration. Managed infrastructure shifts host patching to AWS; the customer still owns code vulnerabilities, permissions, data access, secrets, event validation, and incident response. Tenant-controlled event fields must not be treated as trusted identity claims. Derive authorization from verified authentication context, not a user-supplied `role` field in JSON.

## Configuration examples

Trust policy (role may be assumed by Lambda):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

Illustrative permissions policy; replace account, Region, bucket, secret, and log resources. This deliberately excludes broad administrator access.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":["logs:CreateLogStream","logs:PutLogEvents"],"Resource":"arn:aws:logs:us-east-1:123456789012:log-group:/aws/lambda/image-worker:*"},
    {"Effect":"Allow","Action":"s3:GetObject","Resource":"arn:aws:s3:::media-prod/incoming/*"},
    {"Effect":"Allow","Action":"s3:PutObject","Resource":"arn:aws:s3:::media-prod/derived/*"},
    {"Effect":"Allow","Action":"secretsmanager:GetSecretValue","Resource":"arn:aws:secretsmanager:us-east-1:123456789012:secret:image-worker-*"}
  ]
}
```

If the secret uses a customer-managed key, add narrowly scoped `kms:Decrypt` on that key and validate the key policy. If bucket encryption also uses a customer-managed key, evaluate the required S3/KMS permissions separately. The example log-group resource must exist or include required create-log-group permission; pre-create it if you want a tighter runtime role.

An invocation policy needs to scope the source. For S3, include the bucket ARN and account condition as supported by the trigger path; do not use a wildcard principal without a source restriction. The exact policy shape depends on the invoking AWS service and account setup.

## Worked examples

### Example 1: deploy succeeds, invocation is denied

API Gateway returns an integration permission error. Check API Gateway integration URI, function/alias ARN, stage deployment, and `lambda:InvokeFunction` permission. Inspect the function resource policy and source ARN/account conditions. The execution role is irrelevant to whether API Gateway may invoke the function.

### Example 2: handler receives event but S3 read returns AccessDenied

Confirm the assumed role ARN in logs or CloudTrail, exact bucket/key, `s3:GetObject` resource prefix, bucket policy, KMS key, SCP/boundary, and endpoint policy. If the object is encrypted with a customer key, S3 permission alone may not allow decrypt. Avoid attaching `AmazonS3FullAccess` as a blind fix; it broadens every bucket action and masks the missing resource boundary.

### Example 3: secret rotated, intermittent authentication failures

Compare failures to rotation timestamp, environment reuse, secret-cache age, database credentials accepted, and DB connection lifetime. A warm environment can retain a cached credential after rotation. Set a bounded cache TTL, refresh on auth failure with a safe single retry, and avoid reconnect storms. Never print the secret while debugging.

## Practical exercise: authorization map

For an API Gateway → Lambda → SQS → worker Lambda → S3 → KMS design, create a matrix with caller principal, action, resource ARN, policy location, and expected denial signal for each edge. Then remove one permission at a time and predict which API, CloudTrail, Lambda log, or service metric reveals it.

## Exercise checks
- API Gateway invoke permission is separate from Lambda execution role access.
- Producer and worker use different roles when their data privileges differ.
- S3 prefix and KMS key are scoped; no wildcard administrator policy is used.
- Deployment identity can pass only the approved role and cannot read runtime data by default.
- Secret rotation, cache lifetime, and log redaction are defined.

## Quick reference
- Execution role: permissions the running function uses.
- Resource policy: who may invoke or access the function resource.
- Deployment principal: who can change code/config and pass a role.
- Target resource and KMS policies still apply after IAM allows an action.
- Event fields are data, not trusted authorization.

## Roman Hinglish explanation

“Lambda permission” ek permission nahi hai. Caller ko function invoke karne ka adhikar chahiye. Function chalne ke baad execution role decide karta hai ki code S3, SQS, database secret ya doosri service ko access kar sakta hai ya nahi. Cross-account invoke mein function ki resource policy aur caller role ki identity policy dono check karo. Deployment pipeline teesri identity hai: code badalne wala principal runtime role ke andar code chala sakta hai, isliye uski authority sensitive hai. Har data path ko principal → action → resource ke roop mein likho. Phir ek permission hata kar dekho ki denial kahan dikhega. Wildcard policy se error chup jaata hai, lekin blast radius badhta hai. Secret rotate ho to warm environment mein cache aur purane database connection ko bhi consider karo.
