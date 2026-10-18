# Specification: Formula interpreter

Status: draft
Owner: João Moog

## Problem

Calculated measures let a finance user write `realizado / colaboradores` or
`(realizado - orcado) / orcado * 100` and see it as a widget value. The prototype
evaluates these with a hand-written arithmetic parser (`calculateFormula`) so that
no user text ever reaches JavaScript evaluation, and reports mistakes in pt-BR
sentences the measure dialog shows verbatim. That parser is 30 lines inside a file
that also holds the sanitizer; its accepted grammar, its five error messages, its
120-token and 300-character limits and its variable scope are documented nowhere,
and its errors are thrown exceptions that the chart code swallows into `null`
without keeping the message. The rewrite runs the same expressions on the server
(export, assistant context) and in the browser (studio), so the language must be
specified precisely enough that both sides agree on every result and every error,
and the "never executes user code" property must be provable by a test, not by
reading.

## Goal

A specified, safe expression language for measures — numbers, identifiers,
parentheses and `+ − * /` with unary sign — evaluated over the group scope
`{ params, realizado, orcado, registros }` with the prototype's pt-BR error
messages, returning results instead of throwing, and plugged into the query
engine's measure evaluator.

## Out of scope

- The measure editor, live validation display, parameter forms and the
  `Resultado no recorte:` preview line: 014-measures-and-parameters-ui.
- Storing measures and parameters (they are part of the document defined in
  002-domain-schema and persisted by 007-analyses-and-sources-persistence).
- Any function call syntax, comparison or boolean operators, exponentiation,
  string literals, conditionals, or references from one measure to another
  (see the open question).
- Deciding which rows form a group: the engine of 003-query-engine hands this
  interpreter the totals of a group; the interpreter never sees rows.
- Unit or currency awareness: the result is a plain number; how it is shown is
  the widget's `format`, `unit` and `decimals` from 002-domain-schema.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-00401 | Event | WHEN an expression is evaluated, the interpreter SHALL first lower-case it and replace every comma with a dot, so that `REALIZADO`, `Realizado` and `realizado` name the same variable and `1,5*2` evaluates to 3. |
