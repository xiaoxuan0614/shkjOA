# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JeecgBoot Vue3 frontend — an enterprise low-code platform built with Vue 3 + Vite 8 + Ant Design Vue 4 + TypeScript. Uses pnpm as package manager. Node 18 or 20+ required (`engines: "^18 || >=20"`).

**Important context (recent refactor):** The following features have been **removed** from this codebase — do not re-add or reference them:
- Micro-frontend (qiankun) — `src/qiankun/`, `vite-plugin-qiankun`, qiankun env vars, related layout CSS
- Multi-tenant (租户) — `src/views/system/tenant/`, tenant pages (TenantDepartList/TenantPositionList/TenantRoleList/TenantSetting), tenant store state, `X-Tenant-Id` header injection, `getTenantId()`
- Third-party login — DingTalk/Feishu/CAS/OAuth2/QR-code login, `ThirdModal.vue`, `QrCodeForm.vue`, `OAuth2Login.vue`, `MiniCodelogin.vue`, `useThirdLogin.ts`, `useSso.ts`, `dingtalk-jsapi`
- AI chat — `src/views/dashboard/ai/`, Aide floating icon, AI_ROUTE, `aiIconShow` setting, `copyChat.ts` build script

WeChat Work (企业微信) **message-push capability is kept** (config UI under `src/views/system/appconfig/` + `src/components/jeecg/thirdApp/` sync components), but its **login** capability is removed.

## Common Commands

```bash
pnpm dev              # Dev server (port 3100) — proxies to real backend per .env.development (VITE_USE_MOCK=false)
pnpm mock             # Dev server (port 3100) with mock data — uses .env.mock (VITE_USE_MOCK=true)
pnpm build            # Production build (output: dist/)
pnpm build:report     # Build with bundle visualizer
pnpm preview          # Build + preview

# Linting (no unified "lint" script — run individually)
npx eslint src/path/to/file.vue          # Lint specific file
npx stylelint "src/**/*.{vue,less,css}"  # Stylelint
pnpm batch:prettier                       # Format all src files

pnpm clean:cache      # Clear Vite cache
pnpm gen:icon         # Regenerate icon data
```

### Mock vs Real Backend

`pnpm dev` and `pnpm mock` both run `vite`, differing only by env mode:
- **`pnpm mock`** → `vite --mode mock`, loads `.env.mock` (`VITE_USE_MOCK=true`). Mock routes live in `mock/`, served by `vite-plugin-mock`.
- **`pnpm dev`** → `vite` (development mode), loads `.env.development` (`VITE_USE_MOCK=false`). Requests proxy to the backend via `VITE_PROXY`.

Mock URL prefix notes (these are subtleties that matter):
- System mocks use `sysUrl = '/jeecgboot'` (matches axios `apiUrl`) — e.g. `/jeecgboot/sys/login`.
- Demo mocks use `baseUrl = '/jeecgboot/mock'` — e.g. `/jeecgboot/mock/system/getAccountList`.
- Mock helpers are underscore-prefixed (`mock/_util.ts`, `mock/_createProductionServer.ts`) and excluded from module scanning by `ignore: /^\_/`. Do not rename them back.
- The mock login decrypts AES-encrypted passwords (key/iv in `src/utils/cipher.ts`: `AES_KEY=1234567890adbcde`, `AES_IV=1234567890hjlkew`), so browser login works with mock data.

## Path Aliases

- `/@/` and `@/` → `src/`
- `/#/` and `#/` → `types/`
- `~icons/{collection}/{name}` → unplugin-icons (compile-time icon imports)

The `/@/` prefix (with leading slash) is the project's conventional alias — prefer it for consistency.

## Architecture

### Bootstrap Sequence (src/main.ts)

`createApp` → `createRouter` → `setupStore` (pinia) → `setupI18n` → `initAppConfigStore` → `registerPackages` (@jeecg/aiflow lazy) → `registerGlobComp` (Icon, AIcon, JUploadButton, Tinymce) → `setupRouter` → `setupRouterGuard` → `setupGlobDirectives` → `setupErrorHandle` → `registerThirdComp` (vxe-table, emoji, dayjs) → `router.isReady()` → `mount`

### Routing & Permissions

- **Permission mode: BACK** — routes and menus fetched from the backend via `getBackMenuAndPerms()` (`src/api/sys/menu.ts`)
- Dynamic routes added at runtime in `src/store/modules/permission.ts` (`buildRoutesAction`)
- Backend menu objects are converted to routes in `src/router/helper/routeHelper.ts` (`transformObjToRoute` / `asyncImportRoute`), resolving `component` strings against `import.meta.glob` view registry (`src/utils/dynamicPages.ts`)
- Static routes: login (`/login` → `src/views/system/loginmini/MiniLogin.vue`), token-login, error pages
- Router mode: HTML5 history (hash mode when running in Electron via `$electron.isElectron()`)

### State Management (Pinia)

Key stores in `src/store/modules/`:
- `user.ts` (app-user) — auth token, user info, roles, dict items, login info
- `permission.ts` (app-permission) — dynamic routes, permission codes, backend menus
- `app.ts` (app) — project config, theme, layout settings
- `locale.ts` (app-locale) — i18n locale
- `multipleTab.ts` (app-multiple-tab) — tab state

