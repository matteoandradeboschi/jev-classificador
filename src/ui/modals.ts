import { App, Modal, SecretComponent } from 'obsidian';
import { ordenarEscolhidas, podeMarcar } from '../core/tagsAssunto';
import { t } from '../i18n';
import type { CandidatoTag, Par, Resultado, TaxTags } from '../core/types';

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

/** Pede o segredo da chave TypeSafe (fica no SecretStorage do Obsidian). Resolve com o nome escolhido. */
export class KeyModal extends AwaitableModal<string | null> {
	protected fallback = null;

	constructor(
		app: App,
		private nome: string,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		this.setTitle(t().chave);
		const p = contentEl.createEl('p', { text: t().keyIntro });
		p.createEl('a', { text: 'console.typesafe.ai/keys', href: 'https://console.typesafe.ai/keys' });
		p.appendText(t().keyFim);
		contentEl.createEl('p', {
			cls: 'jev-muted',
			text: t().keyNota,
		});
		new SecretComponent(this.app, contentEl.createDiv()).setValue(this.nome).onChange((n) => (this.nome = n ?? ''));
		const row = contentEl.createDiv({ cls: 'jev-buttons' });
		row.createEl('button', { text: t().cancelar }).onclick = () => this.settle(null);
		row.createEl('button', { text: t().pronto, cls: 'mod-cta' }).onclick = () => this.settle(this.nome);
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
		this.setTitle(t().sobrescreverTitulo);
		contentEl.createEl('p', {
			text: t().sobrescreverTexto(this.atual.genero, this.atual.categoria),
		});
		const row = contentEl.createDiv({ cls: 'jev-buttons' });
		row.createEl('button', { text: t().cancelar }).onclick = () => this.settle(false);
		const ok = row.createEl('button', { text: t().sobrescrever, cls: 'mod-cta' });
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
		row.createEl('button', { text: t().cancelar }).onclick = () => this.settle(false);
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
		this.setTitle(t().escolhaTitulo);
		contentEl.createEl('p', {
			cls: 'jev-muted',
			text: t().escolhaTexto(
				this.limiar.toFixed(2),
				this.melhor.confCategoria.toFixed(2),
				this.melhor.confGenero.toFixed(2),
			),
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
		contentEl.createDiv({ cls: 'jev-buttons' }).createEl('button', { text: t().cancelar }).onclick =
			() => this.settle(null);
	}
}

export class PickTagsModal extends AwaitableModal<CandidatoTag[] | null> {
	protected fallback = null;

	constructor(
		app: App,
		private tax: TaxTags,
		private opcoes: CandidatoTag[],
		private limiar: number,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		const { max_total } = this.tax.regras;
		this.setTitle(t().escolhaTagsTitulo);
		contentEl.createEl('p', {
			cls: 'jev-muted',
			text: t().escolhaTagsTexto(this.limiar.toFixed(2), max_total, this.tax.regras.max_por_faceta.forma ?? max_total),
		});

		const marcadas: CandidatoTag[] = [];
		const caixas: { c: CandidatoTag; input: HTMLInputElement }[] = [];
		const row = contentEl.createDiv({ cls: 'jev-buttons' });
		row.createEl('button', { text: t().cancelar }).onclick = () => this.settle(null);
		const ok = row.createEl('button', { text: t().gravar, cls: 'mod-cta' });
		ok.disabled = true;
		ok.onclick = () => this.settle(ordenarEscolhidas(marcadas));

		// Ao atingir o limite (total ou da faceta), as caixas que estourariam ficam desabilitadas.
		const atualizar = () => {
			for (const { c, input } of caixas) input.disabled = !input.checked && !podeMarcar(this.tax, marcadas, c);
			ok.disabled = marcadas.length === 0;
		};

		for (const c of this.opcoes) {
			const label = createEl('label', { cls: 'jev-option jev-check' });
			const input = label.createEl('input', { type: 'checkbox' });
			label.createSpan({ cls: 'jev-option-name', text: `#${c.tag}${c.faceta === 'tema' ? '' : ` (${c.faceta})`}` });
			label.createSpan({ cls: 'jev-option-p', text: c.p.toFixed(2) });
			input.onchange = () => {
				if (input.checked) marcadas.push(c);
				else marcadas.splice(marcadas.indexOf(c), 1);
				atualizar();
			};
			caixas.push({ c, input });
			contentEl.insertBefore(label, row);
		}
		atualizar();
	}
}
