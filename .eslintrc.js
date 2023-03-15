module.exports = {
  plugins: ["@typescript-eslint"],
  overrides: [
    {
      env: {
        es6: true,
        node: true,
      },
      files: ["lib/**/*.ts", "tests/**/*.ts"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: "./tsconfig.json",
      },
      extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "prettier",
        "plugin:prettier/recommended",
      ],
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            varsIgnorePattern: "^_",
            argsIgnorePattern: "^_",
            ignoreRestSiblings: true,
          },
        ],
      },
    },
    {
      env: {
        es2020: true,
        node: true,
      },
      files: ["**/*.js"],
      extends: ["eslint:recommended", "plugin:prettier/recommended"],
      parserOptions: {
        sourceType: "module",
      },
      globals: {
        step: "readonly",
        gauge: "readonly",
        beforeSuite: "readonly",
        afterSuite: "readonly",
      },
    },
  ],
};
