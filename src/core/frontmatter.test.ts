import { describe, expect, it } from 'vitest';
import { ordenarBloco } from './frontmatter';

const ordem = (f: Record<string, unknown>) => {
	ordenarBloco(f);
	return Object.keys(f);
};

describe('ordenarBloco', () => {
	it('tags no meio: bloco vai para a posição da primeira chave', () => {
		expect(ordem({ data: 1, tags: [], 'ai-generated': true, categoria: 'x', genero: 'y' })).toEqual([
			'data',
			'categoria',
			'genero',
			'tags',
			'ai-generated',
		]);
	});
	it('chaves novas (no fim) entram antes de tags existente', () => {
		expect(ordem({ data: 1, tags: [], fonte: 'z', categoria: 'x', genero: 'y' })).toEqual([
			'data',
			'categoria',
			'genero',
			'tags',
			'fonte',
		]);
	});
	it('só tags: nada muda', () => {
		expect(ordem({ data: 1, tags: [], b: 2 })).toEqual(['data', 'tags', 'b']);
	});
	it('mantém os valores', () => {
		const f = { tags: ['a'], genero: 'g', categoria: 'c' };
		ordenarBloco(f);
		expect(f).toEqual({ categoria: 'c', genero: 'g', tags: ['a'] });
	});
});
