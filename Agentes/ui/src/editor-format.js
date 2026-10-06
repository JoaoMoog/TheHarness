import { format } from "prettier/standalone";
const parsers = {
  ts: "typescript",
  tsx: "typescript",
  js: "babel",
  jsx: "babel",
  mjs: "babel",
  cjs: "babel",
  json: "json",
  jsonc: "jsonc",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  md: "markdown",
  mdx: "mdx",
  yaml: "yaml",
  yml: "yaml",
};
export async function formatBuffer(path, text, options = {}) {
  if (text.length > 512 * 1024)
    throw new Error("Formatação limitada a 512 KiB; buffer preservado.");
  const parser = parsers[path.split(".").at(-1).toLowerCase()];
  if (!parser) throw new Error("Linguagem sem formatador configurado.");
  const imports =
    parser === "typescript"
      ? [
          import("prettier/plugins/typescript"),
          import("prettier/plugins/estree"),
        ]
      : ["babel", "json", "jsonc"].includes(parser)
        ? [import("prettier/plugins/babel"), import("prettier/plugins/estree")]
        : ["css", "scss", "less"].includes(parser)
          ? [import("prettier/plugins/postcss")]
          : ["markdown", "mdx"].includes(parser)
            ? [
                import("prettier/plugins/markdown"),
                import("prettier/plugins/html"),
              ]
            : parser === "yaml"
              ? [import("prettier/plugins/yaml")]
              : [
                  import("prettier/plugins/html"),
                  import("prettier/plugins/babel"),
                  import("prettier/plugins/estree"),
                  import("prettier/plugins/postcss"),
                ];
  return format(text, {
    filepath: path,
    parser,
    plugins: await Promise.all(imports),
    tabWidth: options.tabSize || 2,
    useTabs: options.insertSpaces === false,
    endOfLine: text.includes("\r\n") ? "crlf" : "lf",
  });
}
