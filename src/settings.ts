import { App, PluginSettingTab, SecretComponent, Setting } from 'obsidian';
import type JevClassificador from './main';
import { CampoTag, parseExcecoes } from './core/tags';

export interface JevSettings {
	/** Nome do segredo no SecretStorage do Obsidian (o valor da chave não fica no data.json). */
	apiKeySecret: string;
	model: string;
	threshold: number;
	excludedFolders: string[];
	maxBodyChars: number;
	sendFolder: boolean;
	/** Alt+T: nome da pasta (sem número) → prefixo da tag, quando "tirar o s" erra. */
	tagExcecoes: Record<string, string>;
	/** Alt+T: pasta/genero ou pasta/categoria. */
	tagCampo: CampoTag;
}

export const DEFAULT_SETTINGS: JevSettings = {
	apiKeySecret: 'typesafe-api-key',
	model: 'jev-latest',
	threshold: 0.6,
	excludedFolders: ['1-diario', '4-pessoas'],
	maxBodyChars: 12000,
	sendFolder: true,
	tagExcecoes: { lugares: 'lugar' },
	tagCampo: 'genero',
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

		new Setting(containerEl)
			.setName('Chave TypeSafe')
			.setDesc(
				'Guardada no armazenamento de segredos do Obsidian, não no data.json do vault (que vai no backup). Crie em console.typesafe.ai/keys.',
			)
			.addComponent((el) =>
				new SecretComponent(this.app, el).setValue(s.apiKeySecret).onChange(async (name) => {
					s.apiKeySecret = name;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Modelo')
			.addText((t) =>
				t.setValue(s.model).onChange(async (v) => {
					s.model = v.trim() || DEFAULT_SETTINGS.model;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Limiar de confiança')
			.setDesc('Se p(categoria) × p(gênero) do par vencedor ficar abaixo disso, pede para escolher entre as 3 melhores. Valor inicial é um chute; ajuste depois de usar em notas reais.')
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
			.setName('Pastas excluídas')
			.setDesc('Uma por linha. Notas nessas pastas nunca são lidas nem enviadas.')
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
			.setName('Máx. caracteres do corpo')
			.setDesc('Quanto da nota é enviado (mais caracteres = mais tokens cobrados).')
			.addText((t) =>
				t.setValue(String(s.maxBodyChars)).onChange(async (v) => {
					const n = parseInt(v, 10);
					s.maxBodyChars = Number.isFinite(n) && n > 0 ? n : DEFAULT_SETTINGS.maxBodyChars;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Enviar pasta da nota')
			.setDesc('Manda o caminho da pasta (ex.: 1-conceitos/carreira) como contexto. Ajuda em títulos ambíguos.')
			.addToggle((t) =>
				t.setValue(s.sendFolder).onChange(async (v) => {
					s.sendFolder = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Atalho de teclado')
			.setDesc('Padrão: Alt+C. Classifica a nota aberta. Clique para trocar na tela de Atalhos do Obsidian.')
			.addButton((b) => b.setButtonText('Alterar atalho').onClick(() => this.abrirAtalhos()));

		new Setting(containerEl).setName('Tags').setHeading();

		new Setting(containerEl)
			.setName('Atalho das tags')
			.setDesc('Padrão: Alt+T. Gera #pasta/gênero ou #pasta/categoria (pasta raiz sem número e no singular) a partir do que o Jev já gravou. Não usa a API.')
			.addButton((b) => b.setButtonText('Alterar atalho').onClick(() => this.abrirAtalhos()));

		new Setting(containerEl)
			.setName('Tag usa')
			.setDesc('O que vem depois da barra: conceito/infraestrutura (gênero) ou conceito/tecnologia (categoria).')
			.addDropdown((d) =>
				d
					.addOptions({ genero: 'Gênero', categoria: 'Categoria' })
					.setValue(s.tagCampo)
					.onChange(async (v) => {
						s.tagCampo = v as CampoTag;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Exceções do singular')
			.setDesc('Uma por linha, pasta=prefixo. Por padrão só tira o "s" final (conceitos → conceito).')
			.addTextArea((t) =>
				t
					.setValue(Object.entries(s.tagExcecoes).map(([k, v]) => `${k}=${v}`).join('\n'))
					.onChange(async (v) => {
						s.tagExcecoes = parseExcecoes(v);
						await this.plugin.saveSettings();
					}),
			);
	}

	private abrirAtalhos() {
		const setting = (this.app as unknown as {
			setting?: { openTabById(id: string): { setQuery?(q: string): void } | undefined };
		}).setting;
		setting?.openTabById('hotkeys')?.setQuery?.(this.plugin.manifest.name);
	}
}
