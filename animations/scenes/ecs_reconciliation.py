"""Shows ECS task state, health gates, and repeated replacement of bad inputs."""
import json
import os
from pathlib import Path

from manim import DOWN, UP, Create, FadeIn, FadeOut, Line, Rectangle, Scene, Text, Transform, VGroup, Write
from theme import BACKGROUND, GRID, INITIALIZE, INK, INVOKE, MUTED, PANEL, PRESSURE, REQUEST, apply_theme

apply_theme()


class EcsTaskReconciliation(Scene):
    def construct(self):
        self.marks = {}
        self.cues = []
        self.mark("opening")
        title = Text("ECS desired state is not application health", font_size=30, color=INK).to_edge(UP, buff=.3)
        subtitle = Text("Illustrative service with desired count 2; timing and retries depend on configuration", font_size=16, color=MUTED).next_to(title, DOWN, buff=.12)
        self.play(Write(title), FadeIn(subtitle), run_time=.9)

        labels = ["Placement", "Image + init", "RUNNING", "ALB healthy"]
        xs = [-4.3, -1.45, 1.45, 4.3]
        header = VGroup()
        for label, x in zip(labels, xs):
            header.add(Text(label, font_size=17, color=MUTED).move_to([x, 2.05, 0]))
        self.play(FadeIn(header), run_time=.5)
        self.play(Create(Line([-5.5, 1.55, 0], [5.5, 1.55, 0], color=GRID)), run_time=.4)

        self.mark("desired")
        self.cue("The ECS service wants two tasks. A task definition specifies image, resources, networking, roles, and health checks.")
        desired = Text("desired = 2", font_size=23, color=REQUEST).move_to([-4.4, .8, 0])
        task_a = self.card("Task A", "placed", INITIALIZE, [-4.3, -.05, 0])
        task_b = self.card("Task B", "placed", INITIALIZE, [-4.3, -.95, 0])
        self.play(FadeIn(desired), FadeIn(task_a), FadeIn(task_b), run_time=.8)
        self.wait(.6)

        self.mark("startup")
        self.cue("Task A pulls its image and starts. Task B cannot pull because the execution role lacks registry permission.")
        self.play(task_a.animate.move_to([-1.45, -.05, 0]), run_time=.5)
        self.replace_text(task_a, "RUNNING", "process started", INVOKE)
        self.play(task_b.animate.move_to([-1.45, -.95, 0]), run_time=.5)
        self.replace_text(task_b, "STOPPED", "image pull denied", PRESSURE)
        note = self.note("Execution role authorizes agent setup; task role authorizes application AWS calls.")
        self.wait(.8)

        self.mark("predict-health")
        self.cue("Predict: Task A is RUNNING. Can the ALB route user traffic to it yet?")
        self.change_note(note, "Predict: RUNNING is process state. Which independent health gate is still pending?")
        self.wait(2)

        self.mark("target-check")
        self.cue("The ALB registers Task A's IP, but its /ready probe returns 404. The task is running, yet the target is unhealthy.")
        self.play(task_a.animate.move_to([4.3, -.05, 0]), run_time=.55)
        self.replace_text(task_a, "UNHEALTHY", "/ready → 404", PRESSURE)
        self.play(task_b.animate.move_to([-.2, -1.9, 0]), run_time=.45)
        self.replace_text(task_b, "replacement", "same task revision", INITIALIZE)
        self.change_note(note, "Service tries to restore desired state. Same bad image, role, or health path can repeat the failure.")
        self.wait(.8)

        self.mark("predict-fix")
        self.cue("Predict: what evidence separates a startup failure from a running but unhealthy target?")
        self.change_note(note, "Compare stopped reason, task events, container health, ALB target reason, port, path, and security groups.")
        self.wait(2)

        self.mark("recovery")
        self.cue("Fix the execution role and readiness path. A replacement reaches RUNNING, passes its probe, and becomes routable.")
        self.play(*[FadeOut(item) for item in list(self.mobjects)], run_time=.5)
        stages = VGroup(
            Text("desired tasks → placement → image pull → process", font_size=21, color=INITIALIZE),
            Text("RUNNING → container health → ALB target health", font_size=21, color=INVOKE),
            Text("Only healthy registered targets receive routed traffic", font_size=22, color=REQUEST),
            Text("Inspect the failed stage before allowing replacement to repeat", font_size=19, color=PRESSURE),
        ).arrange(DOWN, buff=.5).move_to([0, 0, 0])
        self.play(FadeIn(stages), run_time=.7)
        self.wait(1.5)
        self.mark("end")
        output = Path(os.environ.get("ANIMATION_TIMING_FILE", Path(__file__).resolve().parents[1] / "build" / "ecs-task-reconciliation-timing.json"))
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps({"marks": self.marks, "cues": self.cues}, indent=2) + "\n")

    def card(self, title, detail, color, point):
        box = Rectangle(width=2.15, height=.62, color=color, fill_color=PANEL, fill_opacity=1, stroke_width=2).move_to(point)
        text = VGroup(Text(title, font_size=16, color=color), Text(detail, font_size=12, color=INK)).arrange(DOWN, buff=.04).move_to(box)
        return VGroup(box, text)

    def replace_text(self, card, title, detail, color):
        box = card[0]
        updated = self.card(title, detail, color, box.get_center())
        self.play(Transform(card, updated), run_time=.35)

    def note(self, text):
        box = Rectangle(width=12.2, height=.55, color=GRID, fill_color=PANEL, fill_opacity=1, stroke_width=1).move_to([0, -3.35, 0])
        label = Text(text, font_size=15, color=INK).move_to(box)
        group = VGroup(box, label)
        self.play(FadeIn(group), run_time=.3)
        return group

    def change_note(self, current, text):
        fresh = Text(text, font_size=15, color=INK).move_to(current[0])
        self.play(FadeOut(current[1]), FadeIn(fresh), run_time=.3)
        current.remove(current[1])
        current.add(fresh)

    def mark(self, name): self.marks[name] = round(self.renderer.time, 3)
    def cue(self, text): self.cues.append({"start": round(self.renderer.time, 3), "text": text})
