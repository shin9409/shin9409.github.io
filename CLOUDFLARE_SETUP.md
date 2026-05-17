# Cloudflare 운영 설정

이 저장소는 정적 페이지를 유지하면서 Cloudflare Pages Functions, D1, R2를 붙이는 구조입니다.

## 1. Cloudflare 리소스 생성

1. Cloudflare Pages 프로젝트를 GitHub 저장소에 연결합니다.
2. R2 bucket을 `lookupmedia-assets` 이름으로 생성합니다.
3. D1 database를 `lookupmedia-db` 이름으로 생성합니다.
4. `wrangler.toml`의 `database_id`를 실제 D1 database id로 교체합니다.

## 2. 바인딩과 Secret

Pages 프로젝트 설정에서 아래 바인딩을 추가합니다.

- D1 binding: `DB` -> `lookupmedia-db`
- R2 binding: `MEDIA` -> `lookupmedia-assets`
- Environment variable optional: `ASSETS_PUBLIC_URL` -> 공개 R2 커스텀 도메인
- Secret: `ADMIN_PASSWORD` -> 관리자 로그인 비밀번호
- Secret: `ADMIN_SESSION_SECRET` -> 긴 랜덤 문자열

## 3. D1 초기화

Cloudflare 대시보드 또는 Wrangler로 아래 SQL을 순서대로 적용합니다.

```sh
wrangler d1 execute lookupmedia-db --file=migrations/0001_schema.sql
wrangler d1 execute lookupmedia-db --file=migrations/0002_seed.sql
```

현재 seed는 `js/data.js`에서 생성됩니다. 데이터가 바뀐 뒤 다시 만들려면:

```sh
node scripts/generate-d1-seed.mjs
```

## 4. 이미지 이전 전략

초기 seed는 기존 GitHub 이미지 경로를 그대로 보존합니다. 새로 추가하거나 교체하는 이미지만 관리자 화면에서 WebP로 최적화되어 R2에 올라갑니다.

기존 이미지까지 모두 R2로 옮긴 뒤에는 GitHub 저장소의 `images/works`를 별도 정리하면 됩니다.
