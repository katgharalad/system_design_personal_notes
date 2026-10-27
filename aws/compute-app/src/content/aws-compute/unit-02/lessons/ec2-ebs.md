# EBS, instance store, and persistence

**Prerequisite:** AMIs and boot. **Sources:** [EBS volumes](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volumes.html), [EBS snapshots](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-snapshots.html), [instance lifecycle](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html).

## Learning objectives
- Choose block storage from access pattern, latency, IOPS, throughput, and durability needs.
- Explain volume and instance lifecycle through stop, detach, replacement, and AZ failure.
- Plan snapshots, filesystem consistency, encryption, and restore drills.

## Problem

“Disk is attached” does not define durability. Root volume deletion, filesystem corruption, write-cache behavior, snapshot consistency, and AZ-scoped attachment can decide whether a recovery works. Ephemeral instance store is useful scratch space but unsuitable as the only copy of important state.

## Definition and terminology

EBS is persistent block storage attached to an EC2 instance in the same Availability Zone. Volume type, size, provisioned performance, and attachment pattern shape behavior. A snapshot is a point-in-time backup object managed through the EBS snapshot mechanism. Instance store is local host-attached ephemeral storage with a different lifecycle. Filesystem and database consistency are application concerns layered above the block device.

## Mental model

Track three identities separately: host, volume, and data. A host can be replaced while an EBS volume remains; a volume can be detached and attached to a compatible instance in its AZ; an AZ loss may make that volume unavailable until recovery. A snapshot can create a new volume in another AZ, but restore time and application consistency need testing.

## Internal operation

The guest sees a virtual block device. Linux identifies device names, partition tables, filesystems, and mount points; do not assume device enumeration order is stable. Provisioned IOPS/throughput settings and volume size constrain achievable I/O. EBS-optimized paths and instance bandwidth also matter. Snapshot creation is storage-level; a database with active writes may need quiesce, checkpoint, or native backup coordination for application-consistent recovery.

## Execution lifecycle

Provision volume → attach in supported AZ → initialize filesystem → mount by stable identifier → application writes → monitor latency/queue depth → snapshot with consistency procedure → restore to a test volume → validate data and app → document recovery time.

## Worked example 1

A database needs 6,000 random read IOPS at 16 KiB each: raw payload throughput is about `6,000 × 16 KiB = 93.75 MiB/s`, excluding protocol and write traffic. A volume provisioned for 6,000 IOPS is not sufficient if throughput, instance bandwidth, queue depth, or database CPU is the actual bottleneck. Benchmark the read/write mix, block size, and latency target.

## Worked example 2

A 200 GiB volume snapshots every hour. “One-hour RPO” is valid only if snapshot completion, log backup, and restore path produce a recoverable database within that bound. Test a restore, replay logs, and measure data loss and recovery time. Snapshot frequency alone is not an RPO proof.

## Configuration lab

```bash
aws ec2 describe-volumes --volume-ids vol-0123456789abcdef0 \
  --query 'Volumes[].{State:State,AZ:AvailabilityZone,Encrypted:Encrypted,Type:VolumeType,Size:Size,IOPS:Iops,Throughput:Throughput}'
aws ec2 describe-volumes-modifications --volume-ids vol-0123456789abcdef0
```

Before changing filesystem or volume settings, confirm application backup and rollback. Encrypt volumes and snapshots according to account policy. Avoid mounting the same ordinary filesystem read-write on multiple hosts unless the filesystem and attachment model explicitly support it.

## Alternatives and decision boundary

Use EBS for low-latency block devices and instance-bound database disks. S3 fits durable object data and decouples objects from hosts. EFS or FSx can fit shared file semantics when their protocol and latency match. Instance store is appropriate for reconstructible cache, shuffle, or temporary data.

## Tradeoffs

More provisioned performance can cost more without increasing useful throughput. Snapshots aid recovery but do not replace tested restore. Local storage may be fast but disappears with host lifecycle. Cross-AZ replication adds cost and consistency behavior that must be explicit.

## Failure analysis

