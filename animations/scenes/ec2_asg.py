"""Illustrates desired capacity versus healthy capacity and N-1 validation."""
import json
import os
from pathlib import Path

from manim import Create, FadeIn, FadeOut, Line, Rectangle, Scene, Text, VGroup, Write, DOWN, UP
from theme import BACKGROUND, GRID, INITIALIZE, INK, INVOKE, MUTED, PANEL, PRESSURE, REQUEST, apply_theme

apply_theme()


class Ec2AutoScaling(Scene):
    def construct(self):
        self.marks={}; self.cues=[]
        self.mark("opening")
        title=Text("Auto Scaling: desired is not healthy capacity",font_size=31,color=INK).to_edge(UP,buff=.3)
        subtitle=Text("Illustrative target tracking • startup and health delay are workload-specific",font_size=17,color=MUTED).next_to(title,DOWN,buff=.12)
        self.play(Write(title),FadeIn(subtitle),run_time=1)
        rows=[("Request demand",1.55),("ASG desired",.48),("Launching",-.62),("ALB healthy",-1.72),("AZ capacity",-2.75)]
        grid=VGroup()
        for label,y in rows:
            grid.add(Text(label,font_size=16,color=MUTED).move_to([-5.55,y,0]))
            grid.add(Line([-4.8,y-.32,0],[5.8,y-.32,0],color=GRID,stroke_width=1))
        self.play(Create(grid),run_time=.8)
        note=self.note("Assumption: one healthy instance serves 100 RPS at the chosen target; capacity must be measured.")

        self.mark("baseline")
        self.cue("At 800 requests per second, the planning model needs eight healthy instances.")
        demand=self.label("800 RPS",-3.7,1.55,REQUEST)
        desired=self.label("desired 8",-3.7,.48,INITIALIZE)
        healthy=self.capacity(8,-3.6,-1.72,INVOKE)
        zones=self.zones(4,4)
        self.play(FadeIn(demand),FadeIn(desired),FadeIn(healthy),FadeIn(zones),run_time=.8)
        self.wait(1)

        self.mark("demand-rise")
        self.cue("Demand doubles. Target tracking changes desired capacity from eight to sixteen, based on the selected metric.")
        self.change_note(note,"Controller updates desired capacity; this does not create sixteen ready targets instantly.")
        self.play(FadeOut(demand),FadeOut(desired),FadeOut(healthy),FadeOut(zones),run_time=.5)
        demand2=self.label("1,600 RPS",-3.6,1.55,PRESSURE)
        desired2=self.label("desired 16",-3.6,.48,INITIALIZE)
        self.play(FadeIn(demand2),FadeIn(desired2),run_time=.7)
        self.wait(.8)
        self.mark("predict-ramp")
        self.change_note(note,"Predict: does desired capacity mean ALB can route to sixteen healthy instances now?")
        self.wait(2)

        self.mark("launch")
        self.cue("Eight new instances are pending. They must launch, boot, initialize the app, register, and pass health checks.")
        self.change_note(note,"Pending → boot → application ready → target registered → healthy. Measure each delay.")
        pending=self.capacity(8,-3.5,-.62,INITIALIZE)
        baseHealthy=self.capacity(8,-3.5,-1.72,INVOKE)
        self.play(FadeIn(pending),FadeIn(baseHealthy),run_time=.7)
        self.wait(1)
        self.mark("predict-warmup")
        self.change_note(note,"Predict: which timer protects scaling metrics from startup noise?")
        self.wait(2)

        self.mark("healthy")
        self.cue("After the measured startup interval, the new targets become healthy and can serve traffic.")
        self.change_note(note,"Default instance warmup shapes scaling feedback; health grace period governs replacement decisions.")
        self.play(FadeOut(pending),FadeOut(baseHealthy),run_time=.4)
        allhealthy=self.capacity(16,-3.5,-1.72,INVOKE)
        zones16=self.zones(8,8)
        self.play(FadeIn(allhealthy),FadeIn(zones16),run_time=.8)
        self.wait(1)

        self.mark("az-loss")
        self.cue("An Availability Zone fails. If eight instances were in that zone, only eight remain for 1,600 requests per second.")
        self.change_note(note,"N-1 check: eight survivors × 100 RPS = 800 RPS. Demand is still 1,600 RPS.")
        self.play(FadeOut(zones16),FadeOut(allhealthy),run_time=.5)
        survivors=self.capacity(8,-3.5,-1.72,PRESSURE)
        az=self.zones(8,0,failed=True)
        self.play(FadeIn(survivors),FadeIn(az),run_time=.8)
        self.wait(1)
        self.mark("predict-n1")
        self.change_note(note,"Predict: what capacity and admission policy make AZ loss survivable?")
        self.wait(2)

        self.mark("defense")
        self.cue("Provision enough capacity per surviving AZ, or buffer and degrade work with an explicit latency contract.")
        self.play(*[FadeOut(item) for item in list(self.mobjects)],run_time=.6)
        final=VGroup(
            Text("Desired capacity is an intent, not a ready target",font_size=27,color=INK),
            Text("Scale delay: launch + boot + app readiness + ALB health",font_size=20,color=INITIALIZE),
            Text("N-1: surviving AZ capacity ≥ peak demand + headroom",font_size=21,color=INVOKE),
            Text("Measure warmup • protect dependencies • test AZ failure",font_size=18,color=PRESSURE),
        ).arrange(DOWN,buff=.42).move_to([0,0,0])
        self.play(FadeIn(final),run_time=.8); self.wait(2)
        self.mark("end")
        output=Path(os.environ.get("ANIMATION_TIMING_FILE",Path(__file__).resolve().parents[1]/"build"/"ec2-asg-timing.json"))
        output.parent.mkdir(exist_ok=True); output.write_text(json.dumps({"marks":self.marks,"cues":self.cues},indent=2))

    def label(self,text,x,y,color):
        rect=Rectangle(width=2.5,height=.52,color=color,fill_color=color,fill_opacity=.15,stroke_width=2).move_to([x,y,0])
        return VGroup(rect,Text(text,font_size=16,color=INK).move_to(rect))

    def capacity(self,count,x,y,color):
        each=2 if count==16 else 1
        boxes=[]
        for i in range(8):
            rect=Rectangle(width=.52,height=.42,color=color,fill_color=color,fill_opacity=.18,stroke_width=2).move_to([x+i*.64,y,0])
            boxes.append(VGroup(rect,Text(str(each),font_size=14,color=INK).move_to(rect)))
        total=Text(f"{count} {'pending' if color==INITIALIZE else 'healthy'}",font_size=15,color=color).move_to([3.35,y,0])
        return VGroup(*boxes,total)

    def zones(self,a,b,failed=False):
        left=VGroup(Text(f"AZ A · {a} healthy",font_size=17,color=INVOKE).move_to([-1.6,-2.75,0]),Text(f"AZ B · {b} healthy" if not failed else "AZ B · unavailable",font_size=17,color=INVOKE if not failed else PRESSURE).move_to([2.2,-2.75,0]))
        return left

    def note(self,text):
        panel=Rectangle(width=12.4,height=.62,color=GRID,fill_color=PANEL,fill_opacity=1,stroke_width=1).move_to([0,-3.55,0])
        content=Text(text,font_size=16,color=INK).move_to(panel); group=VGroup(panel,content)
        self.play(FadeIn(group),run_time=.3); return group

    def change_note(self,current,text):
        fresh=Text(text,font_size=16,color=INK).move_to(current[0]); self.play(FadeOut(current[1]),FadeIn(fresh),run_time=.4); current.remove(current[1]);current.add(fresh)
    def mark(self,name): self.marks[name]=round(self.renderer.time,3)
    def cue(self,text): self.cues.append({"start":round(self.renderer.time,3),"text":text})
