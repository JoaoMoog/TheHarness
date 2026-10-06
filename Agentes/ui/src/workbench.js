export function resolveMarkers(text, choice) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/),
    result = [];
  let ours = [],
    theirs = [],
    phase = null;
  for (const line of lines) {
    if (line.startsWith("<<<<<<<")) {
      if (phase) throw new Error("Conflito aninhado; edite manualmente.");
      ours = [];
      theirs = [];
      phase = "ours";
    } else if (phase && line.startsWith("|||||||")) phase = "base";
    else if (phase && line.startsWith("=======")) phase = "theirs";
    else if (phase && line.startsWith(">>>>>>>")) {
      if (phase !== "theirs")
        throw new Error("Marcadores incompletos; edite manualmente.");
      if (choice !== "theirs") result.push(...ours);
      if (choice !== "ours") result.push(...theirs);
      phase = null;
    } else if (phase === "ours") ours.push(line);
    else if (phase === "theirs") theirs.push(line);
    else if (!phase) result.push(line);
  }
  if (phase) throw new Error("Marcadores incompletos; edite manualmente.");
  return result.join(eol);
}
export function readyUrl(output, ready) {
  const plain = output
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "");
  const pattern = ready.pattern || "\\bNow listening on:\\s+(https?://\\S+)";
  const match = new RegExp(pattern).exec(plain);
  if (!match) return null;
  const uri = ready.uriFormat
    ? ready.uriFormat.replace("%s", match[1] || "")
    : match[1];
  if (!uri || !/^https?:\/\//i.test(uri))
    throw new Error(
      "serverReadyAction precisa retornar uma URL HTTP/HTTPS; defina uriFormat.",
    );
  return uri;
}
