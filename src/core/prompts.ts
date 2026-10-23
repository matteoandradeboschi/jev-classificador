// Textos enviados ao Jev, por idioma da taxonomia. As chaves do state (titulo, pasta, tags, corpo) não mudam.
export type Lang = 'pt' | 'en';

export const PROMPTS = {
	pt: {
		nenhuma: 'nenhuma',
		nenhumaDesc:
			'A nota não trata de nenhuma área do conhecimento desta lista (ex.: lista de compras, nota vazia sem título informativo).',
		categoria: (campos: string) => `Qual área ampla do conhecimento melhor descreve o assunto da nota (${campos})?`,
		genero: (cat: string, campos: string) =>
			`Supondo que a nota pertença à área "${cat}", qual subárea melhor descreve o assunto da nota (${campos})?`,
		tema: (tag: string, desc: string, campos: string) =>
			`Tema "${tag}": ${desc} Esse é um assunto central da nota (${campos})?`,
		temaSim: 'O tema é assunto central ou recorrente da nota.',
		temaNao: 'O tema não aparece, ou só é mencionado de passagem.',
		forma: (tag: string, desc: string, campos: string) =>
			`Forma "${tag}": ${desc} A nota (${campos}) é principalmente deste tipo?`,
		formaSim: 'A nota é principalmente deste tipo.',
		formaNao: 'A nota não é deste tipo, ou só tem um trecho dele.',
	},
	en: {
		nenhuma: 'none',
		nenhumaDesc:
			'The note is not about any field of knowledge in this list (e.g. a shopping list, an empty note with an uninformative title).',
		categoria: (campos: string) => `Which broad field of knowledge best describes what the note (${campos}) is about?`,
		genero: (cat: string, campos: string) =>
			`Assuming the note belongs to the field "${cat}", which subfield best describes what the note (${campos}) is about?`,
		tema: (tag: string, desc: string, campos: string) =>
			`Topic "${tag}": ${desc} Is this a central subject of the note (${campos})?`,
		temaSim: 'The topic is a central or recurring subject of the note.',
		temaNao: 'The topic does not appear, or is only mentioned in passing.',
		forma: (tag: string, desc: string, campos: string) =>
			`Form "${tag}": ${desc} Is the note (${campos}) mainly of this kind?`,
		formaSim: 'The note is mainly of this kind.',
		formaNao: 'The note is not of this kind, or only has a short passage of it.',
	},
} satisfies Record<Lang, unknown>;

/** Qualquer "nenhuma" vale: notas antigas em PT continuam reconhecidas com a taxonomia EN e vice-versa. */
export const NENHUMAS = new Set(Object.values(PROMPTS).map((p) => p.nenhuma));
