"""Shows SQS visibility expiry after a partial side effect; times are conceptual."""
import json
import os
from pathlib import Path

from manim import Arrow, Create, FadeIn, FadeOut, Line, Rectangle, Scene, Text, VGroup, Write, DOWN, UP
from theme import BACKGROUND, GRID, INITIALIZE, INK, INVOKE, MUTED, PANEL, PRESSURE, REQUEST, apply_theme

apply_theme()


class SqsRedelivery(Scene):
    def construct(self):
        self.marks = {}
        self.cues = []
        self.mark("opening")
        title = Text("SQS: failure can replay successful work", font_size=31, color=INK).to_edge(UP, buff=.3)
        subtitle = Text("Standard queue + Lambda event source mapping • conceptual timeline", font_size=17, color=MUTED).next_to(title, DOWN, buff=.12)
        self.play(Write(title), FadeIn(subtitle), run_time=1)

        labels = ["Queue", "Lambda batch", "Database", "Visibility"]
        ys = [1.45, .3, -.9, -2.15]
        left, right = -4.8, 5.8
        grid = VGroup()
        for label, y in zip(labels, ys):
            grid.add(Text(label, font_size=17, color=MUTED).move_to([-5.55, y, 0]))
            grid.add(Line([left, y-.36, 0], [right, y-.36, 0], color=GRID, stroke_width=1))
        self.play(Create(grid), run_time=.8)

        self.mark("receive")
        self.cue("The event source mapping polls SQS and receives a batch. It is not one push per record.")
        note = self.note("Mapping receives records A, B, and C; their visibility timers start.")
        batch = VGroup(*[self.record(name, -3.45+i*1.05, 1.45, REQUEST) for i,name in enumerate("ABC")])
        self.play(FadeIn(batch), run_time=.8)
        timers = VGroup(*[self.bar(-3.45+i*1.05, -2.15, .9, "timer", INITIALIZE) for i in range(3)])
        self.play(FadeIn(timers), run_time=.6)
        self.wait(1)

        self.mark("process")
        self.cue("The handler commits A and B. C fails before its side effect completes.")
        self.change_note(note, "One invocation processes a batch. A and B commit; C fails.")
        db_ok = self.record("A ✓  B ✓", -2.1, -.9, INVOKE, width=2.0)
        db_fail = self.record("C: fail", .5, -.9, PRESSURE, width=1.8)
        self.play(FadeIn(db_ok), FadeIn(db_fail), run_time=.7)
        self.wait(1.1)

        self.mark("whole-batch")
        self.cue("Without partial batch response, a failed batch can make A and B visible again too.")
        self.change_note(note, "Whole-batch failure: A and B may be delivered again despite committed writes.")
        replay = VGroup(*[self.record(name, 1.45+i*1.05, 1.45, PRESSURE) for i,name in enumerate("ABC")])
        arrows = VGroup(*[Arrow([-2.1+i*1.05, 1.05, 0], [1.6+i*1.05, 1.05, 0], color=PRESSURE, stroke_width=2, buff=.08) for i in range(3)])
        self.play(Create(arrows), FadeIn(replay), run_time=1)
        self.wait(1)
        self.mark("predict-duplicate")
        self.change_note(note, "Predict: what prevents a second business effect for A and B?")
        self.wait(2)

        self.mark("partial-response")
        self.cue("With partial batch response, acknowledge A and B and return only C as failed.")
        self.play(FadeOut(arrows), FadeOut(replay), FadeOut(db_ok), FadeOut(db_fail), run_time=.5)
        self.change_note(note, "Partial response: acknowledge A and B; report only C for retry.")
        accepted = self.record("A, B deleted", -1.9, .3, INVOKE, width=2.8)
        failed = self.record("C remains", 1.65, .3, PRESSURE, width=2.2)
        arrow = Arrow([-.35, .3, 0], [1.45, .3, 0], color=PRESSURE, stroke_width=3, buff=.08)
        self.play(FadeIn(accepted), FadeIn(failed), Create(arrow), run_time=.8)
        self.wait(1)

        self.mark("visibility")
        self.cue("If C is not deleted before visibility expires, it can be received again; duplicates remain possible.")
        self.change_note(note, "Visibility expiry permits redelivery. It does not provide exactly-once processing.")
        self.play(FadeOut(failed), FadeOut(arrow), run_time=.5)
        c_again = self.record("C again", 2.4, 1.45, PRESSURE, width=1.7)
        self.play(FadeIn(c_again), run_time=.6)
        self.wait(1)

        self.mark("idempotency")
        self.cue("Use atomic idempotency for side effects, set visibility from timeout guidance, and route poison records to a DLQ.")
        self.change_note(note, "Correctness: atomic idempotency + partial failures + bounded retry + DLQ.")
        invariant = Text("same message key → one durable business effect", font_size=21, color=INK).move_to([.5, -1.0, 0])
        config = Text("visibility ≥ current AWS guidance • monitor age and DLQ", font_size=17, color=INITIALIZE).move_to([.5, -1.6, 0])
        self.play(FadeIn(invariant), FadeIn(config), run_time=.8)
        self.wait(2)

        self.mark("end")
        output = Path(os.environ.get("ANIMATION_TIMING_FILE", Path(__file__).resolve().parents[1] / "build" / "sqs-redelivery-timing.json"))
        output.parent.mkdir(exist_ok=True)
        output.write_text(json.dumps({"marks":self.marks,"cues":self.cues}, indent=2))

    def record(self, label, x, y, color, width=.82):
        rect = Rectangle(width=width, height=.48, color=color, fill_color=color, fill_opacity=.18, stroke_width=2).move_to([x,y,0])
        return VGroup(rect, Text(label, font_size=14, color=INK).move_to(rect))

    def bar(self, x, y, width, label, color):
        rect = Rectangle(width=width, height=.28, color=color, fill_color=color, fill_opacity=.25, stroke_width=1).move_to([x,y,0])
        return VGroup(rect, Text(label, font_size=12, color=INK).move_to(rect))

    def note(self, text):
        panel = Rectangle(width=12.4, height=.62, color=GRID, fill_color=PANEL, fill_opacity=1, stroke_width=1).move_to([0,-3.15,0])
        content = Text(text, font_size=18, color=INK).move_to(panel)
        group = VGroup(panel, content)
        self.play(FadeIn(group), run_time=.3)
        return group

    def change_note(self, current, text):
        fresh = Text(text, font_size=18, color=INK).move_to(current[0])
        self.play(FadeOut(current[1]), FadeIn(fresh), run_time=.4)
        current.remove(current[1]); current.add(fresh)

    def mark(self, name):
        self.marks[name] = round(self.renderer.time, 3)

    def cue(self, text):
        self.cues.append({"start":round(self.renderer.time,3),"text":text})
