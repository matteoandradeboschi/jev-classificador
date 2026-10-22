import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['src/**/*.test.ts', 'test/**/*.test.ts'], alias: { obsidian: new URL('./test/obsidian-stub.ts', import.meta.url).pathname } } });
