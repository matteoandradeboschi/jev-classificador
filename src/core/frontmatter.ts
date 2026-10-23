/** Ordem do bloco do Jev no frontmatter. */
export const ORDEM = ['categoria', 'genero', 'tags'];

/**
 * Junta as chaves de `ordem` num bloco contíguo, nessa ordem, no lugar da primeira delas.
 * As outras chaves não mudam de posição. Muta `f` (é o objeto do processFrontMatter).
 */
export function ordenarBloco(f: Record<string, unknown>, ordem = ORDEM): void {
	const antes = Object.entries(f);
	for (const [k] of antes) delete f[k];
	let bloco = false;
	for (const [k, v] of antes) {
		if (!ordem.includes(k)) f[k] = v;
		else if (!bloco) {
			bloco = true;
			for (const o of ordem) if (antes.some(([x]) => x === o)) f[o] = antes.find(([x]) => x === o)![1];
		}
	}
}
