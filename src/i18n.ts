// Textos da interface. O idioma segue a configuração "Idioma da taxonomia" (um setting só).
import type { Lang } from './core/prompts';

const pt = {
	cmdClassificar: 'Classificar gênero e categoria',
	cmdGerarTags: 'Gerar tags (pasta/categoria)',
	cmdGerarTagsAssunto: 'Gerar tags de assunto',
	tooltip: 'Classificar gênero e categoria (Jev)',
	configureChave: 'Jev: configure a chave TypeSafe',
	soMd: (p: string) => `${p}: só funciona em notas .md`,
	privadaNaoEnviado: (p: string) => `${p}: pasta privada, não enviado`,
	privadaIgnorada: 'Tags: pasta privada, ignorada',
	classificando: 'Jev: classificando…',
	nenhumaCategoria: 'Jev: nenhuma categoria se aplica',
	conf: 'conf.',
	foraDePasta: 'Tags: nota fora de pasta, nada a fazer',
	semCampo: (campo: 'genero' | 'categoria') =>
		`Tags: nota sem ${campo === 'genero' ? 'gênero' : 'categoria'} — classifique antes (Alt+C)`,
	substituirTitulo: 'Substituir tags de assunto?',
	substituirTexto: (tags: string) => `A nota já tem ${tags}. As outras tags não mudam.`,
	substituir: 'Substituir',
	gerandoTags: 'Jev: gerando tags…',
	erroAuth: 'Jev: chave TypeSafe inválida — veja as configurações',
	erroRate: (s?: number) => `Jev: serviço ocupado (HTTP ${s}), tente de novo depois`,
	erroTokens: 'Jev: nota grande demais, reduza o máx. de caracteres',
	erroResposta: (m: string) => `Jev: resposta inesperada — ${m}`,
	erroHttp: (s: number | undefined, m: string) => `Jev: erro HTTP ${s} — ${m}`,
	erroRede: (m: string) => `Jev: erro de rede/inesperado — ${m}`,

	// Configurações
	idioma: 'Idioma da taxonomia',
	idiomaDesc:
		'Taxonomia, wordlist das tags de assunto, instruções enviadas ao Jev e esta interface. Notas já classificadas não são traduzidas. Os nomes dos comandos ficam sempre em inglês.',
	chave: 'Chave TypeSafe',
	chaveDesc:
		'Guardada no armazenamento de segredos do Obsidian, não no data.json do vault (que vai no backup). Crie em console.typesafe.ai/keys.',
	modelo: 'Modelo',
	limiar: 'Limiar de confiança',
	limiarDesc:
		'Se p(categoria) × p(gênero) do par vencedor ficar abaixo disso, pede para escolher entre as 3 melhores. Valor inicial é um chute; ajuste depois de usar em notas reais.',
	excluidas: 'Pastas excluídas',
	excluidasDesc: 'Uma por linha. Notas nessas pastas nunca são lidas nem enviadas.',
	maxChars: 'Máx. caracteres do corpo',
	maxCharsDesc: 'Quanto da nota é enviado (mais caracteres = mais tokens cobrados).',
	atalho: 'Atalho de teclado',
	atalhoDesc:
		'Classifica a nota aberta (também pelo botão no topo da nota). Sem atalho padrão.',
	definirAtalho: 'Definir atalho',
	abrirAtalhosManual: 'Abra Configurações → Atalhos e busque "Jev"',
	tags: 'Tags',
	atalhoTags: 'Atalho das tags',
	atalhoTagsDesc:
		'Gera #pasta/gênero ou #pasta/categoria (pasta raiz sem número e no singular) a partir do que o Jev já gravou. Não usa a API. Sem atalho padrão.',
	tagUsa: 'Tag usa',
	tagUsaDesc: 'O que vem depois da barra: conceito/infraestrutura (gênero) ou conceito/tecnologia (categoria).',
	genero: 'Gênero',
	categoria: 'Categoria',
	excecoes: 'Exceções do singular',
	excecoesDesc: 'Uma por linha, pasta=prefixo. Por padrão só tira o "s" final (conceitos → conceito).',
	tagsAssunto: 'Tags de assunto',
	atalhoAssunto: 'Atalho das tags de assunto',
	atalhoAssuntoDesc:
		'Pede ao Jev 1–3 tags planas da wordlist (ex.: #ia #linux #tutorial). Usa a API, com a mesma chave e pastas excluídas. Sem atalho padrão.',
	limiarTags: 'Limiar das tags',
	limiarTagsDesc:
		'Probabilidade mínima (0–1) para gravar a tag sem perguntar. Se nenhuma passar, abre a escolha entre as 6 melhores. Valor inicial é um chute; ajuste depois de usar em notas reais.',

	// Modais
	cancelar: 'Cancelar',
	pronto: 'Pronto',
	keyIntro: 'O Jev precisa de uma chave da TypeSafe. Crie em ',
	keyFim: ' e escolha ou crie o segredo abaixo.',
	keyNota: 'A chave fica no armazenamento de segredos do Obsidian, não nos arquivos do vault.',
	sobrescreverTitulo: 'Sobrescrever classificação?',
	sobrescreverTexto: (g: string, c: string) => `A nota já tem gênero "${g}" e categoria "${c}".`,
	sobrescrever: 'Sobrescrever',
	escolhaTitulo: 'Jev não tem certeza — escolha',
	escolhaTexto: (l: string, c: string, g: string) =>
		`Probabilidade (categoria × gênero) abaixo do limiar ${l}. Confiança do Jev: categoria ${c} · gênero ${g}.`,
	escolhaTagsTitulo: 'Jev não tem certeza — escolha as tags',
	escolhaTagsTexto: (l: string, max: number, forma: number) =>
		`Nenhuma tag passou do limiar ${l}. Marque até ${max} (no máximo ${forma} de forma).`,
	gravar: 'Gravar',
};

