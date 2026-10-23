import { MarkdownView, Notice, Plugin, requestUrl, TFile } from 'obsidian';
import { classify, JevError, parseOuErro, RawResponse, sendWithRetry } from './core/classify';
import { isClassified, isExcluded, precisaConfirmar } from './core/jev';
import { ordenarBloco } from './core/frontmatter';
import { aplicarTags, gerarTags } from './core/tags';
import {
	aplicarTagsAssunto,
	buildTagRequest,
	escolherTags,
	parseTagResponse,
	tagsAssuntoAtuais,
	wordlist,
} from './core/tagsAssunto';
import type { CandidatoTag, JevRequest, Par, Taxonomia, TaxTags } from './core/types';
import type { Lang } from './core/prompts';
import taxJson from './taxonomia.json';
import taxEnJson from './taxonomia.en.json';
import taxTagsJson from './taxonomia-tags.json';
import taxTagsEnJson from './taxonomia-tags.en.json';
import { setLang, t, tEn } from './i18n';
import { DEFAULT_SETTINGS, JevSettings, JevSettingTab } from './settings';
import { ConfirmModal, ConfirmOverwriteModal, KeyModal, PickParModal, PickTagsModal } from './ui/modals';

const TAX: Record<Lang, Taxonomia> = { pt: taxJson, en: taxEnJson };
const TAX_TAGS: Record<Lang, TaxTags> = { pt: taxTagsJson, en: taxTagsEnJson };
// Wordlist dos dois idiomas: trocar o idioma não deixa tags de assunto antigas para trás.
const WORDLIST = new Set([...wordlist(TAX_TAGS.pt), ...wordlist(TAX_TAGS.en)]);
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

