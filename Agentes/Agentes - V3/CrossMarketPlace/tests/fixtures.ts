// Small synthetic solutions shared by the domain tests.
export const base = {
  id: "s1", name: "Leitor de Contratos", summary: "Extrai cláusulas e riscos de contratos em PDF", category: "agentes",
  tags: ["ocr", "genai", "jurídico"], teamId: "juridico", ownerId: "u-ar", access: "direto", approval: "aprovada",
  lifecycle: "producao", archived: false, version: "v2.3.0", versions: [], history: [],
  ratings: [{ userId: "u1", stars: 5, comment: "", at: "2026-09-01" }, { userId: "u2", stars: 4, comment: "", at: "2026-09-02" }],
  usage: { views: 1000, interests: 200, confirmed: 100, hours: 50 }, uses: [], updatedAt: "2026-10-04",
};
export const make = (over: Record<string, unknown>) => ({ ...base, ...over });
