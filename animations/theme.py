"""Reusable visual language for mechanism-first teaching scenes."""
from manim import BLACK, BLUE, GREEN, ORANGE, RED, WHITE, config

BACKGROUND = "#0C1724"
PANEL = "#17283A"
MUTED = "#9FB3C8"
GRID = "#41566A"
REQUEST = BLUE
INITIALIZE = ORANGE
INVOKE = GREEN
PRESSURE = RED
INK = WHITE


def apply_theme():
    config.background_color = BACKGROUND
    config.frame_width = 14.22
    config.frame_height = 8
