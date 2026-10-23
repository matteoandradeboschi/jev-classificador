# Jev Classificador

Obsidian plugin. A button at the top right of the note (and the "Classify field and subfield" command) sends 1 request to Jev (TypeSafe System One), which picks a `categoria` (field, 13 options) and a `genero` (subfield, 89 options), in English or Brazilian Portuguese, and writes them to the frontmatter.

## Install

1. Obsidian → **Settings → Community plugins → Browse** → "Jev Classificador" → **Install** → **Enable**.
2. In the window that opens, create a key at https://console.typesafe.ai/keys and paste it into the secret. Done.

Hotkeys: none by default. Set them in **Settings → Hotkeys** (search for "Jev"). Suggestion: Alt+C, Alt+T, Alt+A.

## Privacy

- When classifying (or generating topic tags), the plugin sends to the TypeSafe API (`api.typesafe.ai`): the note title, its tags and up to N characters of the body (default 12000). The folder path is never sent. Nothing is sent unless you run the command.
- The key is kept in Obsidian's SecretStorage (it does not go into `data.json`).
- **Excluded folders** (settings): notes in them are never read or sent.

## How it works

- Taxonomy: custom, with descriptions (`desc`, sent to Jev as criteria), bundled in `src/taxonomia.en.json` (English) and `src/taxonomia.json` (Portuguese). Each field has a `general` subfield.
- Confidence below the threshold (default 0.6): a modal with the top 3.
- Frontmatter: `categoria`, `genero` and `tags` are kept together, in that order. The property names stay the same in both languages.
- "Generate tags" command, no API: a `<root folder without number, singular>/<subfield or field>` tag in kebab-case without accents (e.g. `1-concepts/x` → `concept/infrastructure`). Only tags with the same prefix are replaced. Checkbox `ai-generated: true` → also `ai-generated`. Singular exceptions in the settings (default `lugares=lugar`).
- "Generate topic tags" command (API): 1–3 flat tags from a closed wordlist (`src/taxonomia-tags.en.json` or `src/taxonomia-tags.json`).

## Language

The **Taxonomy language** setting (Português/English) picks the taxonomy, the topic-tag wordlist, the instructions sent to Jev and the UI language. With no saved choice, it follows Obsidian's language. Command names change after reloading the plugin; command ids (`classificar`, `gerar-tags`, `gerar-tags-assunto`) don't, so your hotkeys keep working.

Switching language **does not translate notes already classified**:

- `categoria`/`genero` stay in the language they were written in (e.g. `tecnologia` in one note, `technology` in another). Re-classify (Alt+C) if you want everything in one language.
- Folder/subfield tags (Alt+T) follow the frontmatter value; since Alt+T replaces everything with the same prefix, running it again after re-classifying removes the old tag.
- Topic tags (Alt+A): the plugin recognizes the wordlists of **both languages**, so running Alt+A in the new language replaces the old tags (e.g. `#ia` → `#ai`) without touching the others.

## Dev

```bash
npm install
npm test        # vitest (pure logic in src/core)
npm run build   # builds main.js
```

Manual install: copy `main.js`, `manifest.json` and `styles.css` to `<vault>/.obsidian/plugins/jev-classificador/`.
