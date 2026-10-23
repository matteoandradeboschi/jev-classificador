# Jev Classificador

Plugin do Obsidian. Botão no topo direito da nota (e comando "Classificar gênero e categoria", Alt+C): 1 requisição ao Jev (TypeSafe System One) escolhe `categoria` (13 áreas) e `genero` (89 subáreas), em PT-BR, e grava no frontmatter.

- Taxonomia: própria, com descrições (`desc`, enviadas ao Jev como critério), embutida em `src/taxonomia.json`. Cada categoria tem um gênero `geral`.
- Chave: guardada no SecretStorage do Obsidian (não vai pro `data.json`). Crie em https://console.typesafe.ai/keys.
- Pastas excluídas (padrão `1-diario`, `4-pessoas`): nunca lidas nem enviadas.
- Confiança < limiar (padrão 0.6): modal com top 3.
- Frontmatter: `categoria`, `genero`, `tags` ficam juntas, nessa ordem.
- Comando "Gerar tags" (Alt+T), sem API: tag `<pasta raiz sem número, no singular>/<gênero ou categoria>` em kebab-case sem acento (ex.: `1-conceitos/x` → `conceito/infraestrutura`). Troca só as tags do mesmo prefixo. Checkbox `ai-generated: true` → também `ai-generated`. Exceções do singular nas configurações (padrão `lugares=lugar`).

## Dev

```bash
npm install
npm test        # vitest (lógica pura em src/core)
npm run build   # gera main.js
```

Instalar: copiar `main.js`, `manifest.json`, `styles.css` para `<vault>/.obsidian/plugins/jev-classificador/`.
