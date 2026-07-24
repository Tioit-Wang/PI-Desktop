# 02. i18n (English-first)

## 1. Policy

PI-Desktop is a global product.

- **Default locale:** `en`
- **Source language:** English
- **Authoring language for specs/UI/source strings:** English
- Other locales are translations of English sources

## 2. Framework requirements

UI must use an i18n framework (recommended: i18next + react-i18next).

Rules:

1. No hard-coded user-facing English sentences scattered without IDs long-term
2. Every visible string has a stable key
3. Locale switch must not require code edits

## 3. Catalog structure

```text
apps/desktop/locales/
 en/
 common.json
 chat.json
 settings.json
 plugins.json
 errors.json
```

Optional later:

```text
 zh-CN/
 ja/
 ...
```

## 4. Key conventions

```text
domain.section.item
```

Examples:

- `chat.composer.placeholder`
- `settings.providers.add`
- `plugins.permissions.fs.write.workspace`
- `errors.tool.denied`

## 5. Non-UI language surfaces

Also English-first:

- docs/spec
- ADRs
- commit messages
- issue/PR templates
- plugin example docs
- command titles in core product

Plugins may include localized display fields later, but English fields are required.

## 6. Acceptance

1. App boots in English by default
2. Locale files exist for English source catalog
3. Switching architecture supports additional locales
4. No Chinese hard dependency in core UI path
