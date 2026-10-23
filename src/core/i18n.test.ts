import { describe, expect, it } from 'vitest';
import taxPt from '../taxonomia.json';
import taxEn from '../taxonomia.en.json';
import tagsPt from '../taxonomia-tags.json';
import tagsEn from '../taxonomia-tags.en.json';
import { buildRequest, parseResponse } from './jev';
import { gerarTags } from './tags';
import { aplicarTagsAssunto, buildTagRequest, listarTags, parseTagResponse, tagQuestionId, wordlist } from './tagsAssunto';
import { ChoiceAnswer, ChoiceQuestion, JevResponse, Taxonomia, TaxTags } from './types';

const pt = taxPt as unknown as Taxonomia;
const en = taxEn as unknown as Taxonomia;
const tpt = tagsPt as unknown as TaxTags;
const ten = tagsEn as unknown as TaxTags;

const ans = (probs: Record<string, number>): ChoiceAnswer => ({
	type: 'choice',
	choice: Object.entries(probs).sort((a, b) => b[1] - a[1])[0]![0],
	probabilities: probs,
	confidence: 0.9,
});
const note = { basename: 'Linux', content: 'ls cd', folder: '1-recursos' };

describe('taxonomia.en.json', () => {
	it('mesmos ids e estrutura que a PT, rótulos e desc traduzidos', () => {
		const ids = (t: Taxonomia) => t.categorias.map((c) => [c.id, c.generos.map((g) => g.id)]);
		expect(ids(en)).toEqual(ids(pt));
		const cs = en.categorias.find((c) => c.id === 'tecnologia')!;
		expect(cs.nome).toBe('technology');
		expect(cs.generos.find((g) => g.id === 'tecnologia_geral')!.nome).toBe('general');
		for (const c of en.categorias) {
			expect(new Set(c.generos.map((g) => g.nome)).size).toBe(c.generos.length);
			for (const g of c.generos) expect(g.desc).not.toBe(pt.categorias.find((x) => x.id === c.id)!.generos.find((x) => x.id === g.id)!.desc);
		}
	});
});

describe('taxonomia-tags.en.json', () => {
	it('mesma estrutura (facetas, grupos, regras), 77 tags únicas kebab-case', () => {
		const forma = (t: TaxTags) => t.facetas.map((f) => [f.id, f.grupos.map((g) => g.tags.length)]);
		expect(forma(ten)).toEqual(forma(tpt));
		expect(ten.regras.max_total).toBe(tpt.regras.max_total);
		expect(ten.regras.max_por_faceta).toEqual(tpt.regras.max_por_faceta);
		expect(wordlist(ten).size).toBe(77);
		for (const t of listarTags(ten)) expect(t.tag).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
	});
	it('tag igual nos dois idiomas tem o mesmo sentido (mesma posição)', () => {
		const a = listarTags(tpt);
		const b = listarTags(ten);
		a.forEach((t, i) => {
			const j = b.findIndex((x) => x.tag === t.tag);
			if (j >= 0) expect(j).toBe(i);
		});
	});
});

describe('Alt+C em inglês', () => {
	const req = buildRequest(en, note, 'm', 100, 'en');
	it('request com rótulos, desc, "none" e instruções em EN', () => {
		const q = req.questions.categoria! as ChoiceQuestion;
		expect(q.criteria['technology']).toContain('applied computing');
		expect(q.criteria['none']).toBeTruthy();
		expect(q.criteria).not.toHaveProperty('nenhuma');
		expect(q.instructions).toMatch(/^Which broad field/);
		expect(req.questions['genero_tecnologia']!.instructions).toContain('"technology"');
		expect(req.questions['genero_tecnologia']!.criteria).toHaveProperty('infrastructure');
	});
	it('parse devolve rótulos EN; "none" → null', () => {
		const r = parseResponse(
			en,
			{ answers: { categoria: ans({ technology: 0.9, none: 0.1 }), genero_tecnologia: ans({ infrastructure: 0.8, programming: 0.2 }) } },
			'en',
		)!;
		expect(r.melhor).toMatchObject({ categoria: 'technology', genero: 'infrastructure' });
		expect(r.top3[1]).toMatchObject({ categoria: 'technology', genero: 'programming' });
		expect(parseResponse(en, { answers: { categoria: ans({ none: 0.9, technology: 0.1 }) } }, 'en')).toBeNull();
	});
	it('rótulo PT numa resposta EN lança', () => {
		expect(() => parseResponse(en, { answers: { categoria: ans({ tecnologia: 0.9 }) } }, 'en')).toThrow();
	});
	it('PT continua o padrão', () => {
		expect(buildRequest(pt, note, 'm', 100).questions.categoria!.criteria).toHaveProperty('nenhuma');
	});
});

describe('Alt+A em inglês', () => {
	const ambas = new Set([...wordlist(tpt), ...wordlist(ten)]);
	it('perguntas em EN; state sem tags de assunto de nenhum idioma', () => {
		const req = buildTagRequest(ten, { ...note, frontmatter: { tags: ['ia', 'ai', 'projeto/x'] } }, 'm', 100, 'en', ambas);
		expect(req.questions['tag_linux']!.instructions).toMatch(/^Topic "linux"/);
		expect(req.questions['forma_tutorial']!.instructions).toMatch(/^Form "tutorial"/);
		expect(req.questions['tag_linux']!.criteria.true).toMatch(/^The topic/);
		expect(req.state.tags).toEqual(['projeto/x']);
	});
	it('parse com ids EN', () => {
		const answers: JevResponse['answers'] = {};
		for (const t of listarTags(ten)) answers[tagQuestionId(t)] = { type: 'noul', noul: t.tag === 'ai' ? 0.9 : 0.1 };
		expect(parseTagResponse(ten, { answers })[0]).toEqual({ tag: 'ai', faceta: 'tema', p: 0.9 });
	});
	it('trocar de idioma substitui as tags de assunto antigas (PT) pelas novas (EN)', () => {
		expect(aplicarTagsAssunto(['ia', 'tutorial', 'projeto/x'], ['ai', 'tutorial'], ambas)).toEqual(['projeto/x', 'ai', 'tutorial']);
	});
});

describe('Alt+T', () => {
	it('"none" também conta como sem categoria', () => {
		expect(gerarTags('1-x/a.md', { genero: 'none' }, {})).toEqual({ erro: 'sem-categoria' });
	});
});
