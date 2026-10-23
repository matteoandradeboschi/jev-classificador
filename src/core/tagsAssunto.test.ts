import { describe, expect, it } from 'vitest';
import taxJson from '../taxonomia-tags.json';
import {
	aplicarTagsAssunto,
	buildTagRequest,
	escolherTags,
	listarTags,
	parseTagResponse,
	podeMarcar,
	tagQuestionId,
	tagsAssuntoAtuais,
	wordlist,
} from './tagsAssunto';
import { CandidatoTag, JevResponse, TaxTags } from './types';

const tax = taxJson as unknown as TaxTags;
const wl = wordlist(tax);
const todas = listarTags(tax);

const note = {
	basename: 'Comandos Basicos Linux',
	frontmatter: { tags: ['recurso/linux', 'linux', 'ai-generated'] },
	content: '---\ntags: [x]\n---\nls, cd, grep',
	folder: '1-recursos',
};

/** Resposta com p padrão `base` e algumas tags sobrescritas. */
function fake(over: Record<string, number> = {}, base = 0.1): JevResponse {
	const answers: JevResponse['answers'] = {};
	for (const t of todas) answers[tagQuestionId(t)] = { type: 'noul', noul: over[t.tag] ?? base };
	return { answers };
}

const cand = (tag: string, p: number, faceta = 'tema'): CandidatoTag => ({ tag, faceta, p });

describe('taxonomia-tags.json', () => {
	it('77 tags únicas, planas, kebab-case', () => {
		expect(todas).toHaveLength(77);
		expect(wl.size).toBe(77);
		for (const t of todas) expect(t.tag).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
	});
});

describe('buildTagRequest', () => {
	const req = buildTagRequest(tax, note, 'jev-latest', 1000);
	it('1 pergunta noul por tag, ids tag_/forma_', () => {
		const ids = Object.keys(req.questions);
		expect(ids).toHaveLength(77);
		expect(ids).toContain('tag_gestao_do_conhecimento');
		expect(ids).toContain('forma_tutorial');
		expect(Object.values(req.questions).every((q) => q.type === 'noul')).toBe(true);
	});
	it('texto repete tag e descrição; cita `pasta` só com pasta', () => {
		const q = req.questions['tag_linux']!;
		expect(q.instructions).toContain('"linux"');
		expect(q.instructions).toContain('terminal');
		expect(q.instructions).toContain('`pasta`');
		const sem = buildTagRequest(tax, { ...note, folder: undefined }, 'm', 1000);
		expect(sem.state).not.toHaveProperty('pasta');
		expect(sem.questions['tag_linux']!.instructions).not.toContain('`pasta`');
	});
	it('state.tags sem as tags da wordlist; corpo sem frontmatter', () => {
		expect(req.state.tags).toEqual(['recurso/linux', 'ai-generated']);
		expect(req.state.corpo).toBe('ls, cd, grep');
		expect(req.state.pasta).toBe('1-recursos');
	});
});

describe('parseTagResponse', () => {
	it('p de todas, ordenado desc', () => {
		const c = parseTagResponse(tax, fake({ linux: 0.9, tutorial: 0.7 }));
		expect(c).toHaveLength(77);
		expect(c[0]).toEqual({ tag: 'linux', faceta: 'tema', p: 0.9 });
		expect(c[1]).toEqual({ tag: 'tutorial', faceta: 'forma', p: 0.7 });
	});
	it('id faltando → erro', () => {
		const r = fake();
		delete r.answers['tag_ia'];
		expect(() => parseTagResponse(tax, r)).toThrow('tag_ia');
	});
	it.each([1.2, -0.1, NaN])('noul inválido (%s) → erro', (v) => {
		expect(() => parseTagResponse(tax, fake({ ia: v }))).toThrow('tag_ia');
	});
	it('tipo errado → erro', () => {
		const r = fake();
		r.answers['tag_ia'] = { type: 'choice', choice: 'x', probabilities: {}, confidence: 1 };
		expect(() => parseTagResponse(tax, r)).toThrow('tag_ia');
	});
});

