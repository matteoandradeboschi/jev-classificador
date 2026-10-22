export interface Genero {
	id: string;
	en: string;
	pt: string;
}

export interface Categoria {
	id: string;
	en: string;
	pt: string;
	generos: Genero[];
}

export interface Taxonomia {
	categorias: Categoria[];
}

export interface Question {
	type: 'choice';
	instructions: string;
	criteria: Record<string, string>;
}

export interface JevRequest {
	model: string;
	state: { titulo: string; tags: string[]; corpo: string };
	questions: Record<string, Question>;
}

export interface ChoiceAnswer {
	type: 'choice';
	choice: string;
	probabilities: Record<string, number>;
	confidence: number;
}

export interface JevResponse {
	model?: string;
	answers: Record<string, ChoiceAnswer>;
	usage?: { input_tokens: number; output_tokens: number };
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

export const NENHUMA = 'nenhuma';
