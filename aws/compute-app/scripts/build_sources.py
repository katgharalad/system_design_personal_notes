"""Build a traceable index from the six AWS decision guides.

This downloads source documents for metadata only. It stores links and headings,
not the guide text. Run: python3 scripts/build_sources.py
"""
from __future__ import annotations

import datetime
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

GUIDES = [
    ("compute", "choosing-aws-compute-service", ["workload", "runtime", "scale", "placement"]),
    ("containers", "choosing-aws-container-service", ["runtime"]),
    ("lambda-fargate", "fargate-or-lambda", ["runtime", "scale"]),
    ("entry-options", "lightsail-elastic-beanstalk-ec2", ["runtime"]),
    ("modern-apps", "modern-apps-strategy-on-aws-how-to-choose", ["runtime", "scale"]),
    ("purchasing", "ec2-purchasing-options-aws-how-to-choose", ["workload"]),
]
SUPPORT = [
    ("ec2-regions", "Regions and Zones", "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html", "compute", ["placement"]),
    ("vpc-subnets", "Subnets for your VPC", "https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html", "compute", ["placement"]),
    ("nitro", "Instances built on the AWS Nitro System", "https://docs.aws.amazon.com/ec2/latest/instancetypes/ec2-nitro-instances.html", "compute", ["runtime"]),
    ("lambda-execution", "Running code with Lambda", "https://docs.aws.amazon.com/lambda/latest/dg/concepts-how-lambda-runs-code.html", "lambda-fargate", ["runtime", "scale"]),
    ("lambda-timeout", "Configure Lambda Event Function timeout", "https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html", "lambda-fargate", ["workload", "scale"]),
    ("lambda-durable", "Invoking durable Lambda functions", "https://docs.aws.amazon.com/lambda/latest/dg/durable-invoking.html", "lambda-fargate", ["ownership", "scale"]),
    ("ecs-task", "Amazon ECS task definitions", "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html", "containers", ["runtime"]),
    ("ecs-capacity", "Amazon ECS launch types and capacity providers", "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/capacity-launch-type-comparison.html", "containers", ["runtime"]),
    ("fargate-isolation", "Architect for AWS Fargate for Amazon ECS", "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html", "containers", ["runtime", "ownership"]),
    ("rds-proxy", "RDS Proxy concepts and terminology", "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.howitworks.html", "compute", ["workload", "scale"]),
    ("rds-pinning", "Avoiding pinning an RDS Proxy", "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-pinning.html", "compute", ["workload", "scale"]),
    ("lambda-concurrency", "Understanding Lambda function scaling", "https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html", "lambda-fargate", ["workload", "scale"]),
    ("lambda-managed", "Lambda Managed Instances", "https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances.html", "lambda-fargate", ["ownership"]),
    ("lambda-managed-practices", "Lambda Managed Instances best practices", "https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances-best-practices.html", "lambda-fargate", ["ownership"]),
    ("lambda-responsibility", "Lambda runtime shared responsibility", "https://docs.aws.amazon.com/lambda/latest/dg/runtime-management-shared.html", "lambda-fargate", ["ownership"]),
    ("asg-target", "EC2 Auto Scaling target tracking", "https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html", "compute", ["scale"]),
    ("asg-health", "Auto Scaling group health checks", "https://docs.aws.amazon.com/autoscaling/ec2/userguide/health-checks-overview.html", "compute", ["scale"]),
    ("alb-health", "Application Load Balancer target health", "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html", "compute", ["scale", "placement"]),
    ("ecs-scaling", "Optimizing ECS service auto scaling", "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/capacity-autoscaling-best-practice.html", "containers", ["scale"]),
    ("sqs-at-least-once", "SQS standard queue at-least-once delivery", "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html", "containers", ["runtime", "scale"]),
    ("ecs-arm", "Specify ARM architecture in ECS task definition", "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-arm-specifying.html", "containers", ["runtime"]),
    ("wellarchitected-review", "Well-Architected questions and best practices", "https://docs.aws.amazon.com/wellarchitected/latest/framework/appendix.html", "compute", ["workload", "ownership", "scale", "placement"]),
    ("wellarchitected-workload", "Workload and scope", "https://docs.aws.amazon.com/wellarchitected/latest/userguide/workload-and-scope.html", "compute", ["workload"]),
]

