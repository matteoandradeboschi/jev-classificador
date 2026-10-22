import { beforeEach, describe, expect, it } from 'vitest';
import JevClassificador from '../src/main';
import { notices, requests, state, TFile } from './obsidian-stub';

interface Opts {
	key?: string | null;
	fm?: Record<string, unknown>;
}

async function setup({ key = null, fm }: Opts = {}) {
	const reads: string[] = [];
	const written: Record<string, unknown>[] = [];
	const app = {
		secretStorage: { getSecret: () => key },
		metadataCache: { getFileCache: () => ({ frontmatter: fm }) },
		vault: {
			cachedRead: (f: TFile) => {
				reads.push(f.path);
				return Promise.resolve('texto da nota');
			},
		},
		fileManager: {
			processFrontMatter: (_f: TFile, fn: (x: Record<string, unknown>) => void) => {
				const o: Record<string, unknown> = {};
				fn(o);
				written.push(o);
				return Promise.resolve();
			},
		},
	};
	const plugin = new JevClassificador(app as never);
	await plugin.loadSettings();
	return { plugin, reads, written };
}

beforeEach(() => {
	notices.length = 0;
	requests.length = 0;
	state.response = { status: 200, text: '', json: null };
});

describe('fluxo run()', () => {
	it.each(['1-diario/2026-10-22.md', '4-pessoas/Ana.md', '1-Diario/sub/x.md'])(
		'pasta privada %s: nada lido, nada enviado, nem com chave',
		async (path) => {
			const { plugin, reads, written } = await setup({ key: 'sk-test' });
			await plugin.run(new TFile(path));
			expect(reads).toEqual([]);
			expect(requests).toEqual([]);
			expect(written).toEqual([]);
			expect(notices).toEqual(['Jev: pasta privada, não enviado']);
		},
	);

	it('sem chave: avisa, nada sai', async () => {
		const { plugin, reads } = await setup({ key: null });
		await plugin.run(new TFile('2-estudos/Pentest.md'));
		expect(notices).toEqual(['Jev: configure a chave TypeSafe']);
		expect(reads).toEqual([]);
		expect(requests).toEqual([]);
	});

	it('chave inválida (401): notice claro, nada gravado', async () => {
		state.response = { status: 401, text: 'unauthorized', json: null };
		const { plugin, written } = await setup({ key: 'ruim' });
		await plugin.run(new TFile('2-estudos/Pentest.md'));
		expect(requests).toHaveLength(1);
		expect(requests[0]!.headers.Authorization).toBe('Bearer ruim');
		expect(notices).toContain('Jev: chave TypeSafe inválida — veja as configurações');
		expect(written).toEqual([]);
	});

	it('não-.md: ignora', async () => {
		const { plugin } = await setup({ key: 'k' });
		const f = new TFile('x.pdf');
		f.extension = 'pdf';
		await plugin.run(f);
		expect(requests).toEqual([]);
	});

	it('resposta confiante: grava só genero e categoria', async () => {
		const probs = (k: string) => ({ type: 'choice', choice: k, probabilities: { [k]: 0.95 }, confidence: 0.95 });
		state.response = {
			status: 200,
			text: '',
			json: {
				answers: {
					categoria: probs('ciência da computação'),
					genero_17: probs('software'),
				},
			},
		};
		const { plugin, written } = await setup({ key: 'k' });
		await plugin.run(new TFile('2-estudos/Pentest.md'));
		expect(requests).toHaveLength(1);
		expect(JSON.parse(requests[0]!.body).state.titulo).toBe('Pentest');
		expect(written).toEqual([{ genero: 'software', categoria: 'ciência da computação' }]);
		expect(notices.at(-1)).toBe('Jev: software · ciência da computação (conf. 0.95 / 0.95)');
	});
});
