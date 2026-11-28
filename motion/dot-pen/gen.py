"""메모칸 -> 본체 도트 매트릭스 펜 스트로크 모션 생성기.

메모칸(639x252)과 본체(639x750)를 하나의 연속 캔버스(639x1002)로 보고
도트 그리드 위에 붓 획을 하프톤으로 그린 뒤, 프레임을 두 화면으로 잘라 저장한다.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

W, MEMO_H, BODY_H = 639, 252, 750
H = MEMO_H + BODY_H
PITCH = 12                     # 도트 간격 (252, 639 모두 9의 배수 -> 이음새에서 그리드가 딱 맞음)
MAX_R = PITCH * 0.47           # 최대 도트 반지름
BASE_R = 0.9                  # 꺼진 도트(매트릭스 바탕) 반지름
BASE_GRAY = 52                 # 꺼진 도트 밝기
SS = 3                         # 슈퍼샘플링 배율
FPS = 30
DUR = 4.2
N = int(FPS * DUR)

# 본체 중간 텍스트 영역 보호: 본체 기준 y=230 부터 서서히, y=280 이후 완전히 꺼짐
LIMIT_SOFT = MEMO_H + 210
LIMIT_HARD = MEMO_H + 270

out_dir = sys.argv[1] if len(sys.argv) > 1 else "frames"
os.makedirs(out_dir, exist_ok=True)

# ---------- 그리드 ----------
cols = np.arange((W % PITCH) / 2 + PITCH / 2, W, PITCH)
rows = np.arange(PITCH / 2, H, PITCH)
GX, GY = np.meshgrid(cols, rows)
gx, gy = GX.ravel(), GY.ravel()


# ---------- 값 노이즈 (유기적인 붓 질감) ----------
rng = np.random.default_rng(7)
_lat = rng.random((40, 40))


def vnoise(x, y):
    xi, yi = np.floor(x).astype(int) % 39, np.floor(y).astype(int) % 39
    xf, yf = x - np.floor(x), y - np.floor(y)
    u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    a, b = _lat[yi, xi], _lat[yi, xi + 1]
    c, d = _lat[yi + 1, xi], _lat[yi + 1, xi + 1]
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v


# ---------- 펜 경로 ----------
# 메모칸 위쪽 밖에서 시작해 S자로 흔들리며 본체 상단까지 내려온다.
S = np.linspace(0, 1, 520)
path_y = -30 + S * (MEMO_H + 205 + 30)
path_x = (W * 0.5
          + 120 * np.sin(S * math.pi * 1.6 + 0.4)
          + 26 * np.sin(S * math.pi * 5.0 + 1.3))
# 붓 압력: 시작은 가늘게, 가운데 두껍게, 끝은 펜촉처럼 살짝 좁게
pressure = (np.clip(S / 0.12, 0, 1) ** 0.7
            * (0.78 + 0.22 * np.sin(S * math.pi * 3.1 + 0.6))
            * (1 - 0.35 * np.clip((S - 0.82) / 0.18, 0, 1)))
radius = 44 + 62 * pressure


def ease_io(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def ease_out(t):
    t = np.clip(t, 0, 1)
    return 1 - (1 - t) ** 3


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def field(t):
    """시간 t(초)에서 각 도트의 밝기 0..1."""
    # 0.25~2.45s: 펜이 그려 내려옴 / 2.35~3.35s: 꼬리가 따라 내려가 본체로 흡수 / 3.3~3.9s: 소멸
    head = ease_io((t - 0.25) / 2.2)
    tail = ease_io((t - 2.35) / 1.0) * 0.93
    fade = 1 - smooth(3.3, 3.9, t)
    if head <= 0 or fade <= 0:
        return np.zeros_like(gx)

    lo, hi = np.searchsorted(S, tail), max(np.searchsorted(S, head), 1)
    idx = np.arange(lo, hi, 2)
    if idx.size == 0:
        idx = np.array([hi - 1])
    px, py, pr = path_x[idx], path_y[idx], radius[idx].copy()

    # 꼬리 쪽은 빠르게 가늘어짐(잉크가 빠져나가는 느낌)
    local = (S[idx] - tail) / max(head - tail, 1e-3)
    pr *= 0.35 + 0.65 * smooth(0.0, 0.35, local)

    d = np.hypot(gx[:, None] - px[None, :], gy[:, None] - py[None, :])
    v = np.clip(1 - d / pr[None, :], 0, 1).max(axis=1)
    v = v ** 0.65

    # 펜촉 하이라이트
    hx, hy = np.interp(head, S, path_x), np.interp(head, S, path_y)
    tip = np.clip(1 - np.hypot(gx - hx, gy - hy) / 52, 0, 1) ** 1.3
    drawing = 1 - smooth(2.3, 2.6, t)
    v = np.maximum(v, tip * drawing)

    # 붓 질감
    n = vnoise(gx / 38 + t * 0.35, gy / 38)
    v *= 0.72 + 0.38 * n

    # 본체 텍스트 영역 보호
    v *= 1 - smooth(LIMIT_SOFT, LIMIT_HARD, gy)
    # 끝날 때 펜 도착 지점에서 한 번 맥동
    pulse = math.exp(-((t - 3.35) / 0.18) ** 2) * 0.25
    v = np.clip(v * fade * (1 + pulse), 0, 1)
    return v


def render(v):
    img = Image.new("L", (W * SS, H * SS), 0)
    dr = ImageDraw.Draw(img)
    r = BASE_R + (MAX_R - BASE_R) * v
    col = (BASE_GRAY + (255 - BASE_GRAY) * np.clip(v * 2.2, 0, 1)).astype(int)
    for x, y, rr, c in zip(gx, gy, r, col):
        rr *= SS
        cx, cy = x * SS, y * SS
        dr.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=int(c))
    return img.resize((W, H), Image.LANCZOS)


for i in range(N):
    frame = render(field(i / FPS))
    frame.crop((0, 0, W, MEMO_H)).save(f"{out_dir}/memo_{i:04d}.png")
    frame.crop((0, MEMO_H, W, H)).save(f"{out_dir}/body_{i:04d}.png")
    # 확인용: 두 화면 사이에 실제 이음새(틈)를 넣은 미리보기
    prev = Image.new("L", (W, H + 14), 22)
    prev.paste(frame.crop((0, 0, W, MEMO_H)), (0, 0))
    prev.paste(frame.crop((0, MEMO_H, W, H)), (0, MEMO_H + 14))
    prev.save(f"{out_dir}/prev_{i:04d}.png")
print("frames:", N)
