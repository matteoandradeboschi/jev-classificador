import { beforeEach, describe, expect, it } from 'vitest';
import JevClassificador from '../src/main';
import { listarTags, tagQuestionId } from '../src/core/tagsAssunto';
import type { TaxTags } from '../src/core/types';
import taxTags from '../src/taxonomia-tags.json';
import { setLang } from '../src/i18n';
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
	plugin.settings.excludedFolders = ['1-diario', '4-pessoas'];
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
					categoria: probs('tecnologia'),
					genero_tecnologia: probs('programação'),
				},
			},
		};
		const { plugin, written } = await setup({ key: 'k' });
		await plugin.run(new TFile('2-estudos/Pentest.md'));
		expect(requests).toHaveLength(1);
		expect(JSON.parse(requests[0]!.body).state.titulo).toBe('Pentest');
		expect(JSON.parse(requests[0]!.body).state).not.toHaveProperty('pasta');
		expect(written).toEqual([{ genero: 'programação', categoria: 'tecnologia' }]);
		expect(notices.at(-1)).toBe('Jev: tecnologia · programação (conf. 0.95 / 0.95)');
	});

	it('pasta nunca sai', async () => {
		state.response = { status: 401, text: '', json: null };
		const { plugin } = await setup({ key: 'k' });
		await plugin.run(new TFile('1-conceitos/carreira/Networking.md'));
		const body = JSON.parse(requests[0]!.body);
		expect(body.state).not.toHaveProperty('pasta');
		expect(body.questions.categoria.instructions).not.toContain('`pasta`');
	});
});

describe('fluxo gerarTags() (Alt+T)', () => {
	it('não chama a API e troca só as tags do prefixo', async () => {
		const { plugin, reads, written } = await setup({
			fm: { categoria: 'tecnologia', genero: 'programação', 'ai-generated': true },
		});
		const fm: Record<string, unknown> = { tags: ['projeto/x', 'recurso/velha'] };
		(plugin.app as any).fileManager.processFrontMatter = (_f: TFile, fn: (x: Record<string, unknown>) => void) => {
			fn(fm);
			written.push(fm);
			return Promise.resolve();
		};
		await plugin.gerarTags(new TFile('1-recursos/O que aprender.md'));
		expect(requests).toEqual([]);
		expect(reads).toEqual([]);
		expect(fm.tags).toEqual(['projeto/x', 'ai-generated', 'recurso/programacao']);
		expect(notices.at(-1)).toBe('Tags: #ai-generated #recurso/programacao');
	});

	it('sem categoria: avisa e não grava', async () => {
		const { plugin, written } = await setup({ fm: {} });
		await plugin.gerarTags(new TFile('1-conceitos/x.md'));
		expect(written).toEqual([]);
		expect(notices.at(-1)).toBe('Tags: nota sem gênero — classifique antes (Alt+C)');
	});

	it('pasta privada: ignora', async () => {
		const { plugin, written } = await setup({ fm: { categoria: 'artes', genero: 'música' } });
		await plugin.gerarTags(new TFile('4-pessoas/Ana.md'));
		expect(written).toEqual([]);
		expect(notices.at(-1)).toBe('Tags: pasta privada, ignorada');
	});
});

