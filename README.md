# Jev Classificador

Plugin do Obsidian. Botão no topo direito da nota (e comando "Classificar gênero e categoria"): 1 requisição ao Jev (TypeSafe System One) escolhe `categoria` (26 fields OpenAlex) e `genero` (252 subfields), em PT-BR, e grava no frontmatter.

- Taxonomia: OpenAlex (CC0), traduzida, embutida em `src/taxonomia.json`.
- Chave: guardada no SecretStorage do Obsidian (não vai pro `data.json`). Crie em https://console.typesafe.ai/keys.
- Pastas excluídas (padrão `1-diario`, `4-pessoas`): nunca lidas nem enviadas.
- Confiança < limiar (padrão 0.6): modal com top 3.

## Dev

```bash
npm install
npm test        # vitest (lógica pura em src/core)
npm run build   # gera main.js
```

Instalar: copiar `main.js`, `manifest.json`, `styles.css` para `<vault>/.obsidian/plugins/jev-classificador/`.
