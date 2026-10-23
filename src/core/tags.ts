// Alt+T: tag "<pasta raiz>/<categoria>" a partir do que o Jev já gravou. Sem rede.
import { normalizeTags } from './jev';
import { NENHUMAS } from './prompts';

/** kebab-case ASCII: "Ciência da Computação" → "ciencia-da-computacao". */
export function slug(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-');
}

/** "1-conceitos/sub/x.md" → "conceito". Exceções (ex.: lugares=lugar) vencem o "tira o s". */
export function prefixoPasta(path: string, excecoes: Record<string, string>): string | null {
	const partes = path.replace(/^\/+/, '').split('/');
	if (partes.length < 2) return null; // nota na raiz do vault
	const nome = slug(partes[0]!.replace(/^\d+-/, ''));
	return slug(excecoes[nome] ?? nome.replace(/s$/, ''));
}

/** Qual propriedade do Jev vira a parte depois da barra. */
export type CampoTag = 'categoria' | 'genero';

/** Tags novas da nota; null se não dá para gerar (motivo em `erro`). */
export function gerarTags(
	path: string,
	fm: Record<string, unknown> | null | undefined,
	excecoes: Record<string, string>,
	campo: CampoTag = 'genero',
): { prefixo: string; tags: string[] } | { erro: 'raiz' | 'sem-categoria' } {
	const prefixo = prefixoPasta(path, excecoes);
	if (!prefixo) return { erro: 'raiz' };
	const valor = typeof fm?.[campo] === 'string' ? fm[campo].trim() : '';
	if (!valor || NENHUMAS.has(valor)) return { erro: 'sem-categoria' };
	const tags = [`${prefixo}/${slug(valor)}`];
	if (fm?.['ai-generated'] === true) tags.unshift(AI);
	return { prefixo, tags };
}

/** Tag única (sem pasta) das notas com a checkbox ai-generated. */
export const AI = 'ai-generated';

/**
 * Troca "<prefixo>", "<prefixo>/*" e "ai-generated" (segue a checkbox) pelas novas; mantém as demais na ordem.
 * `protegidas` (wordlist do Alt+A) nunca saem: "3-carreira" → prefixo "carreira", que também é tag de assunto.
 */
export function aplicarTags(
	atuais: unknown,
	prefixo: string,
	novas: string[],
	protegidas: ReadonlySet<string> = new Set(),
): string[] {
	const resto = normalizeTags(atuais).filter((t) => {
		const l = t.toLowerCase();
		if (protegidas.has(l)) return true;
		return l !== prefixo && l !== AI && !l.startsWith(prefixo + '/');
	});
	return [...resto, ...novas];
}

/** "lugares=lugar" por linha → { lugares: 'lugar' }. */
export function parseExcecoes(texto: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const linha of texto.split('\n')) {
		const [k, v] = linha.split('=').map((x) => x?.trim() ?? '');
		if (k && v) out[slug(k)] = v;
	}
	return out;
}
