import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function load(url, context, nextLoad) {
  if (url.endsWith(".yaml") || url.endsWith(".yml")) {
    const filePath = fileURLToPath(url);
    const source = readFileSync(filePath, "utf8");
    return {
      format: "module",
      shortCircuit: true,
      source: `const content = ${JSON.stringify(source)};\nexport default content;\n`,
    };
  }
  return nextLoad(url, context);
}
