# Claude에서 크라임 시티 이어가기

기준일: 2026-11-21 (한국 시간)

이 안내와 `crime-city-source-part-01-of-07.zip`부터 `crime-city-source-part-07-of-07.zip`은 프로젝트 코드와 제공된 디자인 참고자료만 옮긴다. 각 ZIP은 30MB보다 작다. 계정·암호·채팅·프로필 사진이 담긴 DB는 포함하지 않는다. 화면 스크린샷도 계정 정보가 보일 수 있어 이 묶음에서는 제외했다. 디자인 원본은 `docs/references/`에 있다.

## 가장 쉬운 방법: Claude Code

Claude Code는 선택한 컴퓨터 폴더 안의 파일을 읽고 고칠 수 있다. Claude 일반 채팅에 ZIP을 첨부하면 검토는 가능하지만, 이 PC의 프로젝트를 직접 수정하거나 서버를 실행하는 용도로는 Claude Code가 편하다.

1. `crime-city-source-part-01-of-07.zip`부터 `crime-city-source-part-07-of-07.zip`까지 모두 내려받는다.
2. 압축을 풀 폴더를 하나 만든다. 예: `C:\Users\User\Documents\CrimeCity`
3. 일곱 ZIP을 모두 같은 폴더에 차례로 압축 해제한다. 각 압축 안의 `crime-city` 폴더가 합쳐져 완성된다.
4. Node.js 24 LTS를 설치한다. 프로젝트는 Node.js 22.13 이상이 필요하다.
5. [Claude Code 빠른 시작](https://code.claude.com/docs/en/quickstart)의 현재 Windows 설치 안내를 따른다. PowerShell에서는 Claude 공식 설치 명령으로 설치한 뒤 새 PowerShell 창을 연다.
6. PowerShell에서 프로젝트 폴더로 이동해 `claude`를 실행한다.

```powershell
cd "C:\Users\User\Documents\CrimeCity\crime-city"
claude
```

Claude가 로그인 화면을 띄우면 본인의 Claude 계정으로 로그인한다. 프로젝트 루트에 있는 `CLAUDE.md`와 `AGENTS.md`가 작업 규칙을 알려주며, 첫 메시지에서 인수인계 문서를 읽어달라고 하면 된다.

## 사이트 미리보기

Claude Code와 별도의 PowerShell 창을 열고 프로젝트 폴더에서 아래를 한 번 실행한다.

```powershell
npm ci
npm run db:init
npm run dev
```

그다음 브라우저에서 `http://127.0.0.1:5173/`을 연다. 이 순서는 새로 만든 코드 묶음에서 빈 개발용 DB를 만드는 방법이다. 기존 실제 계정이 있던 DB를 가져오려는 경우 `db:init`을 실행하지 말고, 비공개 백업 절차를 별도로 확인한다.

## Claude에 처음 보낼 내용

```text
이 프로젝트는 크라임 시티 온라인 머더 미스터리 사이트입니다. 처음부터 다시 만들지 말고 현재 파일을 이어서 수정해 주세요. 우선 AGENTS.md, CLAUDE.md, docs/HANDOFF.md, docs/CLAUDE-CONTINUE.md를 읽고 현재 구현과 docs/references의 디자인 원본을 살펴봐 주세요. 특히 기존 레이아웃과 사용자 결정은 임의로 바꾸지 마세요. 준비 중 기능을 멋대로 완성하지 말고, 다음 수정 요청을 기다려 주세요. 실제 계정 데이터는 이 코드 묶음에 없으니 만들거나 복원하지 마세요.
```

## 꼭 기억할 점

- 이 소스 묶음은 기존 대화 기록이나 다른 AI 계정의 기억을 옮기지는 않는다. 핵심 결정과 실행 순서는 `docs/HANDOFF.md`에 정리되어 있다.
- `crime-city-private-data-2026-10-21.zip` 같은 비공개 DB 백업은 AI 채팅이나 코드 공유에 첨부하지 않는다. 암호 해시, 기존 계정, 채팅, 업로드 사진이 담겨 있다. 프로젝트 소스 ZIP과 다른 곳에 보관한다.
- GitHub는 필수가 아니다. Claude Code가 수정한 최신 폴더 자체가 작업본이다. 다른 PC에서도 이어갈 때는 최신 소스 ZIP을 다시 만들거나 본인 비공개 GitHub 저장소를 쓸 수 있다.
- 이미 저장된 2026-10-21 소스 ZIP은 오래된 백업이므로 사용하지 말고, 함께 제공한 2026-11-21 ZIP을 사용한다.