describe('fluxo gerarTagsAssunto() (Alt+A)', () => {
	/** Roda o Alt+A com resposta noul: p 0.1 para tudo, menos as tags em `over`. */
	async function rodar(fmTags: unknown, over: Record<string, number>, path = '1-recursos/Comandos Basicos Linux.md') {
		const { plugin, reads, written } = await setup({ key: 'k', fm: { tags: fmTags } });
		const answers: Record<string, unknown> = {};
		for (const t of listarTags(taxTags as unknown as TaxTags)) answers[tagQuestionId(t)] = { type: 'noul', noul: over[t.tag] ?? 0.1 };
		state.response = { status: 200, text: '', json: { answers } };
		const fm: Record<string, unknown> = { tags: fmTags };
		(plugin.app as any).fileManager.processFrontMatter = (_f: TFile, fn: (x: Record<string, unknown>) => void) => {
			fn(fm);
			written.push(fm);
			return Promise.resolve();
		};
		await plugin.gerarTagsAssunto(new TFile(path));
		return { reads, written, fm };
	}

	it('pasta privada: nada lido, nada enviado', async () => {
		const { plugin, reads, written } = await setup({ key: 'k' });
		await plugin.gerarTagsAssunto(new TFile('1-diario/2026-10-22.md'));
		expect(reads).toEqual([]);
		expect(requests).toEqual([]);
		expect(written).toEqual([]);
		expect(notices).toEqual(['Tags: pasta privada, não enviado']);
	});

	it('confiante: grava as tags de assunto e mantém as outras', async () => {
		const { fm } = await rodar(['recurso/linux', 'ai-generated'], { linux: 0.95, tutorial: 0.8, redes: 0.3 });
		expect(requests).toHaveLength(1);
		const body = JSON.parse(requests[0]!.body);
		expect(Object.keys(body.questions)).toHaveLength(77);
		expect(body.state.tags).toEqual(['recurso/linux', 'ai-generated']);
		expect(fm.tags).toEqual(['recurso/linux', 'ai-generated', 'linux', 'tutorial']);
		expect(notices.at(-1)).toBe('Tags: #linux #tutorial (0.95 / 0.80)');
	});

	it('já tem tag de assunto: pede confirmação; cancelado → nada sai', async () => {
		const { reads, written } = await rodar(['ia'], { linux: 0.95 });
		expect(reads).toEqual([]);
		expect(requests).toEqual([]);
		expect(written).toEqual([]);
	});

	it('nenhuma acima do limiar: abre escolha; cancelado → nada gravado', async () => {
		const { written } = await rodar([], {});
		expect(requests).toHaveLength(1);
		expect(written).toEqual([]);
	});

	it('Alt+T em 3-carreira mantém #carreira', async () => {
		const { plugin } = await setup({ fm: { categoria: 'trabalho', genero: 'emprego' } });
		const fm: Record<string, unknown> = { tags: ['carreira', 'carreira/velha'] };
		(plugin.app as any).fileManager.processFrontMatter = (_f: TFile, fn: (x: Record<string, unknown>) => void) => {
			fn(fm);
			return Promise.resolve();
		};
		await plugin.gerarTags(new TFile('3-carreira/GOL 994.md'));
		expect(fm.tags).toEqual(['carreira', 'carreira/emprego']);
	});
});

describe('idioma EN', () => {
	it('run(): request com taxonomia EN, grava rótulos EN e avisa em EN', async () => {
		const probs = (k: string) => ({ type: 'choice', choice: k, probabilities: { [k]: 0.95 }, confidence: 0.95 });
		state.response = {
			status: 200,
			text: '',
			json: { answers: { categoria: probs('technology'), genero_tecnologia: probs('programming') } },
		};
		const { plugin, written } = await setup({ key: 'k' });
		plugin.settings.lang = 'en';
		setLang('en');
		await plugin.run(new TFile('2-estudos/Pentest.md'));
		const body = JSON.parse(requests[0]!.body);
		expect(body.questions.categoria.criteria).toHaveProperty('none');
		expect(written).toEqual([{ genero: 'programming', categoria: 'technology' }]);
		expect(notices).toEqual(['Jev: classifying…', 'Jev: technology · programming (conf. 0.95 / 0.95)']);
	});

	it('pasta privada: aviso em EN', async () => {
		const { plugin } = await setup({ key: 'k' });
		plugin.settings.lang = 'en';
		setLang('en');
		await plugin.run(new TFile('1-diario/x.md'));
		expect(notices).toEqual(['Jev: private folder, nothing sent']);
	});

	it('sem lang salvo: segue o idioma do Obsidian (stub pt-BR → pt)', async () => {
		const { plugin } = await setup();
		expect(plugin.settings.lang).toBe('pt');
	});
});