Auth persisted in localStorage via `src/utils/auth/index.ts`.

### API Layer

- Custom Axios wrapper: `src/utils/http/axios/` — configured instance exported as `defHttp`
- All requests signed with MD5 via `signMd5Utils` (timestamp + sign headers)
- Response format: `{ code, result, message, success }` where `code === 200` is success
- `transformRequestHook` rejects responses whose `data` is non-object (guard added for `Reflect.has` safety)

### Component Registration

- **Auto-import**: `unplugin-vue-components` with `AntDesignVueResolver` auto-imports all Ant Design Vue components (no manual import needed in templates)
- **Global manual**: `registerGlobComp.ts` registers Icon, AIcon, JUploadButton, Button, ASpaceCompact, async Tinymce
- **Third-party**: `registerThirdComp.ts` registers vxe-table (full import), custom vxe cell components, emoji picker, dayjs plugins
- **Async loading**: Heavy components use `src/utils/factory/createAsyncComponent.tsx`

### External Monorepo Packages

- `@jeecg/aiflow` (AI编排/flow designer) is an external package excluded from Vite `optimizeDeps`. Lazy-loaded via `src/utils/monorepo/registerPackages.ts` and `dynamicRouter.ts`.
- **Important:** The compiled `@jeecg/aiflow` bundle statically imports `src/views/super/airag/...` files (AiApp.api, AiAppAdd*Modal components, CardTemplate, knowledge/mcp images, AiragPrompts.api). These **must exist** or `vite build` fails with `[UNLOADABLE_DEPENDENCY]`. Stub files were created for the removed AI-chat features; keep them.

### Icon System

Three icon approaches:
1. **Iconify runtime** — `<Icon icon="mdi:home" />` via `@iconify/iconify` CDN lazy-load
2. **SVG sprites** — `<Icon icon="icon-name|svg" />` via `vite-plugin-svg-icons`
3. **unplugin-icons** — `import IconName from '~icons/collection/name'` for compile-time tree-shaken icons

### Theme System

- Less variables generated by `build/generate/generateModifyVars.ts`
- Dark mode via Ant Design Vue `theme.darkAlgorithm`
- CSS variable `--j-global-primary-color` set dynamically from theme color
- CSS class prefix: `jeecg` (defined in `src/settings/designSetting.ts`)

### Performance Optimization Patterns

**Use dynamic imports for non-critical modules** — static `import` at top of a file loads the whole dependency chain on initial page:
- `src/settings/registerThirdComp.ts` — vxe-table, emoji picker (loaded after mount)
- `src/components/registerGlobComp.ts` — Tinymce loaded async
- Non-critical Ant Design Vue components loaded asynchronously

**Vite optimizeDeps** — pre-bundled: dayjs, axios, pinia, nprogress, qs, crypto-js, md5, sortablejs, xe-utils, vue-i18n, lodash-es, xss, mockjs; `@jeecg/aiflow` excluded.

## Key Configuration

### Environment Variables

- `.env` — base config (port 3100, app title)
- `.env.development` — dev with real backend (`VITE_USE_MOCK=false`, `VITE_PROXY` to backend)
- `.env.mock` — mock mode (`VITE_USE_MOCK=true`, no proxy)
- `.env.production` — build config (`VITE_USE_MOCK=false`, gzip)
- `.env.docker` / `.env.dockercloud` / `.env.prod_electron` — deployment-specific (kept but unused in normal workflow)
- `VITE_GLOB_*` vars are injected at runtime via `dist/_app.config.js` (changeable post-build)

### Build

- Post-build: `build/script/postBuild.ts` generates the runtime config file
- Console/debugger stripped in production via Oxc minifier

## Code Style

- **Prettier**: 150 char width, single quotes, trailing commas (es5), 2-space indent, `endOfLine: 'auto'`, `vueIndentScriptAndStyle: true`, `htmlWhitespaceSensitivity: 'strict'`
- **ESLint**: Vue3 recommended + TypeScript recommended + Prettier. `any` is allowed. Unused vars prefixed with `_` are ignored. Note: `prettier/prettier` rule is `'off'` — run Prettier separately
- **Commits**: Conventional commits via commitlint. Max header: 108 chars
- **i18n**: Chinese (zh-CN) and English. Locale files in `src/locales/lang/`

## Important Directories

```
build/                    # Vite plugins, build scripts, theme generation
mock/                     # Mock data (_util.ts helpers, demo/, sys/ sysUrl-prefixed)
src/api/                  # API definitions (sys/, common/, demo/)
src/components/jeecg/     # Jeecg-specific components (JVxeTable, etc.)
src/layouts/default/      # Main app layout (header, sider, tabs, menu)
src/settings/             # Project settings (design, components, locale, encryption)
src/utils/http/axios/     # HTTP client configuration
src/views/system/         # System management pages (user, role, menu, dict, etc.)
src/views/super/          # AIFlow companion stubs required by @jeecg/aiflow build
types/                    # Global TypeScript declarations
```
