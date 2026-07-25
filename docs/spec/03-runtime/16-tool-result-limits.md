# 16. Tool Result Limits & Truncation

## 1. Goal

Keep agent context healthy and UI responsive by bounding tool outputs without silent data corruption.

## 2. Default limits (MVP)

| channel | limit | action when exceeded |
|---|---|---|
| tool result total bytes | 256 KB | truncate + marker |
| tool result max lines | 4000 lines | truncate + marker |
| single Read file bytes | 512 KB | refuse range/smaller read |
| Grep max matches | 200 | stop with partial flag |
| Glob max entries | 2000 | stop with partial flag |
| Bash stdout+stderr | 256 KB | truncate |
| Bash timeout | 60s default | kill + error |

Limits are host-enforced where possible.

## 3. Truncation marker format

Implemented marker (host-core `truncate_output`):

```text
[truncated: output exceeded 256KB or 4000 lines]
```

The marker is appended to the truncated payload. A future richer marker may
add tool name, original size, and applied limit; until then this exact
string is the single truncation vocabulary across host, UI, and specs.

## 4. Model-facing vs UI-facing

- model receives truncated payload with marker
- UI may offer “open full output in viewer” for Bash/Read later (post-MVP optional)
- full raw output is not required to persist forever; session may store truncated form in MVP

## 5. Partial result flags

Tool response envelope:

```ts
type ToolResultEnvelope = {
  ok: boolean
  content: string
  truncated?: boolean
  partial?: boolean
  stats?: {
    bytes?: number
    lines?: number
    matches?: number
    entries?: number
  }
  error?: AppError
}
```

## 6. Priority rules

1. never omit truncation marker when truncated
2. prefer head+tail retention for Bash logs if easy; else head-only in MVP
3. binary files: do not dump raw binary into model; return metadata error `TOOL_BINARY_CONTENT`

## 7. Acceptance criteria

- [ ] oversize Bash output truncates with marker
- [ ] Grep stops at max matches with partial=true
- [ ] Read oversize file fails with actionable error or bounded preview policy
- [ ] truncated results still valid UTF-8 text
