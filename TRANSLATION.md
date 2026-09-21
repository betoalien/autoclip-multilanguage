# TRANSLATION.md — i18n string extraction (remaining files)

**Audience:** a coding agent (e.g. local Ollama model) working ONLY on this task.
**Do not read this as a general "improve the app" ticket.** Your ONLY job is described below. Do not
refactor, restyle, fix unrelated bugs, upgrade dependencies, or touch any file not listed in Scope.

## Context

AutoClip's frontend (`frontend/`) is a React + TypeScript + Vite + antd app that was Chinese-only.
An i18n system (`react-i18next`) has already been wired in and most of the app has already been
converted. **You are finishing the last ~13 files.**

Already done (do not redo, do not touch):
- `frontend/src/i18n/index.ts` — i18next config, loads `frontend/src/i18n/locales/{zh,en,es}.json`.
- `frontend/src/context/LanguageContext.tsx` + `frontend/src/components/LanguageSwitcher.tsx` — already wired into `Header.tsx` / `main.tsx`.
- ~50 other components/pages already converted and already have their keys in the three locale files.

## Scope — files to convert (only these)

All paths relative to `frontend/`:

1. `src/components/ProjectCard.tsx` (~93 lines with Chinese)
2. `src/components/UploadTaskManager.tsx` (~84 lines)
3. `src/hooks/useWebSocket.ts` (~42 lines)
4. `src/store/useProjectStore.ts` (~31 lines)
5. `src/config/bilibiliPartitions.ts` (~30 lines)
6. `src/utils/statusUtils.tsx` (~29 lines)
7. `src/services/uploadApi.ts` (~40 lines)
8. `src/stores/useSimpleProgressStore.ts` (~50 lines)
9. `src/hooks/useTaskProgress.ts` (~21 lines)
10. `src/utils/apiConfig.ts` (~18 lines)
11. `src/hooks/useFirstRun.ts` (~14 lines)
12. `src/hooks/useProjectPolling.ts` (~12 lines)
13. `src/hooks/useTaskStatus.ts` (~10 lines)
14. `src/utils/apiUtils.ts` (~11 lines)

**Do NOT touch these** (checked already — the only Chinese left in them is code comments, not
UI text, which must stay as-is or can be left untranslated; translating comments is out of scope):
`src/App.tsx`, `src/main.tsx`, `src/vite-env.d.ts`, `src/components/Header.tsx`,
`src/components/icons/MagicWandIcon.tsx`, `src/analytics/events.ts`, `src/analytics/feedback.ts`,
`src/analytics/lifecycle.ts`, `src/analytics/posthog.ts`, and every file NOT listed above.

`src/pages/SimpleProgressDemo.tsx` still has Chinese but is dead code (not referenced by any
route in `src/App.tsx`) — skip it, lowest priority, only do it if everything else above is done
and verified.

## What "convert" means

Replace every hardcoded Chinese UI string (button labels, messages, placeholders, tooltips,
titles, toast/notification text, table headers, error messages shown to the user, aria-labels)
with a call into i18next, AND add the corresponding key + zh/en/es text to the three locale files.

**A file is NOT done until its keys exist in all three of:**
- `frontend/src/i18n/locales/zh.json`
- `frontend/src/i18n/locales/en.json`
- `frontend/src/i18n/locales/es.json`

This is the #1 mistake to avoid — a previous automated pass converted ~30 files' code to call
`t('some.key')` but died before writing the matching entries into the locale JSON files. The
result: the app displayed the literal string `some.key` on screen instead of any real text, in
any language — worse than the original all-Chinese UI. **Update the JSON files in the very same
step as the code change, file by file. Never leave a `t('key')` call without its 3 translations
already written.**

### For React component files (`.tsx`, or a real React hook `useXxx` called during render)

```tsx
import { useTranslation } from 'react-i18next'
// ...
const { t } = useTranslation()
// ...
<Button>{t('projectCard.delete')}</Button>
```

### For non-component files (services, plain utils, zustand stores, non-hook `.ts` files)

Import the i18next singleton directly and call `.t(...)` on it — do NOT use the `useTranslation`
hook outside a component/hook:

```ts
import i18n from '../i18n'
// ...
message.error(i18n.t('uploadApi.taskFailed'))
```

