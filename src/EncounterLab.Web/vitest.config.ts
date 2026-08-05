import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // v8 coverage instrumentation adds real per-statement overhead; the
    // heaviest DOM-rendering tests (e.g. the full App tree) can cross the
    // 5s default under --coverage even though they run in well under 1s
    // uninstrumented.
    testTimeout: 15_000,
    // e2e/ holds Playwright specs (run via `npm run test:e2e`), not Vitest
    // tests. Vitest's default include pattern matches *.spec.ts too broadly
    // and picks them up otherwise, failing on Playwright's test()/expect().
    exclude: ['node_modules/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/types.ts',
        // Three.js/React Three Fiber canvas code: camera math, GLTF loading,
        // and WebGL rendering are not meaningfully unit-testable. Excluded
        // deliberately and documented here, not silently skipped — see
        // docs/ai-assurance.md's coverage section.
        'src/scene/EncounterScene.tsx',
        'src/scene/DamageEffects.tsx',
        'src/scene/DeathResurrection.tsx',
      ],
      thresholds: {
        lines: 100,
        statements: 100,
        functions: 100,
        // Statements/functions/lines are a genuine, verified 100%. Branches
        // sits at ~98.7%: the remaining handful are synthetic branches with
        // empty { start: {}, end: {} } location metadata in the raw v8
        // coverage JSON (coverage/coverage-final.json), meaning they don't
        // map to any conditional in this project's source — they come from
        // the React Fast Refresh/Babel transform pipeline itself, not from
        // AccessibilityDebugModal.tsx, SessionHistoryModal.tsx, or
        // useEncounterController.ts's actual logic. No test can exercise a
        // branch with no source location. Threshold set just below the
        // observed value so a real regression still fails the build.
        branches: 98,
      },
    },
  },
});
