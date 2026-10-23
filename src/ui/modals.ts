import { App, Modal } from 'obsidian';
import type { Par, Resultado } from '../core/types';

abstract class AwaitableModal<T> extends Modal {
	private resolve!: (v: T) => void;
	private settled = false;
	protected abstract fallback: T;

	ask(): Promise<T> {
		return new Promise((res) => {
			this.resolve = res;
			this.open();
		});
	}

	protected settle(v: T) {
		this.settled = true;
		this.resolve(v);
		this.close();
	}

	onClose() {
		this.contentEl.empty();
		if (!this.settled) this.resolve(this.fallback);
	}
}

export class ConfirmOverwriteModal extends AwaitableModal<boolean> {
	protected fallback = false;

	constructor(
		app: App,
		private atual: { genero: string; categoria: string },
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		this.setTitle('Sobrescrever classificação?');
		contentEl.createEl('p', {
			text: `A nota já tem gênero "${this.atual.genero}" e categoria "${this.atual.categoria}".`,
		});
		const row = contentEl.createDiv({ cls: 'jev-buttons' });
		row.createEl('button', { text: 'Cancelar' }).onclick = () => this.settle(false);
		const ok = row.createEl('button', { text: 'Sobrescrever', cls: 'mod-cta' });
		ok.onclick = () => this.settle(true);
	}
}

export class ConfirmModal extends AwaitableModal<boolean> {
	protected fallback = false;

	constructor(
		app: App,
		private titulo: string,
		private texto: string,
		private okText: string,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		this.setTitle(this.titulo);
		contentEl.createEl('p', { text: this.texto });
		const row = contentEl.createDiv({ cls: 'jev-buttons' });
		row.createEl('button', { text: 'Cancelar' }).onclick = () => this.settle(false);
		const ok = row.createEl('button', { text: this.okText, cls: 'mod-warning' });
		ok.onclick = () => this.settle(true);
	}
}

export class PickParModal extends AwaitableModal<Par | null> {
	protected fallback = null;

	constructor(
		app: App,
		private opcoes: Par[],
		private melhor: Resultado['melhor'],
		private limiar: number,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		this.setTitle('Jev não tem certeza — escolha');
		contentEl.createEl('p', {
			cls: 'jev-muted',
			text: `Probabilidade (categoria × gênero) abaixo do limiar ${this.limiar.toFixed(2)}. Confiança do Jev: categoria ${this.melhor.confCategoria.toFixed(2)} · gênero ${this.melhor.confGenero.toFixed(2)}.`,
		});
		for (const p of this.opcoes) {
			const btn = contentEl.createEl('button', { cls: 'jev-option' });
			btn.createSpan({ cls: 'jev-option-name', text: `${p.genero} · ${p.categoria}` });
			btn.createSpan({
				cls: 'jev-option-p',
				text: (p.pCategoria * p.pGenero).toFixed(2),
			});
			btn.onclick = () => this.settle(p);
		}
		contentEl.createDiv({ cls: 'jev-buttons' }).createEl('button', { text: 'Cancelar' }).onclick =
			() => this.settle(null);
	}
}