const en: typeof pt = {
	cmdClassificar: 'Classify field and subfield',
	cmdGerarTags: 'Generate tags (folder/field)',
	cmdGerarTagsAssunto: 'Generate topic tags',
	tooltip: 'Classify field and subfield (Jev)',
	configureChave: 'Jev: set up your TypeSafe key',
	soMd: (p) => `${p}: only works on .md notes`,
	privadaNaoEnviado: (p) => `${p}: private folder, nothing sent`,
	privadaIgnorada: 'Tags: private folder, skipped',
	classificando: 'Jev: classifying…',
	nenhumaCategoria: 'Jev: no field applies',
	conf: 'conf.',
	foraDePasta: 'Tags: note is not in a folder, nothing to do',
	semCampo: (campo) => `Tags: note has no ${campo === 'genero' ? 'subfield' : 'field'} — classify it first (Alt+C)`,
	substituirTitulo: 'Replace topic tags?',
	substituirTexto: (tags) => `The note already has ${tags}. Other tags stay as they are.`,
	substituir: 'Replace',
	gerandoTags: 'Jev: generating tags…',
	erroAuth: 'Jev: invalid TypeSafe key — check the settings',
	erroRate: (s) => `Jev: service busy (HTTP ${s}), try again later`,
	erroTokens: 'Jev: note too large, lower the max. characters',
	erroResposta: (m) => `Jev: unexpected response — ${m}`,
	erroHttp: (s, m) => `Jev: HTTP error ${s} — ${m}`,
	erroRede: (m) => `Jev: network/unexpected error — ${m}`,

	idioma: 'Taxonomy language',
	idiomaDesc:
		'Taxonomy, topic tag wordlist, instructions sent to Jev and this interface. Notes already classified are not translated. Command names are always in English.',
	chave: 'TypeSafe key',
	chaveDesc:
		"Stored in Obsidian's secret storage, not in the vault's data.json (which ends up in backups). Create one at console.typesafe.ai/keys.",
	modelo: 'Model',
	limiar: 'Confidence threshold',
	limiarDesc:
		"If p(field) × p(subfield) of the winning pair falls below this, you pick among the top 3. The default is a guess; adjust it after using it on real notes.",
	excluidas: 'Excluded folders',
	excluidasDesc: 'One per line. Notes in these folders are never read or sent.',
	maxChars: 'Max. body characters',
	maxCharsDesc: 'How much of the note is sent (more characters = more billed tokens).',
	atalho: 'Hotkey',
	atalhoDesc:
		'Classifies the open note (also via the button at the top of the note). No default hotkey.',
	definirAtalho: 'Set hotkey',
	abrirAtalhosManual: 'Open Settings → Hotkeys and search for "Jev"',
	tags: 'Tags',
	atalhoTags: 'Tags hotkey',
	atalhoTagsDesc:
		'Generates #folder/subfield or #folder/field (root folder without number, singular) from what Jev already saved. Does not use the API. No default hotkey.',
	tagUsa: 'Tag uses',
	tagUsaDesc: 'What comes after the slash: concept/infrastructure (subfield) or concept/technology (field).',
	genero: 'Subfield',
	categoria: 'Field',
	excecoes: 'Singular exceptions',
	excecoesDesc: 'One per line, folder=prefix. By default it only drops a trailing "s" (concepts → concept).',
	tagsAssunto: 'Topic tags',
	atalhoAssunto: 'Topic tags hotkey',
	atalhoAssuntoDesc:
		'Asks Jev for 1–3 flat tags from the wordlist (e.g. #ai #linux #tutorial). Uses the API, with the same key and excluded folders. No default hotkey.',
	limiarTags: 'Tags threshold',
	limiarTagsDesc:
		"Minimum probability (0–1) to save a tag without asking. If none passes, you pick among the top 6. The default is a guess; adjust it after using it on real notes.",

	cancelar: 'Cancel',
	pronto: 'Done',
	keyIntro: 'Jev needs a TypeSafe key. Create one at ',
	keyFim: ' and pick or create the secret below.',
	keyNota: "The key is kept in Obsidian's secret storage, not in the vault files.",
	sobrescreverTitulo: 'Overwrite classification?',
	sobrescreverTexto: (g, c) => `The note already has subfield "${g}" and field "${c}".`,
	sobrescrever: 'Overwrite',
	escolhaTitulo: 'Jev is not sure — pick one',
	escolhaTexto: (l, c, g) =>
		`Probability (field × subfield) below the threshold ${l}. Jev's confidence: field ${c} · subfield ${g}.`,
	escolhaTagsTitulo: 'Jev is not sure — pick the tags',
	escolhaTagsTexto: (l, max, forma) => `No tag passed the threshold ${l}. Check up to ${max} (at most ${forma} of form).`,
	gravar: 'Save',
};

const UI: Record<Lang, typeof pt> = { pt, en };
let atual: Lang = 'en';

export const setLang = (l: Lang) => (atual = l);
export const t = () => UI[atual];
/** Nomes dos comandos: sempre em inglês (registrados uma vez, no onload). */
export const tEn = () => UI.en;
