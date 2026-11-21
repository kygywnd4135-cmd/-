# 캐릭터 모션그래픽

세로 쇼츠용 캐릭터 소개 모션그래픽 (1080×1920, 30fps, 12초).

| 영상 | 캐릭터 | 상징 / 오프닝 |
|---|---|---|
| `output/nea_motion.mp4` | 네아 · 에피소드 2 - 아침이 오지 않는 설국 | 서리덩굴이 모여 눈꽃이 되는 오프닝 |
| `output/anelia_motion.mp4` | 아넬리아 · 에피소드 3 - 마법은 숨겨지지 않아! | 파란 수국이 피어나고 마법진이 그려지는 오프닝 |
| `output/jin_motion.mp4` | 진 · 에피소드 1 - 죽음의 도시와 괴도 | 막이 열리고 하얀 스텐실 장미가 피며 가시덩굴이 뻗는 오프닝 |
| `output/ramune_motion.mp4` | 라무네 · 에피소드 4 - 리듬으로 돌아가줘! | 글리치와 비트 속 기타 엠블럼 카드가 뒤집히며 실루엣 카드가 나오는 오프닝 |
| `output/sonyu_motion.mp4` | 손유 · 에피소드 5 - 죽음을 먹고 괴물이 되어라 | 수풀을 지나 붉은 달 아래 대나무숲이 베여 으스러지는 오프닝 |

## 구성

- `src/` 네아, `src_an/` 아넬리아, `src_jn/` 진, `src_rm/` 라무네, `src_sy/` 손유 (`fx.py`는 공용 그리기 도구)
  - `prep.py` 업스케일 이미지와 누끼로 작업용 스프라이트와 머리카락·옷 흔들림 가중치 맵 생성
  - `lib.py` 캐릭터 변형(머리카락·소매·코트 흔들림, 호흡), 배경, 파티클
  - `opening.py` 오프닝 그래픽 (전부 코드로 그리는 벡터)
  - `render.py` 장면 구성, 타이틀, 최종 MP4 출력
  - `src/upscale.py` Real-ESRGAN anime 6B 4배 업스케일
- `cut/nea_clean.png`, `an/clean.png`, `jn/clean.png`, `rm/clean.png`, `sy/clean.png` 배경을 지운 캐릭터 이미지
- `figma/symbol_3x.png` Figma 캐릭터심볼 (네아 렌더러에서 불러옴)
- `fonts/` Cinzel·Bungee(영문 타이틀), SUITE(한글) — 둘 다 SIL OFL 라이선스

## 다시 렌더링하기

```bash
pip install numpy scipy opencv-python-headless pillow torch rembg
```

1. 업스케일 (모델: [RealESRGAN_x4plus_anime_6B.pth](https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth)을 `models/`에 저장)

```bash
python3 src/upscale.py models/RealESRGAN_x4plus_anime_6B.pth <원본 이미지> cut/nea_x4.png
```

아넬리아는 `an/x4.png`, 진은 `jn/x4.png`, 라무네는 `rm/x4.png`, 손유는 `sy/x4.png`로 출력 경로를 지정하고, 이후 단계도 `src_an/`, `src_jn/`, `src_rm/`, `src_sy/`의 같은 스크립트를 씁니다.

2. 스프라이트와 가중치 맵 생성

```bash
python3 src/prep.py
```

3. 렌더링 (`output/`에 MP4 생성, 약 10분)

```bash
python3 src/render.py
```

특정 프레임만 미리보기: `python3 src/render.py 120 300` → `output/pv_120.png` …

## 음악 붙이기

Suno로 만든 곡은 `music/<이름>_suno.mp3`에 두고, 12초로 잘라 끝을 잔향으로 자연스럽게 마무리한 뒤 영상에 붙입니다.

```bash
python3 src_audio/fit_music.py music/jin_suno.mp3 music/jin_12s.wav 0.1
```

곡 중간에서 시작할 때는 여섯 번째 인자로 페이드인 길이를 줍니다: `fit_music.py <곡> <출력> <시작> 12 9.4 0.6`

```bash
ffmpeg -i <무음 영상> -i music/jin_12s.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -af loudnorm=I=-15:TP=-1.0 -shortest output/jin_motion.mp4
```

세 번째 인자는 곡에서 잘라 쓸 시작 위치(초)입니다. 곡의 분위기 전환이 캐릭터 등장(약 4초)에 맞도록 고릅니다.

| 캐릭터 | 음악 | 시작 위치 |
|---|---|---|
| 진 | `music/jin_suno.mp3` → `music/jin_12s.m4a` | 0.1초 |
| 네아 | `music/nea_suno.mp3` (Frost Waltz) → `music/nea_12s.m4a` | 4.32초, 페이드인 0.6초 |
| 아넬리아 | `music/anelia_suno.mp3` (The Witch's Sparkle) → `music/anelia_12s.m4a` | 2.44초, 페이드인 0.35초 |
| 라무네 | `music/ramune_suno.mp3` (Boss Battle) → `music/ramune_12s.m4a` | 2.57초, 페이드인 0.3초 |
| 손유 | `music/sonyu_suno.mp3` (Shadow of the Blade) → `music/sonyu_12s.m4a` | 7.91초, 페이드인 0.3초 |

## 가챠 배너 선택 모션 (테스트)

`output/gacha_ep02_test.mp4` — Figma 「가챠 배너2」(1920×1080) 요소로 만든 EP.02 배너 선택 모션 테스트(4.6초).
UI 판은 고정하고 뒤쪽만 움직입니다: 글리치 → 휘장 세 조각 조립 → 실루엣 → 글리치 → 원화 → 타이틀·이름표.

- `gacha/assets/` Figma에서 내보낸 배경 판, UI 판, 타이틀, 이름표, 캐릭터(아린·코유키는 축소본), 휘장
- `src_gacha/render.py` 렌더러 (네아는 `cut/sprite2x.npy` 고화질 스프라이트를 Figma 배치에 맞춰 사용 → 먼저 `python3 src/prep.py`)
