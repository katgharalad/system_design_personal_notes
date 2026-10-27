"""A standard on-demand Lambda Event Function. Times are narrative, not service latency."""
import json
import os
from pathlib import Path

from manim import (
    Arrow, Circle, Create, FadeIn, FadeOut, Line, Rectangle, Scene, Text,
    VGroup, Write, DOWN, LEFT, RIGHT, UP,
)

from theme import BACKGROUND, GRID, INITIALIZE, INK, INVOKE, MUTED, PANEL, PRESSURE, REQUEST, apply_theme

apply_theme()


class LambdaLifecycle(Scene):
    def construct(self):
        self.marks = {}
        self.cues = []
        self.mark("opening")
        title = Text("Lambda: one active invoke per environment", font_size=34, color=INK).to_edge(UP, buff=.32)
        subtitle = Text("Standard on-demand Event Function  •  conceptual timeline", font_size=18, color=MUTED).next_to(title, DOWN, buff=.12)
        self.play(Write(title), FadeIn(subtitle), run_time=1.5)

        x0, x1 = -4.45, 5.85
        rows = [("Requests", 1.55), ("Environment A", .35), ("Environment B", -.85), ("Database", -2.05)]
        grid = VGroup()
        for name, y in rows:
            grid.add(Line([x0, y-.38, 0], [x1, y-.38, 0], color=GRID, stroke_width=1))
            grid.add(Text(name, font_size=17, color=MUTED).move_to([-5.55, y, 0]))
        self.play(Create(grid), run_time=1.0)
        note = self.note("First request arrives. No ready environment exists in this example.")
        self.cue("First request arrives. In this example, Lambda has no ready environment.")
        req1 = self.token("1", -4.0, 1.55)
        self.play(FadeIn(req1), run_time=.5)
        self.wait(1.0)

        self.mark("init")
        self.cue("Lambda creates environment A. Runtime and code outside the handler initialize before Invoke.")
        self.change_note(note, "New environment: setup + runtime + code outside handler = Init")
        init_a = self.block(-3.45, .35, 2.0, "INIT A", INITIALIZE)
        arrow1 = Arrow([-4.0, 1.2, 0], [-3.35, .72, 0], color=REQUEST, stroke_width=3, buff=.05)
        self.play(Create(arrow1), FadeIn(init_a), run_time=1.3)
        self.wait(2.0)
        self.mark("predict-handler")
        self.change_note(note, "Predict: does handler code run before Init completes?")
        self.wait(2.0)

        self.mark("first-invoke")
        self.cue("After Init, the handler processes request one. Init adds latency to this cold invocation.")
        self.change_note(note, "Init completes → handler handles request 1")
        invoke_a1 = self.block(-1.35, .35, 1.45, "INVOKE 1", INVOKE)
        self.play(FadeIn(invoke_a1), run_time=.9)
        self.wait(1.2)
        done1 = self.small("response 1", .1, 1.55, INVOKE)
        self.play(FadeIn(done1), run_time=.5)
        self.change_note(note, "After Invoke, environment A may be kept for reuse; it is not durable storage.")
        idle_a = self.block(.25, .35, 1.2, "idle", GRID)
        self.play(FadeIn(idle_a), run_time=.8)
        self.wait(1.5)

        self.mark("reuse")
        self.cue("A later request can reuse idle environment A. Static initialization does not repeat on this warm path.")
        req2 = self.token("2", 1.55, 1.55)
        self.play(FadeIn(req2), run_time=.5)
        self.change_note(note, "Environment A is idle. It can be reused, but reuse is not guaranteed.")
        self.wait(1.3)
        self.mark("predict-reuse")
        self.change_note(note, "Predict: if A is reused, must its Init code run again?")
        self.wait(2.0)
        self.mark("warm-invoke")
        self.cue("Request two reuses A in this example. Handler runs without another Init phase.")
        self.change_note(note, "Warm path: Invoke 2 starts in A; no new Init in this example.")
        warm = self.block(1.6, .35, 1.5, "INVOKE 2", INVOKE)
        self.play(FadeIn(warm), run_time=.9)
        self.wait(1.3)

        self.mark("overlap")
        self.cue("Request three overlaps request two. A is busy, so Lambda needs another environment for this on-demand Event Function.")
        req3 = self.token("3", 2.25, 1.55)
        self.play(FadeIn(req3), run_time=.5)
        self.change_note(note, "A is busy. Concurrent request 3 cannot use A at the same time.")
        self.wait(1.3)
        self.mark("predict-concurrency")
        self.change_note(note, "Predict: which environment can process request 3?")
        self.wait(2.0)
        self.mark("second-environment")
        self.cue("Lambda creates environment B. B has its own Init phase, then handles request three.")
        init_b = self.block(2.45, -.85, 1.1, "INIT B", INITIALIZE)
        invoke_b = self.block(3.65, -.85, 1.35, "INVOKE 3", INVOKE)
        self.change_note(note, "B starts: its Init is separate. Peak active invocations = 2.")
        self.play(FadeIn(init_b), run_time=.8)
        self.play(FadeIn(invoke_b), run_time=.8)
        self.wait(1.4)

        self.mark("database")
        self.cue("If each environment opens a database connection, more environments can increase connection demand.")
        db = self.block(3.25, -2.05, 1.75, "2 connections", PRESSURE)
        a_db = Arrow([2.45, -.05, 0], [3.75, -1.72, 0], color=PRESSURE, stroke_width=2, buff=.05)
        b_db = Arrow([4.3, -1.27, 0], [4.25, -1.72, 0], color=PRESSURE, stroke_width=2, buff=.05)
        self.change_note(note, "Compute concurrency and database capacity are separate limits.")
        self.play(Create(a_db), Create(b_db), FadeIn(db), run_time=1.2)
        self.wait(1.3)
        self.mark("predict-capacity")
        self.change_note(note, "Predict: what fails if the database has no free connections?")
        self.wait(2.0)

        self.mark("defense")
        self.cue("Defend a limit: bound concurrency, pool connections where suitable, and measure throttles and database saturation.")
        self.change_note(note, "Defend: cap demand, pool where useful, test tail latency and retries.")
        self.wait(1.7)
        self.mark("shutdown")
        self.cue("Lambda eventually shuts environments down. Do not store durable application state only in process memory or temporary files.")
        self.play(*[FadeOut(item) for item in list(self.mobjects)], run_time=.7)
        finish_title = Text("Eventually: Shutdown", font_size=38, color=INK).move_to([0, 1.2, 0])
        phases = Text("Init  →  Invoke  →  possible reuse  →  Shutdown", font_size=25, color=INITIALIZE).move_to([0, .2, 0])
        warning = Text("Environment lifetime is not an application contract.", font_size=23, color=INK).move_to([0, -1.0, 0])
        self.play(FadeIn(finish_title), FadeIn(phases), FadeIn(warning), run_time=1.0)
        self.wait(3.0)
        self.mark("end")
        output = Path(os.environ.get("ANIMATION_TIMING_FILE", Path(__file__).resolve().parents[1] / "build" / "lambda-timing.json"))
        output.parent.mkdir(exist_ok=True)
        output.write_text(json.dumps({"marks": self.marks, "cues": self.cues}, indent=2))

    def mark(self, name):
        self.marks[name] = round(self.renderer.time, 3)

    def cue(self, text):
        self.cues.append({"start": round(self.renderer.time, 3), "text": text})

    def block(self, x, y, width, label, color):
        rect = Rectangle(width=width, height=.58, color=color, fill_color=color, fill_opacity=.18, stroke_width=2).move_to([x+width/2, y, 0])
        txt = Text(label, font_size=15, color=INK).move_to(rect)
        return VGroup(rect, txt)

    def token(self, label, x, y):
        circle = Circle(radius=.25, color=REQUEST, fill_color=REQUEST, fill_opacity=1).move_to([x,y,0])
        return VGroup(circle, Text(label, font_size=19, color=BACKGROUND).move_to(circle))

    def small(self, label, x, y, color):
        return Text(label, font_size=15, color=color).move_to([x,y,0])

    def note(self, text):
        panel = Rectangle(width=12.4, height=.66, color=GRID, fill_color=PANEL, fill_opacity=1, stroke_width=1).move_to([0,-3.16,0])
        content = Text(text, font_size=19, color=INK).move_to(panel)
        group = VGroup(panel, content)
        self.play(FadeIn(group), run_time=.3)
        return group

    def change_note(self, current, text):
        fresh = Text(text, font_size=19, color=INK).move_to(current[0])
        self.play(FadeOut(current[1]), FadeIn(fresh), run_time=.4)
        current.remove(current[1]); current.add(fresh)
