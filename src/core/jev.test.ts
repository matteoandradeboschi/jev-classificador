import { describe, expect, it, vi } from 'vitest';
import taxJson from '../taxonomia.json';
import { classify, JevError, RawResponse } from './classify';
import {
	buildQuestions,
	buildRequest,
	isClassified,
	isExcluded,
	normalizeTags,
	parseResponse,
	precisaConfirmar,
	stripFrontmatter,
} from './jev';
import { ChoiceAnswer, JevRequest, JevResponse, Taxonomia } from './types';

const tax = taxJson as unknown as Taxonomia;
const cs = tax.categorias.find((c) => c.pt === 'ciência da computação')!;
const hum = tax.categorias.find((c) => c.pt === 'artes e humanidades')!;

function ans(probs: Record<string, number>, confidence: number): ChoiceAnswer {
	const choice = Object.entries(probs).sort((a, b) => b[1] - a[1])[0]![0];
	return { type: 'choice', choice, probabilities: probs, confidence };
}

function fakeResponse(over: Record<string, ChoiceAnswer> = {}): JevResponse {
	return {
		answers: {
			categoria: ans({ [cs.pt]: 0.8, [hum.pt]: 0.15, nenhuma: 0.05 }, 0.9),
			[`genero_${cs.id}`]: ans({ 'redes de computadores e comunicações': 0.7, software: 0.3 }, 0.8),
			[`genero_${hum.id}`]: ans({ filosofia: 0.9, história: 0.1 }, 0.9),
			...over,
		},
	};
}

const ok = (json: unknown): RawResponse => ({ status: 200, text: JSON.stringify(json), json });
const err = (status: number, text = ''): RawResponse => ({ status, text, json: null });

describe('buildQuestions', () => {
	const q = buildQuestions(tax);
	it('1 categoria + 26 gêneros', () => {
		expect(Object.keys(q)).toHaveLength(27);
		expect(q.categoria?.type).toBe('choice');
	});
	it('categoria inclui "nenhuma" e usa pt→en', () => {
		expect(Object.keys(q.categoria!.criteria)).toHaveLength(27);
		expect(q.categoria!.criteria['nenhuma']).toBeTruthy();
		expect(q.categoria!.criteria[cs.pt]).toBe(cs.en);
	});
	it('pergunta de gênero é autossuficiente e nomeia a categoria', () => {
		const g = q[`genero_${cs.id}`]!;
		expect(g.instructions).toContain(`"${cs.pt}"`);
		expect(Object.keys(g.criteria)).toHaveLength(cs.generos.length);
	});
	it('252 gêneros no total e ≤255 critérios por pergunta', () => {
		const total = tax.categorias.reduce((n, c) => n + c.generos.length, 0);
		expect(total).toBe(252);
		for (const v of Object.values(q)) expect(Object.keys(v.criteria).length).toBeLessThanOrEqual(255);
	});
});

describe('buildRequest', () => {
	it('monta state, tira frontmatter e trunca', () => {
		const r = buildRequest(
			tax,
			{
				basename: 'Pentest',
				frontmatter: { tags: ['a', '#b'] },
				content: '---\ntags: [a]\n---\n' + 'x'.repeat(50),
			},
			'jev-latest',
			10,
		);
		expect(r.model).toBe('jev-latest');
		expect(r.state).toEqual({ titulo: 'Pentest', tags: ['a', 'b'], corpo: 'x'.repeat(10) });
	});
	it('corpo vazio ainda gera requisição', () => {
		const r = buildRequest(tax, { basename: 'T', content: '' }, 'm', 100);
		expect(r.state.corpo).toBe('');
		expect(r.state.tags).toEqual([]);
	});
	it('stripFrontmatter só remove no início', () => {
		expect(stripFrontmatter('---\na: 1\n---\ncorpo\n---\nfim')).toBe('corpo\n---\nfim');
		expect(stripFrontmatter('sem fm')).toBe('sem fm');
		expect(stripFrontmatter('---\r\na: 1\r\n---\r\ncorpo')).toBe('corpo');
	});
	it('normalizeTags aceita string e lista', () => {
		expect(normalizeTags('a, #b c')).toEqual(['a', 'b', 'c']);
		expect(normalizeTags(undefined)).toEqual([]);
	});
});

describe('isExcluded', () => {
	const f = ['1-diario', '4-pessoas/'];
	it('bloqueia pastas e subpastas', () => {
		expect(isExcluded('1-diario/2026-10-22.md', f)).toBe(true);
		expect(isExcluded('4-pessoas/a/b.md', f)).toBe(true);
		expect(isExcluded('1-DIARIO/x.md', f)).toBe(true);
	});
	it('não bloqueia prefixos parecidos nem outras pastas', () => {
		expect(isExcluded('1-diario-extra/x.md', f)).toBe(false);
		expect(isExcluded('2-estudos/1-diario/x.md', f)).toBe(false);
	});
	it('linha vazia na lista não exclui tudo', () => {
		expect(isExcluded('qualquer.md', ['', '  '])).toBe(false);
	});
});

describe('isClassified', () => {
	it('exige os dois preenchidos', () => {
		expect(isClassified({ genero: 'x', categoria: 'y' })).toBe(true);
		expect(isClassified({ genero: 'x', categoria: '' })).toBe(false);
		expect(isClassified({ genero: 'x' })).toBe(false);
		expect(isClassified(null)).toBe(false);
	});
});

