# 06. Settings Information Architecture

## 1. Settings root sections (MVP)

1. **General**
2. **Providers**
3. **Permissions**
4. **Plugins**
5. **Appearance**
6. **Advanced**
7. **About**

## 2. Section contents

### General
- default mode (Agent/Chat)
- language (English default; extra locales later)
- startup behavior
- project reopen policy

### Providers
- provider list
- base URL
- model selection
- API key set/delete/has indicators
- connection test (optional if easy)

### Permissions
- mode policy explanation
- session grant viewer/clear
- timeout display (120s)

### Plugins
- installed list
- enable/disable/uninstall
- load development plugin
- permission declarations viewer
- open plugin data/logs dirs

### Appearance
- theme system/light/dark
- density (optional later)

### Advanced
- open logs folder
- protocol/host versions
- reset local state (dangerous, confirm)

### About
- app version
- host-core version
- agent runtime version
- license/links

## 3. Navigation rules

- settings can open as dedicated route
- command palette can deep-link to sections
- unsaved edits should warn on leave if needed

## 4. Acceptance

1. All MVP settings targets reachable in ≤2 clicks from root
2. Provider secret states never show raw key
3. Plugins and permissions have first-class sections
