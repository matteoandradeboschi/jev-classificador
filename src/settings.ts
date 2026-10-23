import { App, Notice, PluginSettingTab, SecretComponent, Setting, SettingDefinitionItem } from 'obsidian';
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
	lang: 'en',
	onboarded: false,
};

interface Def {
	name: string;
	desc?: string;
	render: (st: Setting) => unknown;
}

export class JevSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: JevClassificador,
	) {
		super(app, plugin);
	}

	/** Fonte única: getSettingDefinitions (Obsidian ≥1.13, entra na busca) e display() (versões antigas). */
	private grupos(): { heading?: string; items: Def[] }[] {
		const s = this.plugin.settings;
		const tx = t();
		return [
			{
				items: [
					{
						name: tx.idioma,
						desc: tx.idiomaDesc,
						render: (st) =>
							st.addDropdown((d) =>
								d
									.addOptions({ pt: 'Português', en: 'English' })
									.setValue(s.lang)
									.onChange(async (v) => {
										s.lang = v as Lang;
										setLang(s.lang);
										await this.plugin.saveSettings();
										this.recarregar();
									}),
							),
					},
					{
						name: tx.chave,
						desc: tx.chaveDesc,
						render: (st) =>
							st.addComponent((el) =>
								new SecretComponent(this.app, el).setValue(s.apiKeySecret).onChange(async (name) => {
									s.apiKeySecret = name ?? '';
									await this.plugin.saveSettings();
								}),
							),
					},
					{
						name: tx.modelo,
						render: (st) =>
							st.addText((t) =>
								t.setValue(s.model).onChange(async (v) => {
									s.model = v.trim() || DEFAULT_SETTINGS.model;
									await this.plugin.saveSettings();
								}),
							),
					},
					{
						name: tx.limiar,
						desc: tx.limiarDesc,
						render: (st) =>
							st.addSlider((sl) =>
								sl
									.setLimits(0, 1, 0.05)
									.setValue(s.threshold)
									.setDynamicTooltip()
									.onChange(async (v) => {
										s.threshold = v;
										await this.plugin.saveSettings();
									}),
							),
					},
					{
						name: tx.excluidas,
						desc: tx.excluidasDesc,
						render: (st) =>
							st.addTextArea((t) =>
								t.setValue(s.excludedFolders.join('\n')).onChange(async (v) => {
									s.excludedFolders = v
										.split('\n')
										.map((l) => l.trim())
										.filter(Boolean);
									await this.plugin.saveSettings();
								}),
							),
					},
					{
						name: tx.maxChars,
						desc: tx.maxCharsDesc,
						render: (st) =>
							st.addText((t) =>
								t.setValue(String(s.maxBodyChars)).onChange(async (v) => {
									const n = parseInt(v, 10);
									s.maxBodyChars = Number.isFinite(n) && n > 0 ? n : DEFAULT_SETTINGS.maxBodyChars;
									await this.plugin.saveSettings();
								}),
							),
					},
					{
						name: tx.atalho,
						desc: tx.atalhoDesc,
						render: (st) =>
							st.addButton((b) => b.setButtonText(tx.definirAtalho).onClick(() => this.abrirAtalhos())),
					},
				],
			},
			{
				heading: tx.tags,
				items: [
					{
						name: tx.atalhoTags,
						desc: tx.atalhoTagsDesc,
						render: (st) =>
							st.addButton((b) => b.setButtonText(tx.definirAtalho).onClick(() => this.abrirAtalhos())),
					},
					{
						name: tx.tagUsa,
						desc: tx.tagUsaDesc,
						render: (st) =>
							st.addDropdown((d) =>
								d
									.addOptions({ genero: tx.genero, categoria: tx.categoria })
									.setValue(s.tagCampo)
									.onChange(async (v) => {
										s.tagCampo = v as CampoTag;
										await this.plugin.saveSettings();
									}),
							),
					},
					{
						name: tx.excecoes,
						desc: tx.excecoesDesc,
						render: (st) =>
							st.addTextArea((t) =>
								t
									.setValue(Object.entries(s.tagExcecoes).map(([k, v]) => `${k}=${v}`).join('\n'))
									.onChange(async (v) => {
										s.tagExcecoes = parseExcecoes(v);
										await this.plugin.saveSettings();
									}),
							),
					},
				],
			},
			{
				heading: tx.tagsAssunto,
				items: [
					{
						name: tx.atalhoAssunto,
						desc: tx.atalhoAssuntoDesc,
						render: (st) =>
							st.addButton((b) => b.setButtonText(tx.definirAtalho).onClick(() => this.abrirAtalhos())),
					},
					{
						name: tx.limiarTags,
						desc: tx.limiarTagsDesc,
						render: (st) =>
							st.addSlider((sl) =>
								sl
									.setLimits(0, 1, 0.05)
									.setValue(s.tagLimiar)
									.setDynamicTooltip()
									.onChange(async (v) => {
										s.tagLimiar = v;
										await this.plugin.saveSettings();
									}),
							),
					},
				],
			},
		];
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return this.grupos().map((g) => ({
			type: 'group' as const,
			heading: g.heading,
			items: g.items.map((d) => ({ name: d.name, desc: d.desc, render: (st: Setting) => void d.render(st) })),
		}));
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		for (const g of this.grupos()) {
			if (g.heading) new Setting(containerEl).setName(g.heading).setHeading();
			for (const d of g.items) {
				const st = new Setting(containerEl).setName(d.name);
				if (d.desc) st.setDesc(d.desc);
				d.render(st);
			}
		}
	}

	/** Troca de idioma: redesenha (≥1.13 via update(); antes, display()). */
	private recarregar() {
		const tab = this as unknown as { update?: () => void };
		if (typeof tab.update === 'function') tab.update();
		else this.display();
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
