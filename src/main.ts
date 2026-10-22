import { MarkdownView, Notice, Plugin, requestUrl, TFile } from 'obsidian';
import { classify, JevError, RawResponse } from './core/classify';
import { isClassified, isExcluded, precisaConfirmar } from './core/jev';
import type { JevRequest, Par, Taxonomia } from './core/types';
import taxJson from './taxonomia.json';
import { DEFAULT_SETTINGS, JevSettings, JevSettingTab } from './settings';
import { ConfirmOverwriteModal, PickParModal } from './ui/modals';

const tax = taxJson as unknown as Taxonomia;
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const TOOLTIP = 'Classificar gênero e categoria (Jev)';

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
			name: 'Classificar gênero e categoria',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
				if (!file) return false;
				if (!checking) void this.run(file);
				return true;
			},
		});

		const attach = () => this.attachButtons();
		this.registerEvent(this.app.workspace.on('layout-change', attach));
		this.registerEvent(this.app.workspace.on('active-leaf-change', attach));
		this.app.workspace.onLayoutReady(attach);
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
			const btn = view.addAction('tags', TOOLTIP, () => {
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

	private openSettings() {
		const setting = (this.app as unknown as {
			setting?: { open(): void; openTabById(id: string): void };
		}).setting;
		setting?.open();
		setting?.openTabById(this.manifest.id);
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
		if (file.extension !== 'md') return void new Notice('Jev: só funciona em notas .md');
		// Antes de ler o arquivo: pasta privada nunca é lida nem enviada.
		if (isExcluded(file.path, this.settings.excludedFolders))
			return void new Notice('Jev: pasta privada, não enviado');

		const key = this.app.secretStorage.getSecret(this.settings.apiKeySecret);
		if (!key) {
			new Notice('Jev: configure a chave TypeSafe');
			return this.openSettings();
		}

		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? null;
		if (isClassified(fm)) {
			const ok = await new ConfirmOverwriteModal(this.app, {
				genero: String(fm?.genero),
				categoria: String(fm?.categoria),
			}).ask();
			if (!ok) return;
		}

		this.setBusy(true);
		new Notice('Jev: classificando…');
		try {
			const content = await this.app.vault.cachedRead(file);
			const result = await classify(
				{ send: (r) => this.send(r, key), sleep: (ms) => new Promise((r) => window.setTimeout(r, ms)) },
				{
					tax,
					note: { basename: file.basename, frontmatter: fm, content },
					model: this.settings.model,
					maxChars: this.settings.maxBodyChars,
				},
			);
			if (!result) return void new Notice('Jev: nenhuma categoria se aplica');

			let par: Par | null = {
				categoria: result.melhor.categoria,
				genero: result.melhor.genero,
				pCategoria: result.melhor.confCategoria,
				pGenero: result.melhor.confGenero,
			};
			if (precisaConfirmar(result, this.settings.threshold)) {
				par = await new PickParModal(this.app, result.top3).ask();
				if (!par) return;
			}

			await this.app.fileManager.processFrontMatter(file, (f: Record<string, unknown>) => {
				f.genero = par.genero;
				f.categoria = par.categoria;
			});
			new Notice(
				`Jev: ${par.genero} · ${par.categoria} (conf. ${par.pCategoria.toFixed(2)} / ${par.pGenero.toFixed(2)})`,
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
					new Notice('Jev: chave TypeSafe inválida — veja as configurações');
					return this.openSettings();
				case 'rate':
					return void new Notice(`Jev: serviço ocupado (HTTP ${e.status}), tente de novo depois`);
				case 'tokens':
					return void new Notice('Jev: nota grande demais, reduza o máx. de caracteres');
				case 'resposta':
					return void new Notice(`Jev: resposta inesperada — ${e.message}`);
				default:
					return void new Notice(`Jev: erro HTTP ${e.status} — ${e.message}`);
			}
		}
		console.error('Jev Classificador', e);
		new Notice(`Jev: erro de rede/inesperado — ${(e as Error)?.message ?? e}`);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<JevSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
