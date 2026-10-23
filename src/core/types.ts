export interface Genero {
	id: string;
	/** Rótulo no idioma da taxonomia: enviado ao Jev e gravado no frontmatter. */
	nome: string;
	desc: string;
}

export interface Categoria {
	id: string;
	/** Rótulo no idioma da taxonomia: enviado ao Jev e gravado no frontmatter. */
	nome: string;
	desc: string;
	generos: Genero[];
}

export interface Taxonomia {
	categorias: Categoria[];
}

export interface ChoiceQuestion {
	type: 'choice';
	instructions: string;
	criteria: Record<string, string>;
}

export interface NoulQuestion {
	type: 'noul';
	instructions: string;
	criteria: { true: string; false: string };
}

export type Question = ChoiceQuestion | NoulQuestion;

export interface JevState {
	titulo: string;
	pasta?: string;
	tags: string[];
	corpo: string;
}

export interface JevRequest {
	model: string;
	state: JevState;
	questions: Record<string, Question>;
}

export interface ChoiceAnswer {
	type: 'choice';
	choice: string;
	probabilities: Record<string, number>;
	confidence: number;
}

export interface NoulAnswer {
	type: 'noul';
	noul: number;
}

export interface JevResponse {
	model?: string;
	answers: Record<string, ChoiceAnswer | NoulAnswer>;
	usage?: { input_tokens: number; output_tokens: number };
}

// Tags de assunto (Alt+A): wordlist fechada em src/taxonomia-tags.json.
export interface TagDef {
	tag: string;
	desc: string;
}

export interface TaxTags {
	regras: { max_total: number; max_por_faceta: Record<string, number> };
	facetas: { id: string; nome: string; descricao: string; grupos: { nome: string; tags: TagDef[] }[] }[];
}

export interface CandidatoTag {
	tag: string;
	faceta: string;
	p: number;
}

export interface Par {
	categoria: string;
	genero: string;
	pCategoria: number;
	pGenero: number;
}

export interface Resultado {
	/** Par vencedor (argmax de cada pergunta). */
	melhor: Par & { confCategoria: number; confGenero: number };
	/** Top 3 por p(categoria) × p(gênero | categoria). */
	top3: Par[];
}
