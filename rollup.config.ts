import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import externals from "rollup-plugin-node-externals";
import json from "@rollup/plugin-json";

export default {
  input: "lib/index.ts",
  output: {
    file: "./build/index.js",
    format: "cjs",
    sourcemap: true,
    exports: "named",
  },
  watch: {
    include: "lib/**",
  },
  plugins: [
    commonjs(),
    resolve(),
    externals(),
    json(),
    typescript({ exclude: "rollup.config.ts" }),
  ],
};
