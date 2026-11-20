# 캐릭터 모션그래픽

세로 쇼츠용 캐릭터 소개 모션그래픽 (1080×1920, 30fps, 12초).

| 영상 | 캐릭터 | 상징 / 오프닝 |
|---|---|---|
| `output/nea_motion.mp4` | 네아 · 에피소드 2 - 아침이 오지 않는 설국 | 서리덩굴이 모여 눈꽃이 되는 오프닝 |
| `output/anelia_motion.mp4` | 아넬리아 · 에피소드 3 - 마법은 숨겨지지 않아! | 파란 수국이 피어나고 마법진이 그려지는 오프닝 |

## 구성

- `src/` 네아, `src_an/` 아넬리아
  - `prep.py` 업스케일 이미지와 누끼로 작업용 스프라이트와 머리카락·옷 흔들림 가중치 맵 생성
  - `lib.py` 캐릭터 변형(머리카락·소매·코트 흔들림, 호흡), 배경, 파티클
  - `opening.py` 오프닝 그래픽 (전부 코드로 그리는 벡터)
  - `render.py` 장면 구성, 타이틀, 최종 MP4 출력
  - `src/upscale.py` Real-ESRGAN anime 6B 4배 업스케일
- `cut/nea_clean.png`, `an/clean.png` 배경을 지운 캐릭터 이미지
- `figma/symbol_3x.png` Figma 캐릭터심볼 (네아 렌더러에서 불러옴)
- `fonts/` Cinzel(영문 타이틀), SUITE(한글) — 둘 다 SIL OFL 라이선스

## 다시 렌더링하기

```bash
pip install numpy scipy opencv-python-headless pillow torch rembg
```

1. 업스케일 (모델: [RealESRGAN_x4plus_anime_6B.pth](https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth)을 `models/`에 저장)

```bash
python3 src/upscale.py models/RealESRGAN_x4plus_anime_6B.pth <원본 이미지> cut/nea_x4.png
```

아넬리아는 출력 경로를 `an/x4.png`로 지정합니다.

2. 스프라이트와 가중치 맵 생성

```bash
python3 src/prep.py
```

3. 렌더링 (`output/`에 MP4 생성, 약 10분)

```bash
python3 src/render.py
```

특정 프레임만 미리보기: `python3 src/render.py 120 300` → `output/pv_120.png` …
