import { buildRequest, NoteInput, parseResponse } from './jev';
import { JevRequest, JevResponse, Resultado, Taxonomia } from './types';

export interface RawResponse {
	status: number;
	text: string;
	json: unknown;
}

export type JevErrorKind = 'auth' | 'validation' | 'rate' | 'tokens' | 'http' | 'resposta';

export class JevError extends Error {
	constructor(
		public kind: JevErrorKind,
		message: string,
		public status?: number,
	) {
		super(message);
	}
}

export interface ClassifyDeps {
	send: (req: JevRequest) => Promise<RawResponse>;
	sleep: (ms: number) => Promise<void>;
}

export interface ClassifyOptions {
	tax: Taxonomia;
	note: NoteInput;
	model: string;
	maxChars: number;
}

const BACKOFF_MS = [1000, 2000];

const isMaxTokens = (r: RawResponse) => r.status === 400 && r.text.includes('max_tokens_exceeded');

function validationMessage(r: RawResponse): string {
	const detail = (r.json as { detail?: { msg?: string }[] } | null)?.detail;
	const msg = Array.isArray(detail) ? detail.map((d) => d?.msg).filter(Boolean).join('; ') : '';
	return msg || r.text.slice(0, 200);
}

/** Envia 1 requisição (com retries de spec) e devolve o resultado ou null ("nenhuma"). */
export async function classify(
	deps: ClassifyDeps,
	{ tax, note, model, maxChars }: ClassifyOptions,
): Promise<Resultado | null> {
	const res = await sendWithRetry(deps, (chars) => buildRequest(tax, note, model, chars), maxChars);
	return parseOuErro(() => parseResponse(tax, res));
}

/** Erro de interpretação da resposta vira JevError('resposta'). */
export function parseOuErro<T>(parse: () => T): T {
	try {
		return parse();
	} catch (e) {
		throw new JevError('resposta', (e as Error).message);
	}
}

/** Laço de envio comum aos comandos: 401, 429/529 com backoff, max_tokens → metade do corpo 1 vez, 422. */
export async function sendWithRetry(
	{ send, sleep }: ClassifyDeps,
	build: (chars: number) => JevRequest,
	maxChars: number,
): Promise<JevResponse> {
	let chars = maxChars;
	let reduced = false;
	let retries = 0;

	for (;;) {
		const raw = await send(build(chars));

		if (raw.status === 200) return raw.json as JevResponse;
		if (raw.status === 401) throw new JevError('auth', 'chave inválida', 401);
		if (raw.status === 429 || raw.status === 529) {
			const delay = BACKOFF_MS[retries++];
			if (delay === undefined) throw new JevError('rate', 'limite/sobrecarga', raw.status);
			await sleep(delay);
			continue;
		}
		if (isMaxTokens(raw) && !reduced) {
			reduced = true;
			chars = Math.floor(chars / 2);
			continue;
		}
		if (isMaxTokens(raw)) throw new JevError('tokens', 'nota grande demais', 400);
		if (raw.status === 422) throw new JevError('validation', validationMessage(raw), 422);
		throw new JevError('http', raw.text.slice(0, 200), raw.status);
	}
}