describe('parseResponse', () => {
	it('pega vencedor e ignora gêneros de outras categorias', () => {
		const r = parseResponse(tax, fakeResponse())!;
		expect(r.melhor).toMatchObject({
			categoria: cs.pt,
			genero: 'redes de computadores e comunicações',
			confCategoria: 0.9,
			confGenero: 0.8,
		});
	});
	it('top3 ordenado por p(cat)×p(gen|cat), com pares de categorias diferentes', () => {
		const r = parseResponse(tax, fakeResponse())!;
		expect(r.top3.map((p) => [p.categoria, p.genero])).toEqual([
			[cs.pt, 'redes de computadores e comunicações'], // .56
			[cs.pt, 'software'], // .24
			[hum.pt, 'filosofia'], // .135
		]);
	});
	it('"nenhuma" → null', () => {
		const r = parseResponse(tax, fakeResponse({ categoria: ans({ nenhuma: 0.9, [cs.pt]: 0.1 }, 0.9) }));
		expect(r).toBeNull();
	});
	it('resposta fora da taxonomia lança', () => {
		expect(() => parseResponse(tax, fakeResponse({ categoria: ans({ inventada: 1 }, 1) }))).toThrow();
		expect(() => parseResponse(tax, { answers: {} })).toThrow();
		expect(() =>
			parseResponse(tax, fakeResponse({ [`genero_${cs.id}`]: ans({ inventado: 1 }, 1) })),
		).toThrow();
	});
	it('precisaConfirmar: confiança de qualquer um abaixo do limiar', () => {
		const r = parseResponse(tax, fakeResponse())!;
		expect(precisaConfirmar(r, 0.6)).toBe(false);
		expect(precisaConfirmar(r, 0.85)).toBe(true); // confGenero 0.8
		const baixa = parseResponse(tax, fakeResponse({ categoria: ans({ [cs.pt]: 0.4, [hum.pt]: 0.35, nenhuma: 0.25 }, 0.3) }))!;
		expect(precisaConfirmar(baixa, 0.6)).toBe(true);
	});
});

describe('classify (retries e erros)', () => {
	const opts = { tax, note: { basename: 'T', content: 'c'.repeat(100) }, model: 'm', maxChars: 100 };
	const sleep = vi.fn(async () => {});

	it('sucesso direto', async () => {
		const send = vi.fn(async () => ok(fakeResponse()));
		const r = await classify({ send, sleep }, opts);
		expect(r?.melhor.genero).toBe('redes de computadores e comunicações');
		expect(send).toHaveBeenCalledTimes(1);
	});
	it('401 → auth, sem retry', async () => {
		const send = vi.fn(async () => err(401));
		await expect(classify({ send, sleep }, opts)).rejects.toMatchObject({ kind: 'auth' });
		expect(send).toHaveBeenCalledTimes(1);
	});
	it('429 ×2 depois ok: backoff 1s, 2s', async () => {
		sleep.mockClear();
		const send = vi
			.fn<() => Promise<RawResponse>>()
			.mockResolvedValueOnce(err(429))
			.mockResolvedValueOnce(err(529))
			.mockResolvedValueOnce(ok(fakeResponse()));
		await classify({ send, sleep }, opts);
		expect(sleep.mock.calls.map((c) => (c as unknown[])[0])).toEqual([1000, 2000]);
	});
	it('429 persistente → rate após 3 tentativas', async () => {
		const send = vi.fn(async () => err(429));
		await expect(classify({ send, sleep }, opts)).rejects.toMatchObject({ kind: 'rate' });
		expect(send).toHaveBeenCalledTimes(3);
	});
	it('max_tokens_exceeded → corpo pela metade, 1 vez só', async () => {
		const send = vi
			.fn<(r: JevRequest) => Promise<RawResponse>>()
			.mockResolvedValueOnce(err(400, '{"error":"max_tokens_exceeded"}'))
			.mockResolvedValueOnce(ok(fakeResponse()));
		await classify({ send, sleep }, opts);
		expect(send.mock.calls[0]![0].state.corpo).toHaveLength(100);
		expect(send.mock.calls[1]![0].state.corpo).toHaveLength(50);

		const always = vi.fn(async () => err(400, 'max_tokens_exceeded'));
		await expect(classify({ send: always, sleep }, opts)).rejects.toMatchObject({ kind: 'tokens' });
		expect(always).toHaveBeenCalledTimes(2);
	});
	it('422 e 500 viram erro com status', async () => {
		const v: RawResponse = { status: 422, text: '', json: { detail: [{ msg: 'Field required' }] } };
		await expect(classify({ send: async () => v, sleep }, opts)).rejects.toMatchObject({
			kind: 'validation',
			message: 'Field required',
		});
		await expect(classify({ send: async () => err(500, 'boom'), sleep }, opts)).rejects.toMatchObject({
			kind: 'http',
			status: 500,
		});
	});
	it('resposta mal formada → kind resposta', async () => {
		const e = await classify({ send: async () => ok({ answers: {} }), sleep }, opts).catch((x: unknown) => x);
		expect(e).toBeInstanceOf(JevError);
		expect((e as JevError).kind).toBe('resposta');
	});
});
