// Immutable reference snapshot. Monaco positions/columns are UTF-16, 1-based.
export function editorSnapshot(file, selection) {
  if (!file?.model || !file.root || !file.path)
    throw new Error("Abra um arquivo de texto primeiro.");
  const range = selection || file.model.getFullModelRange();
  const text = file.model.getValueInRange(range);
  if (!text || new TextEncoder().encode(text).length > 64 * 1024)
    throw new Error(
      "Seleção vazia ou maior que 64 KiB. Selecione um trecho menor.",
    );
  return {
    root: file.root,
    path: file.path,
    text,
    dirty: !!file.dirty,
    startLine: range.startLineNumber,
    startColumn: range.startColumn,
    endLine: range.endLineNumber,
    endColumn: range.endColumn,
  };
}
export function diagnosticsText(info) {
  const runtime = info?.runtime?.version
    ? `Copilot CLI ${info.runtime.version} · protocolo ${info.runtime.protocolVersion ?? "indisponível"}`
    : "Versão do runtime indisponível";
  if (!info?.session)
    return `${runtime}\n\nInicie uma sessão. Diagnóstico não chama o modelo.`;
  const parts = [
    runtime,
    `Política: ${info.policy === "available" ? "disponível (cada arquivo ainda será verificado)" : "não confirmada · fallback nativo"}`,
    `${info.registeredLocalTools ?? 0} ferramentas Rust · ${info.mcpTools ?? 0} MCP · sessão em RAM`,
  ];
  const usage = info.usage;
  const fmt = (v) =>
    Number.isFinite(v) ? v.toLocaleString("pt-BR") : "indisponível";
  if (usage)
    parts.push(
      `Entrada sem cache: ${fmt(usage.uncachedInputTokens)}\nCache do provedor: leitura ${fmt(usage.cacheReadTokens)} · escrita ${fmt(usage.cacheWriteTokens)}\nSaída: ${fmt(usage.outputTokens)}\nCache não é economia de créditos comprovada.`,
    );
  const c = info.context?.contextInfo;
  if (c)
    parts.push(
      `Contexto: sistema ${fmt(c.systemTokens)} · conversa ${fmt(c.conversationTokens)} · ferramentas ${fmt(c.toolDefinitionsTokens)} · MCP ${fmt(c.mcpToolsTokens)}`,
    );
  else parts.push("Distribuição de contexto não disponibilizada pelo runtime.");
  return parts.join("\n\n");
}
