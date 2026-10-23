import { App, Notice, PluginSettingTab, SecretComponent, Setting } from 'obsidian';
import type JevClassificador from './main';
import type { Lang } from './core/prompts';
import { CampoTag, parseExcecoes } from './core/tags';
import { setLang, t } from './i18n';

export interface JevSettings {
	/** Nome do segredo no SecretStorage do Obsidian (o valor da chave não fica no data.json). */
	apiKeySecret: string;
	model: string;
	threshold: number;
	excludedFolders: string[];
	maxBodyChars: number;
	/** Alt+T: nome da pasta (sem número) → prefixo da tag, quando "tirar o s" erra. */
	tagExcecoes: Record<string, string>;
	/** Alt+T: pasta/genero ou pasta/categoria. */
	tagCampo: CampoTag;
	/** Alt+A: p mínimo do noul para gravar a tag de assunto sem perguntar. */
	tagLimiar: number;
	/** Taxonomia, wordlist, instruções ao Jev e interface. */
	lang: Lang;
	/** Já pediu a chave na 1ª ativação. */
	onboarded: boolean;
}

export const DEFAULT_SETTINGS: JevSettings = {
	apiKeySecret: 'typesafe-api-key',
	model: 'jev-latest',
	threshold: 0.6,
	excludedFolders: [],
	maxBodyChars: 12000,
	tagExcecoes: { lugares: 'lugar' },
	tagCampo: 'genero',
	tagLimiar: 0.5,
	lang: 'pt',
	onboarded: false,
};

export class JevSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: JevClassificador,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;
		const tx = t();

		new Setting(containerEl)
			.setName(tx.idioma)
			.setDesc(tx.idiomaDesc)
			.addDropdown((d) =>
				d
					.addOptions({ pt: 'Português', en: 'English' })
					.setValue(s.lang)
					.onChange(async (v) => {
						s.lang = v as Lang;
						setLang(s.lang);
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		new Setting(containerEl)
			.setName(tx.chave)
			.setDesc(
tx.chaveDesc,
			)
			.addComponent((el) =>
				new SecretComponent(this.app, el).setValue(s.apiKeySecret).onChange(async (name) => {
					s.apiKeySecret = name;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName(tx.modelo)
			.addText((t) =>
				t.setValue(s.model).onChange(async (v) => {
					s.model = v.trim() || DEFAULT_SETTINGS.model;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName(tx.limiar)
			.setDesc(tx.limiarDesc)
			.addSlider((sl) =>
				sl
					.setLimits(0, 1, 0.05)
					.setValue(s.threshold)
					.setDynamicTooltip()
					.onChange(async (v) => {
						s.threshold = v;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(tx.excluidas)
			.setDesc(tx.excluidasDesc)
			.addTextArea((t) =>
				t.setValue(s.excludedFolders.join('\n')).onChange(async (v) => {
					s.excludedFolders = v
						.split('\n')
						.map((l) => l.trim())
						.filter(Boolean);
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName(tx.maxChars)
			.setDesc(tx.maxCharsDesc)
			.addText((t) =>
				t.setValue(String(s.maxBodyChars)).onChange(async (v) => {
					const n = parseInt(v, 10);
					s.maxBodyChars = Number.isFinite(n) && n > 0 ? n : DEFAULT_SETTINGS.maxBodyChars;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName(tx.atalho)
			.setDesc(tx.atalhoDesc)
			.addButton((b) => b.setButtonText(tx.definirAtalho).onClick(() => this.abrirAtalhos()));

		new Setting(containerEl).setName(tx.tags).setHeading();

		new Setting(containerEl)
			.setName(tx.atalhoTags)
			.setDesc(tx.atalhoTagsDesc)
			.addButton((b) => b.setButtonText(tx.definirAtalho).onClick(() => this.abrirAtalhos()));

		new Setting(containerEl)
			.setName(tx.tagUsa)
			.setDesc(tx.tagUsaDesc)
			.addDropdown((d) =>
				d
					.addOptions({ genero: tx.genero, categoria: tx.categoria })
					.setValue(s.tagCampo)
					.onChange(async (v) => {
						s.tagCampo = v as CampoTag;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(tx.excecoes)
			.setDesc(tx.excecoesDesc)
			.addTextArea((t) =>
				t
					.setValue(Object.entries(s.tagExcecoes).map(([k, v]) => `${k}=${v}`).join('\n'))
					.onChange(async (v) => {
						s.tagExcecoes = parseExcecoes(v);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName(tx.tagsAssunto).setHeading();

		new Setting(containerEl)
			.setName(tx.atalhoAssunto)
			.setDesc(tx.atalhoAssuntoDesc)
			.addButton((b) => b.setButtonText(tx.definirAtalho).onClick(() => this.abrirAtalhos()));

		new Setting(containerEl)
			.setName(tx.limiarTags)
			.setDesc(tx.limiarTagsDesc)
			.addSlider((sl) =>
				sl
					.setLimits(0, 1, 0.05)
					.setValue(s.tagLimiar)
					.setDynamicTooltip()
					.onChange(async (v) => {
						s.tagLimiar = v;
						await this.plugin.saveSettings();
					}),
			);
	}

	/** Abre a tela de Atalhos filtrada pelo plugin. API interna do Obsidian: se sumir, cai no aviso. */
	private abrirAtalhos() {
		const setting = (this.app as unknown as {
			setting?: { openTabById?(id: string): { setQuery?(q: string): void } | undefined };
		}).setting;
		const tab = setting?.openTabById?.('hotkeys');
		if (tab?.setQuery) tab.setQuery(this.plugin.manifest.name);
		else new Notice(t().abrirAtalhosManual);
	}
}
