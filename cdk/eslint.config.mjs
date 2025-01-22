import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";


/** @type {import('eslint').Linter.Config[]} */
export default [
  {files: ["**/*.{js,mjs,cjs,ts}"]},
  {languageOptions: { globals: globals.browser }},
  {ignores: ['cdk.out', 'node_modules', '**/jest.config.js']},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
];