(`src/utils/apiConfig.ts`, `src/utils/apiUtils.ts`, `src/services/uploadApi.ts`,
`src/config/bilibiliPartitions.ts`, `src/store/useProjectStore.ts`,
`src/stores/useSimpleProgressStore.ts` are plain non-hook files → use the `i18n` singleton import.
`src/hooks/useWebSocket.ts`, `useTaskProgress.ts`, `useFirstRun.ts`, `useProjectPolling.ts`,
`useTaskStatus.ts` are real React hooks (called during component render) → `useTranslation()` is fine
inside them.)

## Key naming

Namespace by file/feature, camelCase leaf, e.g. `t('projectCard.deleteConfirmTitle')`,
`t('uploadTaskManager.retryFailed')`, `t('websocket.reconnecting')`. Reuse existing `common.*` keys
(`save`, `cancel`, `confirm`, `delete`, `close`, `loading`, `success`, `failed`, `retry`,
`language`) instead of duplicating when the string means exactly one of those.

Before inventing a new key, check whether the file already has partially-converted keys from the
earlier pass (some may already exist under e.g. `project.*` — check `zh.json` for an existing
namespace that matches the file's feature before creating a new one).

## Interpolation (dynamic values)

For strings with dynamic values (e.g. `` `${name} 上传失败` ``), use i18next interpolation:

- Code: `t('upload.failed', { name })`
- zh.json value: `"{{name}} 上传失败"`
- en.json value: `"{{name}} upload failed"`
- es.json value: `"Error al subir {{name}}"`

The placeholder name inside `{{...}}` MUST exactly match the object key passed to `t()`. Do not
invent placeholder names that don't match the actual variable passed at the call site.

## Step-by-step per file

1. Open the file, find every hardcoded Chinese string that is genuinely user-facing (skip code
   comments — lines starting with `//`, `/*`, or JSDoc `/** */`).
2. Pick/confirm a namespace key for the file.
3. Replace the string with `t('namespace.key', {...})` (or `i18n.t(...)` for non-component files),
   adding the right import if not already present.
4. Immediately add the key to all three of `zh.json` / `en.json` / `es.json`:
   - `zh.json` value = the exact original Chinese text (source of truth wording).
   - `en.json` value = natural, concise English (this is UI microcopy, not prose).
   - `es.json` value = natural, concise Spanish (not machine-literal, but accurate).
   - Keep the same nested key path in all three files (they are Chinese/English/Spanish versions
     of the same tree — if a key exists in one, it must exist in all three, no exceptions).
5. Move to the next string in the same file. Once the file has no more hardcoded Chinese UI
   strings, run:
   ```
   cd frontend && npx tsc --noEmit -p .
   ```
   Fix any error before moving to the next file. Do not batch this check across many files — do
   it after every single file so mistakes are caught immediately, not at the end.

## Definition of done (run this after every file, and again at the very end)

From `frontend/`, this Python one-liner must print `0`:

```bash
python3 -c "
import re, json, glob
used = set()
for fp in glob.glob('src/**/*.ts*', recursive=True):
    text = open(fp, encoding='utf-8').read()
    for m in re.finditer(r\"\bt\('([a-zA-Z0-9_.]+)'\", text):
        used.add(m.group(1))
zh = json.load(open('src/i18n/locales/zh.json'))
def flatten(d, p=''):
    out = {}
    for k, v in d.items():
        key = f'{p}.{k}' if p else k
        out.update(flatten(v, key)) if isinstance(v, dict) else out.update({key: v})
    return out
flat = set(flatten(zh).keys())
missing = sorted(k for k in used if k not in flat)
print(len(missing))
for k in missing: print(' -', k)
"
```

If it prints anything other than `0`, some `t('key')` call in the code has no matching entry in
`zh.json` — go back and add it (and to `en.json` / `es.json`) before considering the work finished.

Also run the same check conceptually against `en.json` and `es.json` (same key sets as `zh.json` —
they must never drift out of sync with each other).

At the very end, also run:
```bash
cd frontend && npx tsc --noEmit -p .
cd frontend && npm run build
```
Both must succeed with zero errors.

## Final report

When finished, list: files converted, number of new keys added, confirmation that the
"definition of done" script above printed `0`, and confirmation that `tsc` and `npm run build`
are clean. If you could not finish everything, say exactly which files are done and which are
not — do not claim a file is done if the JSON files weren't updated for it.
