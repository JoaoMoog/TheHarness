# ADR-002: Git CLI estruturado

Status: PROPOSTO.

Contexto: o host já possui Git e a autenticação/políticas existentes devem ser respeitadas. O MVP não precisa recriar o protocolo Git.

Decisão: executar Git por caminho aprovado, cwd de repositório explícito e argv estruturado. Status deve usar porcelain v2 com NUL; diffs usam no-ext-diff e fontes explícitas. Paths usam delimitador apropriado. Operações que alcançam rede exigem confirmação.

Consequências: hooks, LFS, assinatura, worktrees, submódulos, conflitos e mensagens de erro continuam pertencendo ao Git e aparecem como resultado, não como estado inventado. Fixtures e bare remoto local são obrigatórios. Não há parsing de saída humana, reset hard, clean ou force push.

Alternativa: biblioteca Git embutida foi adiada, pois ampliaria compatibilidade e política a validar sem benefício comprovado.
