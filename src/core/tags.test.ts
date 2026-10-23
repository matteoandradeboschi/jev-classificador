import { describe, expect, it } from 'vitest';
import { aplicarTags, gerarTags, parseExcecoes, prefixoPasta, slug } from './tags';

const exc = { lugares: 'lugar' };

describe('slug / prefixoPasta', () => {
	it('kebab-case sem acento', () => {
		expect(slug('Desenvolvimento Pessoal')).toBe('desenvolvimento-pessoal');
		expect(slug('ciência')).toBe('ciencia');
	});
	it.each([
		['1-conceitos/Web 3.0.md', 'conceito'],
		['1-recursos/sub/x.md', 'recurso'],
		['4-lugares/Roma.md', 'lugar'],
		['3-carreira/x.md', 'carreira'],
		['0-investigaçao gol/x.md', 'investigacao-gol'],
	])('%s → %s', (path, pref) => expect(prefixoPasta(path, exc)).toBe(pref));
	it('nota na raiz: null', () => expect(prefixoPasta('Solta.md', exc)).toBeNull());
});

describe('gerarTags', () => {
	it('padrão: pasta/gênero', () => {
		expect(gerarTags('1-conceitos/Web 3.0.md', { categoria: 'tecnologia', genero: 'inteligência artificial' }, exc)).toEqual({
			prefixo: 'conceito',
			tags: ['conceito/inteligencia-artificial'],
		});
	});
	it('gênero ausente: erro mesmo com categoria', () => {
		expect(gerarTags('1-conceitos/x.md', { categoria: 'tecnologia' }, exc)).toEqual({ erro: 'sem-categoria' });
	});
	it('pasta/categoria', () => {
		expect(gerarTags('1-conceitos/Web 3.0.md', { categoria: 'tecnologia' }, exc, 'categoria')).toEqual({
			prefixo: 'conceito',
			tags: ['conceito/tecnologia'],
		});
	});
	it('ai-generated: 2 tags', () => {
		const r = gerarTags('1-recursos/x.md', { categoria: 'desenvolvimento pessoal', 'ai-generated': true }, exc, 'categoria');
		expect(r).toEqual({ prefixo: 'recurso', tags: ['ai-generated', 'recurso/desenvolvimento-pessoal'] });
	});
	it('ai-generated false: 1 tag', () => {
		const r = gerarTags('1-recursos/x.md', { categoria: 'saúde', 'ai-generated': false }, exc, 'categoria');
		expect(r).toEqual({ prefixo: 'recurso', tags: ['recurso/saude'] });
	});
	it.each([null, {}, { categoria: 'nenhuma' }, { categoria: '  ' }])('sem categoria (%j)', (fm) => {
		expect(gerarTags('1-conceitos/x.md', fm, exc, 'categoria')).toEqual({ erro: 'sem-categoria' });
	});
	it('raiz', () => expect(gerarTags('x.md', { categoria: 'artes' }, exc, 'categoria')).toEqual({ erro: 'raiz' }));
});

describe('aplicarTags', () => {
	it('troca só as do prefixo, mantém o resto', () => {
		expect(
			aplicarTags(['projeto/x', 'recurso/ai-generated', 'Recurso/velha'], 'recurso', ['recurso/tecnologia']),
		).toEqual(['projeto/x', 'recurso/tecnologia']);
	});
	it('sobrescreve a tag só com o prefixo (sem categoria)', () => {
		expect(aplicarTags(['conceito', 'conceitos'], 'conceito', ['conceito/tecnologia'])).toEqual([
			'conceitos',
			'conceito/tecnologia',
		]);
	});
	it('ai-generated sem pasta: some se a checkbox for desmarcada', () => {
		expect(aplicarTags(['ai-generated', 'x'], 'recurso', ['recurso/saude'])).toEqual(['x', 'recurso/saude']);
	});
	it('aceita string e vazio', () => {
		expect(aplicarTags('#a, b', 'conceito', ['conceito/artes'])).toEqual(['a', 'b', 'conceito/artes']);
		expect(aplicarTags(undefined, 'conceito', ['conceito/artes'])).toEqual(['conceito/artes']);
	});
	it('é idempotente', () => {
		const uma = aplicarTags(['x'], 'conceito', ['conceito/artes']);
		expect(aplicarTags(uma, 'conceito', ['conceito/artes'])).toEqual(uma);
	});
});

describe('parseExcecoes', () => {
	it('linhas pasta=prefixo, ignora lixo', () => {
		expect(parseExcecoes('Lugares = lugar\n\nsem-igual\n=x')).toEqual({ lugares: 'lugar' });
	});
});
