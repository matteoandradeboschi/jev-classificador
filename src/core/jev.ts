import {
	Categoria,
	ChoiceAnswer,
	ChoiceQuestion,
	JevRequest,
	JevResponse,
	JevState,
	Par,
	Resultado,
	Taxonomia,
} from './types';
import { Lang, PROMPTS } from './prompts';

export const generoQuestionId = (c: Categoria) => `genero_${c.id}`;

export const camposState = (comPasta: boolean) =>
	comPasta ? '`titulo`, `pasta`, `tags`, `corpo`' : '`titulo`, `tags`, `corpo`';

export function buildQuestions(tax: Taxonomia, comPasta = false, lang: Lang = 'pt'): Record<string, ChoiceQuestion> {
	const t = PROMPTS[lang];
	const questions: Record<string, ChoiceQuestion> = {};
	const campos = camposState(comPasta);

	const criteria: Record<string, string> = {};
	for (const c of tax.categorias) criteria[c.nome] = c.desc;
	criteria[t.nenhuma] = t.nenhumaDesc;
	questions.categoria = {
		type: 'choice',
		instructions: t.categoria(campos),
		criteria,
	};

	// Ids de pergunta não chegam ao modelo: o texto precisa ser autossuficiente.
	for (const c of tax.categorias) {
		const sub: Record<string, string> = {};
		for (const g of c.generos) sub[g.nome] = g.desc;
		questions[generoQuestionId(c)] = {
			type: 'choice',
			instructions: t.genero(c.nome, campos),
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
	/** Caminho da pasta da nota; ausente = não enviar. */
	folder?: string;
}

export function buildState(note: NoteInput, maxChars: number): JevState {
	return {
		titulo: note.basename,
		...(note.folder !== undefined && { pasta: note.folder }),
		tags: normalizeTags(note.frontmatter?.tags),
		corpo: stripFrontmatter(note.content).slice(0, Math.max(0, maxChars)),
	};
}

export function buildRequest(
	tax: Taxonomia,
	note: NoteInput,
	model: string,
	maxChars: number,
	lang: Lang = 'pt',
): JevRequest {
	return {
		model,
		state: buildState(note, maxChars),
		questions: buildQuestions(tax, note.folder !== undefined, lang),
	};
}

/** Notas .md em subpastas de `base` → raiz de `base`. Destino já ocupado vira conflito (não move). */
export function planejarAchatar(paths: string[], base: string) {
	const prefix = base.replace(/\/+$/, '') + '/';
	const naRaiz = (p: string) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/');
	const ocupados = new Set(paths.filter(naRaiz).map((p) => p.toLowerCase()));
	const mover: { de: string; para: string }[] = [];
	const conflitos: string[] = [];
	for (const p of paths) {
		if (!p.startsWith(prefix) || naRaiz(p) || !p.endsWith('.md')) continue;
		const para = prefix + p.split('/').pop();
		if (ocupados.has(para.toLowerCase())) conflitos.push(p);
		else {
			ocupados.add(para.toLowerCase());
			mover.push({ de: p, para });
		}
	}
	return { mover, conflitos };
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
export function parseResponse(tax: Taxonomia, res: JevResponse, lang: Lang = 'pt'): Resultado | null {
	const cat = answer(res, 'categoria');
	if (cat.choice === PROMPTS[lang].nenhuma) return null;
	const winner = tax.categorias.find((c) => c.nome === cat.choice);
	if (!winner) throw new Error(`categoria desconhecida: ${cat.choice}`);

	const gen = answer(res, generoQuestionId(winner));
	if (!winner.generos.some((g) => g.nome === gen.choice))
		throw new Error(`gênero desconhecido em ${winner.nome}: ${gen.choice}`);

	const pares: Par[] = [];
	for (const c of tax.categorias) {
		const pCat = prob(cat, c.nome);
		if (pCat <= 0) continue;
		const g = res.answers?.[generoQuestionId(c)];
		if (g?.type !== 'choice' || !g.probabilities) continue;
		for (const sub of c.generos) {
			const pGen = prob(g, sub.nome);
			if (pGen > 0)
				pares.push({ categoria: c.nome, genero: sub.nome, pCategoria: pCat, pGenero: pGen });
		}
	}
	pares.sort((a, b) => b.pCategoria * b.pGenero - a.pCategoria * a.pGenero);

	return {
		melhor: {
			categoria: winner.nome,
			genero: gen.choice,
			pCategoria: prob(cat, winner.nome),
			pGenero: prob(gen, gen.choice),
			confCategoria: cat.confidence,
			confGenero: gen.confidence,
		},
		top3: pares.slice(0, 3),
	};
}

export function precisaConfirmar(r: Resultado, limiar: number): boolean {
	// Arredonda como o modal mostra: o que você vê é o que decide.
	return Math.round(r.melhor.pCategoria * r.melhor.pGenero * 100) / 100 < limiar;
}
