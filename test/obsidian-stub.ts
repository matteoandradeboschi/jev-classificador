// Stub mínimo da API do Obsidian só para testar o fluxo de main.ts em Node.
export const notices: string[] = [];
export const requests: { url: string; body: string; headers: Record<string, string> }[] = [];
export const state = { response: { status: 200, text: '', json: null as unknown } };

export class Notice {
	constructor(msg: string) {
		notices.push(msg);
	}
}
export class TFile {
	extension = 'md';
	constructor(
		public path: string,
		public basename = path.split('/').pop()!.replace(/\.md$/, ''),
	) {}
}
export class Modal {
	contentEl = { empty() {} };
	constructor(public app: unknown) {}
	open() {}
	close() {}
}
export class Plugin {
	manifest = { id: 'jev-classificador' };
	constructor(public app: any) {}
	addSettingTab() {}
	addCommand() {}
	registerEvent() {}
	loadData() {
		return Promise.resolve({});
	}
	saveData() {
		return Promise.resolve();
	}
}
export class PluginSettingTab {}
export class SecretComponent {}
export class Setting {}
export class MarkdownView {}
export function requestUrl(p: { url: string; body: string; headers: Record<string, string> }) {
	requests.push(p);
	return Promise.resolve(state.response);
}