describe('escolherTags', () => {
	const tags = (r: { escolhidas: CandidatoTag[] }) => r.escolhidas.map((c) => c.tag);

	it('só acima do limiar, temas por p e forma no fim', () => {
		const c = [cand('tutorial', 0.8, 'forma'), cand('linux', 0.9), cand('redes', 0.6), cand('ia', 0.4)];
		expect(tags(escolherTags(tax, c, 0.5))).toEqual(['linux', 'redes', 'tutorial']);
	});
	it('máx. 3 no total; forma reserva a vaga dela', () => {
		const c = [cand('a', 0.99), cand('b', 0.98), cand('c', 0.97), cand('d', 0.96), cand('resumo', 0.6, 'forma')];
		expect(tags(escolherTags(tax, c, 0.5))).toEqual(['a', 'b', 'resumo']);
	});
	it('sem forma: até 3 temas', () => {
		const c = [cand('a', 0.99), cand('b', 0.98), cand('c', 0.97), cand('d', 0.96)];
		expect(tags(escolherTags(tax, c, 0.5))).toEqual(['a', 'b', 'c']);
	});
	it('máx. 1 forma', () => {
		const c = [cand('resumo', 0.9, 'forma'), cand('tutorial', 0.8, 'forma'), cand('ia', 0.7)];
		expect(tags(escolherTags(tax, c, 0.5))).toEqual(['ia', 'resumo']);
	});
	it('arredonda como é mostrado: 0.495 → 0.50 passa', () => {
		expect(tags(escolherTags(tax, [cand('ia', 0.495)], 0.5))).toEqual(['ia']);
		expect(tags(escolherTags(tax, [cand('ia', 0.494)], 0.5))).toEqual([]);
	});
	it('nenhuma acima: vazio + 6 candidatos por p', () => {
		const r = escolherTags(tax, parseTagResponse(tax, fake({ ia: 0.4, linux: 0.3 })), 0.5);
		expect(r.escolhidas).toEqual([]);
		expect(r.candidatos).toHaveLength(6);
		expect(r.candidatos.slice(0, 2).map((c) => c.tag)).toEqual(['ia', 'linux']);
	});
});

describe('podeMarcar', () => {
	it('respeita total e faceta', () => {
		expect(podeMarcar(tax, [cand('resumo', 1, 'forma')], cand('tutorial', 1, 'forma'))).toBe(false);
		expect(podeMarcar(tax, [cand('resumo', 1, 'forma')], cand('ia', 1))).toBe(true);
		expect(podeMarcar(tax, [cand('a', 1), cand('b', 1), cand('c', 1)], cand('d', 1))).toBe(false);
	});
});

describe('aplicarTagsAssunto / tagsAssuntoAtuais', () => {
	it('troca só as da wordlist, mantém diretório e ai-generated na ordem', () => {
		expect(
			aplicarTagsAssunto(['conceito/x', 'IA', 'ai-generated', 'linux', 'manual'], ['redes', 'tutorial'], wl),
		).toEqual(['conceito/x', 'ai-generated', 'manual', 'redes', 'tutorial']);
	});
	it('não duplica (case-insensitive) e aceita string/vazio', () => {
		expect(aplicarTagsAssunto('#a, b', ['ia', 'ia'], wl)).toEqual(['a', 'b', 'ia']);
		expect(aplicarTagsAssunto(undefined, ['ia'], wl)).toEqual(['ia']);
	});
	it('é idempotente', () => {
		const uma = aplicarTagsAssunto(['x', 'ia'], ['linux'], wl);
		expect(aplicarTagsAssunto(uma, ['linux'], wl)).toEqual(uma);
	});
	it('tagsAssuntoAtuais', () => {
		expect(tagsAssuntoAtuais(['conceito/x', '#ia', 'carreira'], wl)).toEqual(['ia', 'carreira']);
	});
});
