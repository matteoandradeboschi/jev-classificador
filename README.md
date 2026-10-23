# Jev Classificador

Plugin do Obsidian. Botão no topo direito da nota (e comando "Classificar gênero e categoria"): 1 requisição ao Jev (TypeSafe System One) escolhe `categoria` (13 áreas) e `genero` (89 subáreas), em PT-BR, e grava no frontmatter.

## Instalar

1. Obsidian → **Configurações → Plugins da comunidade → Procurar** → "Jev Classificador" → **Instalar** → **Ativar**.
2. Na janela que abre, crie a chave em https://console.typesafe.ai/keys e cole no segredo. Pronto.

Atalhos: sem padrão. Defina em **Configurações → Atalhos** (busque "Jev"). Sugestão: Alt+C, Alt+T, Alt+A.

## Privacidade

- Ao classificar (ou gerar tags de assunto), o plugin envia à API da TypeSafe (`api.typesafe.ai`): título da nota, tags, até N caracteres do corpo (padrão 12000) e, se ativado, o caminho da pasta. Nada é enviado sem você acionar o comando.
- A chave fica no SecretStorage do Obsidian (não vai pro `data.json`).
- **Pastas excluídas** (configurações): notas nelas nunca são lidas nem enviadas.

## Funcionamento

- Taxonomia: própria, com descrições (`desc`, enviadas ao Jev como critério), embutida em `src/taxonomia.json`. Cada categoria tem um gênero `geral`.
- Confiança < limiar (padrão 0.6): modal com top 3.
- Frontmatter: `categoria`, `genero`, `tags` ficam juntas, nessa ordem.
- Comando "Gerar tags", sem API: tag `<pasta raiz sem número, no singular>/<gênero ou categoria>` em kebab-case sem acento (ex.: `1-conceitos/x` → `conceito/infraestrutura`). Troca só as tags do mesmo prefixo. Checkbox `ai-generated: true` → também `ai-generated`. Exceções do singular nas configurações (padrão `lugares=lugar`).
- Comando "Gerar tags de assunto" (API): 1–3 tags planas de uma wordlist fechada (`src/taxonomia-tags.json`).

## Dev

```bash
npm install
npm test        # vitest (lógica pura em src/core)
npm run build   # gera main.js
```

Instalar manual: copiar `main.js`, `manifest.json`, `styles.css` para `<vault>/.obsidian/plugins/jev-classificador/`.
