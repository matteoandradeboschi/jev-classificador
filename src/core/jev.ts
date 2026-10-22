import {
	Categoria,
	ChoiceAnswer,
	JevRequest,
	JevResponse,
	NENHUMA,
	Par,
	Question,
	Resultado,
	Taxonomia,
} from './types';

export const generoQuestionId = (c: Categoria) => `genero_${c.id}`;

export function buildQuestions(tax: Taxonomia): Record<string, Question> {
	const questions: Record<string, Question> = {};

	const criteria: Record<string, string> = {};
	for (const c of tax.categorias) criteria[c.pt] = c.en;
	criteria[NENHUMA] =
		'A nota não trata de nenhuma área do conhecimento desta lista (ex.: lista de compras, nota vazia sem título informativo).';
	questions.categoria = {
		type: 'choice',
		instructions:
			'Qual área ampla do conhecimento melhor descreve o assunto da nota (`titulo`, `tags`, `corpo`)?',
		criteria,
	};

	// Ids de pergunta não chegam ao modelo: o texto precisa ser autossuficiente.
	for (const c of tax.categorias) {
		const sub: Record<string, string> = {};
		for (const g of c.generos) sub[g.pt] = g.en;
		questions[generoQuestionId(c)] = {
			type: 'choice',
			instructions: `Supondo que a nota pertença à área "${c.pt}", qual subárea melhor descreve o assunto da nota (\`titulo\`, \`tags\`, \`corpo\`)?`,
			criteria: sub,
		};
	}
	return questions;
}

export function stripFrontmatter(content: string): string {
	return content.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '');
}

export function normalizeTags(raw: unknown): string[] {
	if (typeof raw === 'string')
		return raw
			.split(/[,\s]+/)
			.map((t) => t.replace(/^#/, ''))
			.filter(Boolean);
	if (Array.isArray(raw))
		return raw
			.filter((t): t is string => typeof t === 'string')
			.map((t) => t.replace(/^#/, ''))
			.filter(Boolean);
	return [];
}

export interface NoteInput {
	basename: string;
	frontmatter?: Record<string, unknown> | null;
	content: string;
}

export function buildRequest(
	tax: Taxonomia,
	note: NoteInput,
	model: string,
	maxChars: number,
): JevRequest {
	return {
		model,
		state: {
			titulo: note.basename,
			tags: normalizeTags(note.frontmatter?.tags),
			corpo: stripFrontmatter(note.content).slice(0, Math.max(0, maxChars)),
		},
		questions: buildQuestions(tax),
	};
}

export function isExcluded(path: string, folders: string[]): boolean {
	const p = path.replace(/^\/+/, '').toLowerCase();
	return folders
		.map((f) => f.trim().replace(/^\/+|\/+$/g, '').toLowerCase())
		.filter(Boolean)
		.some((f) => p === f || p.startsWith(f + '/'));
}

export function isClassified(fm: Record<string, unknown> | null | undefined): boolean {
	const filled = (v: unknown) =>
		Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : v != null;
	return !!fm && filled(fm.genero) && filled(fm.categoria);
}

function answer(res: JevResponse, id: string): ChoiceAnswer {
	const a = res.answers?.[id];
	if (!a || a.type !== 'choice' || typeof a.choice !== 'string' || !a.probabilities)
		throw new Error(`resposta ausente ou inválida: ${id}`);
	return a;
}

const prob = (a: ChoiceAnswer, key: string) => a.probabilities[key] ?? 0;

/** null = Jev disse "nenhuma". Lança se a resposta fugir da taxonomia. */
export function parseResponse(tax: Taxonomia, res: JevResponse): Resultado | null {
	const cat = answer(res, 'categoria');
	if (cat.choice === NENHUMA) return null;
	const winner = tax.categorias.find((c) => c.pt === cat.choice);
	if (!winner) throw new Error(`categoria desconhecida: ${cat.choice}`);

	const gen = answer(res, generoQuestionId(winner));
	if (!winner.generos.some((g) => g.pt === gen.choice))
		throw new Error(`gênero desconhecido em ${winner.pt}: ${gen.choice}`);

	const pares: Par[] = [];
	for (const c of tax.categorias) {
		const pCat = prob(cat, c.pt);
		if (pCat <= 0) continue;
		const g = res.answers?.[generoQuestionId(c)];
		if (!g?.probabilities) continue;
		for (const sub of c.generos) {
			const pGen = prob(g, sub.pt);
			if (pGen > 0)
				pares.push({ categoria: c.pt, genero: sub.pt, pCategoria: pCat, pGenero: pGen });
		}
	}
	pares.sort((a, b) => b.pCategoria * b.pGenero - a.pCategoria * a.pGenero);

	return {
		melhor: {
			categoria: winner.pt,
			genero: gen.choice,
			pCategoria: prob(cat, winner.pt),
			pGenero: prob(gen, gen.choice),
			confCategoria: cat.confidence,
			confGenero: gen.confidence,
		},
		top3: pares.slice(0, 3),
	};
}

export function precisaConfirmar(r: Resultado, limiar: number): boolean {
	return r.melhor.confCategoria < limiar || r.melhor.confGenero < limiar;
}
