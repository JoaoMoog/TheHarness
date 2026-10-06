import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";
const svg = readFileSync(
  new URL("../../assets/speedcode.svg", import.meta.url),
);
const images = [16, 32, 48, 64, 128, 256].map((width) =>
  new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng(),
);
writeFileSync(
  new URL("../../assets/speedcode.png", import.meta.url),
  images.at(-1),
);
writeFileSync(
  new URL("../../assets/speedcode.ico", import.meta.url),
  await pngToIco(images),
);