export default class JevClassificador extends Plugin {
	settings!: JevSettings;
	private handled = new WeakSet<MarkdownView>();
	private buttons: HTMLElement[] = [];
	private busy = false;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new JevSettingTab(this.app, this));

		this.addCommand({
			id: 'classificar',
			name: tEn().cmdClassificar,
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
				if (!file) return false;
				if (!checking) void this.run(file);
				return true;
			},
		});

		this.addCommand({
			id: 'gerar-tags',
			name: tEn().cmdGerarTags,
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
				if (!file) return false;
				if (!checking) void this.gerarTags(file);
				return true;
			},
		});

		this.addCommand({
			id: 'gerar-tags-assunto',
			name: tEn().cmdGerarTagsAssunto,
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
				if (!file) return false;
				if (!checking) void this.gerarTagsAssunto(file);
				return true;
			},
		});

		const attach = () => this.attachButtons();
		this.registerEvent(this.app.workspace.on('layout-change', attach));
		this.registerEvent(this.app.workspace.on('active-leaf-change', attach));
		this.app.workspace.onLayoutReady(() => {
			attach();
			void this.onboarding();
		});
	}

	/** 1ª ativação sem chave: pede a chave uma vez, sem esperar o primeiro uso. */
	private async onboarding() {
		if (this.settings.onboarded) return;
		this.settings.onboarded = true;
		await this.saveSettings();
		if (!this.app.secretStorage.getSecret(this.settings.apiKeySecret)) await this.pedirChave();
	}

	onunload() {
		for (const b of this.buttons) b.remove();
		this.buttons = [];
	}

	private attachButtons() {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView) || this.handled.has(view)) continue;
			this.handled.add(view);
			const btn = view.addAction('tags', t().tooltip, () => {
				if (view.file) void this.run(view.file);
			});
			this.buttons.push(btn);
		}
	}

	private setBusy(busy: boolean) {
		this.busy = busy;
		for (const b of this.buttons) {
			b.toggleClass('jev-busy', busy);
			b.setAttr('aria-disabled', String(busy));
		}
	}

	/** Abre o KeyModal; devolve a chave se o usuário configurou uma. */
	private async pedirChave(): Promise<string | null> {
		const nome = await new KeyModal(this.app, this.settings.apiKeySecret).ask();
		if (!nome) return null;
		this.settings.apiKeySecret = nome;
		await this.saveSettings();
		return this.app.secretStorage.getSecret(nome);
	}

	private async chave(): Promise<string | null> {
		const key = this.app.secretStorage.getSecret(this.settings.apiKeySecret);
		if (key) return key;
		new Notice(t().configureChave);
		return this.pedirChave();
	}

	private async send(req: JevRequest, key: string): Promise<RawResponse> {
		const res = await requestUrl({
			url: ENDPOINT,
			method: 'POST',
			headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(req),
			throw: false,
		});
		let json: unknown = null;
		try {
			json = res.json;
		} catch {
			/* corpo não-JSON */
		}
		return { status: res.status, text: res.text, json };
	}

	async run(file: TFile) {
		if (this.busy) return;
		if (file.extension !== 'md') return void new Notice(t().soMd('Jev'));
		// Antes de ler o arquivo: pasta privada nunca é lida nem enviada.
		if (isExcluded(file.path, this.settings.excludedFolders))
			return void new Notice(t().privadaNaoEnviado('Jev'));

		const key = await this.chave();
		if (!key) return;

		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? null;
		if (isClassified(fm)) {
			const ok = await new ConfirmOverwriteModal(this.app, {
				genero: String(fm?.genero),
				categoria: String(fm?.categoria),
			}).ask();
			if (!ok) return;
		}

		this.setBusy(true);
		new Notice(t().classificando);
		try {
			const content = await this.app.vault.cachedRead(file);
			const result = await classify(
				{ send: (r) => this.send(r, key), sleep: (ms) => new Promise((r) => window.setTimeout(r, ms)) },
				{
					tax: TAX[this.settings.lang],
					note: {
						basename: file.basename,
						frontmatter: fm,
						content,
					},
					model: this.settings.model,
					maxChars: this.settings.maxBodyChars,
					lang: this.settings.lang,
				},
			);
			if (!result) return void new Notice(t().nenhumaCategoria);

			let par: Par | null = {
				categoria: result.melhor.categoria,
				genero: result.melhor.genero,
				pCategoria: result.melhor.confCategoria,
				pGenero: result.melhor.confGenero,
			};
			if (precisaConfirmar(result, this.settings.threshold)) {
				par = await new PickParModal(this.app, result.top3, result.melhor, this.settings.threshold).ask();
				if (!par) return;
			}

			await this.app.fileManager.processFrontMatter(file, (f: Record<string, unknown>) => {
				f.categoria = par.categoria;
				f.genero = par.genero;
				ordenarBloco(f);
			});
			new Notice(
				`Jev: ${par.categoria} · ${par.genero} (${t().conf} ${par.pCategoria.toFixed(2)} / ${par.pGenero.toFixed(2)})`,
			);
		} catch (e) {
			this.reportError(e);
		} finally {
			this.setBusy(false);
		}
	}

	/** Alt+T: tag "<pasta raiz>/<gênero ou categoria>" com o que o Jev já gravou. */
	async gerarTags(file: TFile) {
		if (file.extension !== 'md') return void new Notice(t().soMd('Tags'));
		if (isExcluded(file.path, this.settings.excludedFolders)) return void new Notice(t().privadaIgnorada);

		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? null;
		const r = gerarTags(file.path, fm, this.settings.tagExcecoes, this.settings.tagCampo);
		if ('erro' in r)
			return void new Notice(
				r.erro === 'raiz' ? t().foraDePasta : t().semCampo(this.settings.tagCampo),
			);

		await this.app.fileManager.processFrontMatter(file, (f: Record<string, unknown>) => {
			f.tags = aplicarTags(f.tags, r.prefixo, r.tags, WORDLIST);
			ordenarBloco(f);
		});
		new Notice(`Tags: ${r.tags.map((t) => '#' + t).join(' ')}`);
	}

	/** Alt+A: 1–3 tags planas da wordlist (taxonomia-tags.json), via Jev. Troca só as tags da wordlist. */
	async gerarTagsAssunto(file: TFile) {
		if (this.busy) return;
		if (file.extension !== 'md') return void new Notice(t().soMd('Tags'));
		// Antes de ler o arquivo: pasta privada nunca é lida nem enviada.
		if (isExcluded(file.path, this.settings.excludedFolders))
			return void new Notice(t().privadaNaoEnviado('Tags'));

		const key = await this.chave();
		if (!key) return;

		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? null;
		const atuais = tagsAssuntoAtuais(fm?.tags, WORDLIST);
		if (atuais.length) {
			const ok = await new ConfirmModal(
				this.app,
				t().substituirTitulo,
				t().substituirTexto(atuais.map((x) => '#' + x).join(' ')),
				t().substituir,
			).ask();
			if (!ok) return;
		}

		this.setBusy(true);
		new Notice(t().gerandoTags);
		const lang = this.settings.lang;
		const taxTags = TAX_TAGS[lang];
		try {
			const content = await this.app.vault.cachedRead(file);
			const note = {
				basename: file.basename,
				frontmatter: fm,
				content,
			};
			const res = await sendWithRetry(
				{ send: (r) => this.send(r, key), sleep: (ms) => new Promise((r) => window.setTimeout(r, ms)) },
				(chars) => buildTagRequest(taxTags, note, this.settings.model, chars, lang, WORDLIST),
				this.settings.maxBodyChars,
			);
			const r = escolherTags(taxTags, parseOuErro(() => parseTagResponse(taxTags, res)), this.settings.tagLimiar);

			let escolhidas: CandidatoTag[] | null = r.escolhidas;
			if (!escolhidas.length) {
				escolhidas = await new PickTagsModal(this.app, taxTags, r.candidatos, this.settings.tagLimiar).ask();
				if (!escolhidas?.length) return;
			}

			const novas = escolhidas.map((c) => c.tag);
			await this.app.fileManager.processFrontMatter(file, (f: Record<string, unknown>) => {
				f.tags = aplicarTagsAssunto(f.tags, novas, WORDLIST);
				ordenarBloco(f);
			});
			new Notice(
				`Tags: ${novas.map((t) => '#' + t).join(' ')} (${escolhidas.map((c) => c.p.toFixed(2)).join(' / ')})`,
			);
		} catch (e) {
			this.reportError(e);
		} finally {
			this.setBusy(false);
		}
	}

	private reportError(e: unknown) {
		if (e instanceof JevError) {
			switch (e.kind) {
				case 'auth':
					new Notice(t().erroAuth);
					return void this.pedirChave();
				case 'rate':
					return void new Notice(t().erroRate(e.status));
				case 'tokens':
					return void new Notice(t().erroTokens);
				case 'resposta':
					return void new Notice(t().erroResposta(e.message));
				default:
					return void new Notice(t().erroHttp(e.status, e.message));
			}
		}
		console.error('Jev Classificador', e);
		new Notice(t().erroRede((e as Error)?.message ?? String(e)));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<JevSettings> | null);
		setLang(this.settings.lang);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