Check volume state, attachment AZ, guest device mapping, filesystem mount, inode/space exhaustion, queue depth, read/write latency, and instance EBS bandwidth. For slow queries, separate storage latency from lock waits and CPU saturation.

## Debugging procedure

Capture CloudWatch volume metrics, OS `iostat`, filesystem usage, database waits, and application latency over the same interval. Confirm whether the incident started after a resize, restore, snapshot, or host replacement. Never run filesystem repair on the only copy; clone or snapshot first under incident procedure.

## Production checklist
- Root delete-on-termination policy is deliberate and reviewed.
- Data volumes use encryption, tags, backup policy, and tested restore.
- Mount by UUID or stable filesystem identity; monitor free blocks and inodes.
- Document AZ-loss recovery and restore duration.

## Practical exercise

Given a PostgreSQL write-heavy workload with 2 ms p95 storage target, calculate required IOPS and throughput from measured block size and operations/s. Identify instance bandwidth and database limits. Then restore a snapshot in a separate environment and verify checksums.

## Exercise checks
- IOPS and throughput are calculated independently.
- The backup path restores application-consistent data.
- Instance store is not counted as durable state.

## Quick reference
- EBS is AZ-scoped block storage; snapshots require restore testing.
- IOPS, throughput, latency, and instance bandwidth all matter.
- Filesystem and database semantics sit above the block device.

## Deepened mechanism: Block storage behavior, throughput math, and recovery consistency

### Worked example 3 — IOPS is not throughput

A database issues 16 KiB random reads at 8,000 IOPS. The payload throughput is `8,000 × 16 KiB = 125 MiB/s` approximately. If the workload changes to 256 KiB sequential reads at the same 8,000 IOPS, payload throughput becomes roughly 2,000 MiB/s, before protocol and filesystem overhead. The same IOPS number can therefore imply very different bandwidth. Check both provisioned IOPS and throughput limits for the volume and instance path, and compare observed queue depth and latency. Larger I/O size can hit throughput before IOPS; small random I/O can hit IOPS first.

EBS is network-attached block storage with persistence across supported instance stop/start and replacement patterns, unlike instance store which is ephemeral to the host lifecycle. A volume’s durability and performance depend on its type, size/configuration, AZ, snapshots and attachment model. EBS snapshots are incremental point-in-time backups, but restoring a volume does not automatically produce a fully warmed cache. Plan restore time and initialization for the actual recovery objective.

### Worked example 4 — crash consistency versus application consistency

A database writes a transaction log and data pages to separate volumes. A snapshot taken without coordinating writes may capture a crash-consistent point, requiring database recovery after restore. For application-consistent backup, quiesce or flush writes using the database’s supported backup procedure, then snapshot the related volumes as a coordinated set. Test restore into an isolated environment and verify database recovery, row counts and application invariants. A “snapshot completed” event does not prove the database can start or meet RTO.

### Incident trace

Latency rises while instance CPU remains low. Compare EBS volume read/write latency, queue length, throughput and burst balance where applicable; inspect instance EBS bandwidth limits and `iostat` output. Separate filesystem-full, high queue depth, throttling and application lock symptoms. If queue length is high but configured throughput is adequate, the instance’s aggregate EBS bandwidth or I/O pattern may bind. Change one parameter at a time and validate p99 plus cost.

### Roman Hinglish explanation

EBS ko network ke through attached block device samjho. App ko disk jaisa interface dikhta hai, lekin performance IOPS, bytes per second, request size, queue depth aur instance bandwidth par depend karti hai. IOPS akela throughput nahi batata. Snapshot backup hai, par restore ke baad app-consistent data aur warm cache guarantee nahi. Database procedure se writes coordinate karo, restore test chalao, phir RTO measure karo. Instance store fast scratch ho sakta hai, lekin instance host lifecycle ke saath data ja sakta hai. Durable data ke liye us par akeli copy mat rakho.

### Direct AWS references for these mechanisms

- [Amazon EBS volume types](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html) — performance and configuration dimensions.
- [Amazon EBS snapshots](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-snapshots.html) — point-in-time snapshot behavior.
