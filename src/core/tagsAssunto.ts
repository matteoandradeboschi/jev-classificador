// Alt+A: tags planas de assunto escolhidas pelo Jev numa wordlist fechada (1 pergunta noul por tag).
import { buildState, camposState, NoteInput, normalizeTags } from './jev';
import { Lang, PROMPTS } from './prompts';
import { CandidatoTag, JevRequest, JevResponse, NoulQuestion, TagDef, TaxTags } from './types';

const CANDIDATOS = 6;

export interface TagDaTax extends TagDef {
	faceta: string;
}

export function listarTags(tax: TaxTags): TagDaTax[] {
	return tax.facetas.flatMap((f) => f.grupos.flatMap((g) => g.tags.map((t) => ({ ...t, faceta: f.id }))));
}

export const wordlist = (tax: TaxTags): Set<string> => new Set(listarTags(tax).map((t) => t.tag.toLowerCase()));

/** "tema" + "gestao-do-conhecimento" → "tag_gestao_do_conhecimento"; forma → "forma_tutorial". */
export const tagQuestionId = (t: TagDaTax) => `${t.faceta === 'tema' ? 'tag' : t.faceta}_${t.tag.replace(/-/g, '_')}`;

export function buildTagQuestions(tax: TaxTags, comPasta = false, lang: Lang = 'pt'): Record<string, NoulQuestion> {
	const p = PROMPTS[lang];
	const campos = camposState(comPasta);
	const questions: Record<string, NoulQuestion> = {};
	// Ids de pergunta não chegam ao modelo: o texto repete a tag e a descrição.
	for (const t of listarTags(tax)) {
		questions[tagQuestionId(t)] =
			t.faceta === 'tema'
				? {
						type: 'noul',
						instructions: p.tema(t.tag, t.desc, campos),
						criteria: { true: p.temaSim, false: p.temaNao },
					}
				: {
						type: 'noul',
						instructions: p.forma(t.tag, t.desc, campos),
						criteria: { true: p.formaSim, false: p.formaNao },
					};
	}
	return questions;
}

/** Igual ao state do Alt+C, mas sem as tags da wordlist `wl` (o resultado anterior não enviesa o novo). */
export function buildTagRequest(
	tax: TaxTags,
	note: NoteInput,
	model: string,
	maxChars: number,
	lang: Lang = 'pt',
	wl: ReadonlySet<string> = wordlist(tax),
): JevRequest {
	const state = buildState(note, maxChars);
	return {
		model,
		state: { ...state, tags: state.tags.filter((t) => !wl.has(t.toLowerCase())) },
		questions: buildTagQuestions(tax, note.folder !== undefined, lang),
	};
}

/** p de todas as tags, ordenado desc. Lança se faltar resposta ou vier fora de [0,1]. */
export function parseTagResponse(tax: TaxTags, res: JevResponse): CandidatoTag[] {
	const out = listarTags(tax).map((t) => {
		const id = tagQuestionId(t);
		const a = res.answers?.[id];
		// !(x >= 0 && x <= 1) também barra NaN.
		if (!a || a.type !== 'noul' || typeof a.noul !== 'number' || !(a.noul >= 0 && a.noul <= 1))
			throw new Error(`resposta ausente ou inválida: ${id}`);
		return { tag: t.tag, faceta: t.faceta, p: a.noul };
	});
	return out.sort((a, b) => b.p - a.p);
}

/** Pode marcar `c` sem passar de max_total nem do máximo da faceta? */
export function podeMarcar(tax: TaxTags, marcadas: CandidatoTag[], c: CandidatoTag): boolean {
	const { max_total, max_por_faceta } = tax.regras;
	const naFaceta = marcadas.filter((m) => m.faceta === c.faceta).length;
	return marcadas.length < max_total && naFaceta < (max_por_faceta[c.faceta] ?? max_total);
}

/** Ordem de gravação: temas e depois forma, cada grupo por p desc. */
export function ordenarEscolhidas(tags: CandidatoTag[]): CandidatoTag[] {
	const porP = [...tags].sort((a, b) => b.p - a.p);
	return [...porP.filter((t) => t.faceta === 'tema'), ...porP.filter((t) => t.faceta !== 'tema')];
}

/** Só p ≥ limiar (arredondado como é mostrado), respeitando max_total e max_por_faceta. */
export function escolherTags(
	tax: TaxTags,
	candidatos: CandidatoTag[],
	limiar: number,
): { escolhidas: CandidatoTag[]; candidatos: CandidatoTag[] } {
	const passa = (c: CandidatoTag) => Math.round(c.p * 100) / 100 >= limiar;
	const ordenados = [...candidatos].sort((a, b) => b.p - a.p);
	const escolhidas: CandidatoTag[] = [];
	// Forma primeiro: ela reserva a vaga dela antes dos temas preencherem max_total.
	for (const c of ordenados) if (c.faceta !== 'tema' && passa(c) && podeMarcar(tax, escolhidas, c)) escolhidas.push(c);
	for (const c of ordenados) if (c.faceta === 'tema' && passa(c) && podeMarcar(tax, escolhidas, c)) escolhidas.push(c);
	return { escolhidas: ordenarEscolhidas(escolhidas), candidatos: ordenados.slice(0, CANDIDATOS) };
}

/** Tags da wordlist que a nota já tem. */
export function tagsAssuntoAtuais(atuais: unknown, wl: ReadonlySet<string>): string[] {
	return normalizeTags(atuais).filter((t) => wl.has(t.toLowerCase()));
}

/** Tira as tags da wordlist, mantém o resto na ordem e acrescenta as novas no fim, sem duplicar. */
export function aplicarTagsAssunto(atuais: unknown, novas: string[], wl: ReadonlySet<string>): string[] {
	const resto = normalizeTags(atuais).filter((t) => !wl.has(t.toLowerCase()));
	const vistas = new Set(resto.map((t) => t.toLowerCase()));
	const out = [...resto];
	for (const t of novas)
		if (!vistas.has(t.toLowerCase())) {
			vistas.add(t.toLowerCase());
			out.push(t);
		}
	return out;
}
