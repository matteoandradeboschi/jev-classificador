import { App, PluginSettingTab, SecretComponent, Setting } from 'obsidian';
import type JevClassificador from './main';

export interface JevSettings {
	/** Nome do segredo no SecretStorage do Obsidian (o valor da chave não fica no data.json). */
	apiKeySecret: string;
	model: string;
	threshold: number;
	excludedFolders: string[];
	maxBodyChars: number;
}

export const DEFAULT_SETTINGS: JevSettings = {
	apiKeySecret: 'typesafe-api-key',
	model: 'jev-latest',
	threshold: 0.6,
	excludedFolders: ['1-diario', '4-pessoas'],
	maxBodyChars: 12000,
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
			.setDesc('Abaixo disso (categoria ou gênero), pede para escolher entre as 3 melhores. Valor inicial é um chute; ajuste depois de usar em notas reais.')
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
	}
}