| FR-00402 | Ubiquitous | The interpreter SHALL tokenise the normalised expression into numbers (`\d+(\.\d+)?` or `\.\d+`), identifiers (`[a-z_][a-z_0-9]*`) and the single-character operators `(`, `)`, `+`, `*`, `/`, `-`, ignoring whitespace (spaces, tabs, line breaks) between tokens. |
| FR-00403 | Unwanted | IF the tokens joined without separators differ from the expression with all whitespace removed (any character outside the token grammar, such as `^`, `%`, `,` after normalisation is impossible, `5.`, `1..2`, `"`, `;`), THEN the interpreter SHALL fail with exactly `Use números, variáveis, parênteses e + − * /.` (the minus is U+2212). |
| FR-00404 | Unwanted | IF the expression yields more than 120 tokens, THEN the interpreter SHALL fail with `Use números, variáveis, parênteses e + − * /.` before parsing, so that 60 ones joined by 59 pluses (119 tokens) evaluates to 60 and 61 ones joined by 60 pluses (121 tokens) is refused. |
| FR-00405 | Unwanted | IF the expression is longer than 300 characters before normalisation, THEN the interpreter SHALL fail with `Expressão inválida.` without tokenising. |
| FR-00406 | Ubiquitous | The interpreter SHALL parse with the grammar `sum := product (('+' \| '-') product)*`, `product := atom (('*' \| '/') atom)*`, `atom := number \| identifier \| '(' sum ')' \| '+' atom \| '-' atom`, left-associative, so that `1+2*3` = 7, `2 * (3 + 4) - 5 / 5` = 13, `-2*3` = −6, `2*-3` = −6, `2--3` = 5, `--3` = 3, `-(2+3)` = −5 and `.5` = 0.5. |
| FR-00407 | Ubiquitous | The interpreter SHALL resolve an identifier only against the own properties of the scope object it is given, whose keys are the document's parameters plus `realizado`, `orcado` and `registros`, converting the found value with numeric conversion; an inherited property (`constructor`, `hasownproperty`, `__proto__`, `tostring`) SHALL never resolve. |
| FR-00408 | Unwanted | IF an identifier is not in the scope, THEN the interpreter SHALL fail with `Variável desconhecida: ` followed by the identifier as tokenised (lower-cased), for example `Variável desconhecida: x` and `Variável desconhecida: __proto__`. |
| FR-00409 | Unwanted | IF a token is required and none remains (empty or whitespace-only expression, a trailing operator such as `1 +`, a lone `+`), THEN the interpreter SHALL fail with exactly `Variável desconhecida: expressão incompleta`. |
| FR-00410 | Unwanted | IF an opening parenthesis is not matched by a closing one before the tokens end, THEN the interpreter SHALL fail with exactly `Feche os parênteses.` |
| FR-00411 | Unwanted | IF a division's right operand evaluates to exactly 0 (`3/0`, `registros/0`, `1/(2-2)`), THEN the interpreter SHALL fail with exactly `Divisão por zero neste recorte.` |
| FR-00412 | Unwanted | IF tokens remain after a complete expression has been parsed (`2(3)`, `1 2`, `1e3`, `realizado,5`), or the result is not a finite number (`1e200*1e200`), THEN the interpreter SHALL fail with exactly `Expressão inválida.` |
| FR-00413 | Ubiquitous | The interpreter SHALL compute in IEEE 754 double precision with the host's arithmetic, so that `0.1+0.2` yields 0.30000000000000004, `realizado / colaboradores` with `realizado` 1 284 000 and `colaboradores` 100 yields 12 840, and `(realizado - orcado) / orcado * 100` with `orcado` 1 300 000 yields −1.2307692307692308. |
| FR-00414 | Ubiquitous | The interpreter SHALL return a result value `{ ok: true, value }` or `{ ok: false, message }` where `message` is one of the five catalogue strings, and SHALL NOT throw for any string input up to the length limit. |
| FR-00415 | Ubiquitous | The interpreter SHALL expose the five error messages as one catalogue — `Use números, variáveis, parênteses e + − * /.`, `Feche os parênteses.`, `Variável desconhecida: ` (prefix), `Divisão por zero neste recorte.`, `Expressão inválida.` — and every failure SHALL reference the catalogue entry, never an inline string. |
| FR-00416 | Ubiquitous | The interpreter SHALL provide the query engine's measure evaluator: given a measure and a scope, it evaluates the measure's `expression` and returns the result value, so that a widget whose `value` is a measure shows the number for each group and `null` with the catalogue message when evaluation fails. |
| FR-00417 | Event | WHEN a measure is assigned as a widget's value or comparison, the interpreter module SHALL supply the display defaults the assignment applies: the measure's `format`, and `decimals` 1 when the format is `percent` and 2 otherwise. |
| FR-00418 | Unwanted | IF the expression names another measure's id (for example `mabc123`) or a parameter that was removed from the document, THEN the evaluator SHALL return `Variável desconhecida: <id>`, because the scope contains parameters and the three group totals only. |
| FR-00419 | Ubiquitous | Given the same expression and a deep-equal scope, the interpreter SHALL return a deep-equal result on the server and in the browser, and the parse SHALL NOT retain any state between calls. |
| NFR-00401 | Ubiquitous | 10 000 evaluations of a 20-token expression against a 10-key scope SHALL complete in under 100 ms on the continuous-integration runner, measured as the median of 10 runs. |
| NFR-00402 | Ubiquitous | The interpreter's source SHALL contain zero occurrences of `eval(`, `Function(`, `new Function`, `setTimeout(` or `setInterval(` with a string argument, `import(` with a computed argument, `vm.` or `with(`, verified by a test that scans the formula directory and by the lint rules `no-eval`, `no-new-func` and `no-implied-eval` being enabled as errors. |
| NFR-00403 | Ubiquitous | The interpreter SHALL import nothing from React, Next.js, `node:*`, server or UI modules, verified by the lint script exiting 0 with the import restriction enabled. |
| NFR-00404 | Ubiquitous | The interpreter SHALL evaluate an expression of the maximum size (300 characters, 120 tokens, 59 nested parentheses) with a call stack depth under 500 frames and without exceeding 1 MB of heap growth per call. |

## Open questions

`[NEEDS CLARIFICATION: are comma decimals kept as the prototype accepts them (`1,5` → 1.5, so `1.000` reads as one, never one thousand, and a comma can never separate arguments)? Dropping them changes FR-00401 and every formula a user pasted from a pt-BR spreadsheet.]`

`[NEEDS CLARIFICATION: should an error carry the character position of the offending token so the editor of 014-measures-and-parameters-ui can highlight it? The prototype has no position; adding one changes the result value shape and the catalogue prefix form.]`

`[NEEDS CLARIFICATION: may a measure reference another measure by name or id? The prototype does not (only parameters and the three totals are in scope); allowing it needs dependency ordering, cycle detection and a sixth error message.]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/004-formula-interpreter
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.