CONTENT = (Path(__file__).resolve().parents[1] / "src" / "content.ts").read_text()
SOURCE_LESSONS: dict[str, list[str]] = {}
for lesson_id, source_list in re.findall(r"^\s*id: '([^']+)',.*?sources: \[([^\]]+)\]", CONTENT, re.M):
    for source_id in re.findall(r"'([^']+)'", source_list):
        SOURCE_LESSONS.setdefault(source_id, []).append(lesson_id)

def fetch(url: str) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "EngineeringInterviewLab/1.0"}), timeout=30) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except Exception:
        return 0, ""

for path in (Path(__file__).resolve().parents[1] / "src" / "lessons").glob("*.md"):
    text = path.read_text()
    for ident, slug, _ in GUIDES:
        if f"https://docs.aws.amazon.com/decision-guides/latest/decision-guides/{slug}.html" in text:
            SOURCE_LESSONS.setdefault(ident, []).append(path.stem)
    for ident, _, url, _, _ in SUPPORT:
        if url in text:
            SOURCE_LESSONS.setdefault(ident, []).append(path.stem)
for ident in SOURCE_LESSONS:
    SOURCE_LESSONS[ident] = sorted(set(SOURCE_LESSONS[ident]))

video_notes = json.loads((Path(__file__).resolve().parents[1] / "src" / "video-notes.json").read_text())
sources = []
videos = []
for ident, slug, lessons in GUIDES:
    url = f"https://docs.aws.amazon.com/decision-guides/latest/decision-guides/{slug}.html"
    status, document = fetch(url.removesuffix(".html") + ".md")
    headings = [{"level": len(mark), "title": re.sub(r"\[\s*(.*?)\s*\]", r"\1", title).strip()} for mark, title in re.findall(r"^(#{1,6})\s+(.+)$", document, re.M)]
    links = []
    for raw in re.findall(r"\]\((https?://[^)\s]+|[^)#\s]+)(?:\s+[^)]*)?\)", document):
        link = urllib.parse.urljoin(url, raw).split("#")[0]
        if urllib.parse.urlparse(link).hostname in ("docs.aws.amazon.com", "aws.amazon.com") and link != url and link not in links:
            links.append(link)
    for raw_video in re.findall(r"https?://(?:www\.)?(?:youtube\.com/watch\?v=[A-Za-z0-9_-]+|youtu\.be/[A-Za-z0-9_-]+)", document):
        if not any(video["url"] == raw_video for video in videos):
            videos.append({"url": raw_video, "guideId": ident, **video_notes.get(raw_video, {"title": raw_video, "captions": "not verified", "takeaway": "", "usedInLessons": []})})
    date = re.search(r"\|\s*\*\*Last updated\*\*\s*\|\s*([^\n|]+)", document)
    sources.append({"id": ident, "title": headings[0]["title"] if headings else slug, "url": url, "parentGuide": None, "status": "retrieved" if status == 200 else "unavailable", "lastUpdated": date.group(1).strip() if date else None, "retrievedAt": datetime.date.today().isoformat(), "concepts": lessons, "lessons": SOURCE_LESSONS.get(ident, []), "headings": headings, "discoveredLinks": links})

for ident, title, url, parent_guide, lessons in SUPPORT:
    status, _ = fetch(url)
    sources.append({"id": ident, "title": title, "url": url, "parentGuide": parent_guide, "status": "retrieved" if status == 200 else "unavailable", "lastUpdated": None, "retrievedAt": datetime.date.today().isoformat(), "concepts": lessons, "lessons": SOURCE_LESSONS.get(ident, []), "headings": [], "discoveredLinks": []})

out = Path(__file__).resolve().parents[1] / "src" / "sources.json"
out.write_text(json.dumps({"generatedAt": datetime.date.today().isoformat(), "sources": sources, "videos": videos}, indent=2) + "\n")
print(f"Wrote {len(sources)} sources and {len(videos)} videos to {out}")
for source in sources:
    print(source["id"], source["status"], source["lastUpdated"], len(source["headings"]), len(source["discoveredLinks"]))
