# Cloudflare 배포

Crime City는 사용자 본인의 Cloudflare 계정에 Workers + D1으로 배포한다.

## 구성

- Worker 이름: `worker` (Cloudflare Git 연동에서 만들어진 이름)
- D1 데이터베이스: `crime-city-db`, 지역 APAC. id는 `cloudflare.deploy.json`에 기록한다(비밀 아님).
- 배포 방식: Cloudflare Workers Builds가 GitHub 저장소 `kygywnd4135-cmd/-`의 production branch에 푸시될 때마다 자동으로 빌드·배포한다.

Workers Builds 설정:

| 항목 | 값 |
| --- | --- |
| Production branch | `claude/kind-bohr-52aycv` |
| Root directory | `crime-city` |
| Build command | `npm ci && npm run build` |
| Deploy command | `node scripts/deploy-cloudflare.mjs ci` |
| Variables | `NODE_VERSION=24` |

## 스키마 변경

Workers Builds의 deploy 단계는 마이그레이션을 적용하지 않는다. `drizzle/`에 새 SQL을 추가했으면 D1 권한이 있는 API 토큰으로 먼저 적용한다.

```sh
node scripts/deploy-cloudflare.mjs migrate
```

이전 버전 코드가 새 컬럼을 몰라도 동작하도록, 마이그레이션은 코드 푸시보다 먼저 적용한다.

## 수동 배포

`node scripts/deploy-cloudflare.mjs deploy`는 빌드, 마이그레이션, 배포를 한 번에 한다. 정적 파일 업로드가 Authorization 헤더를 바꾸는 프록시 뒤에서는 실패하므로, 그런 환경에서는 Git 연동을 사용한다.

## 데이터

배포된 D1은 로컬 개발 DB와 별개다. 로컬 계정·채팅·사진은 자동으로 옮겨지지 않는다.
