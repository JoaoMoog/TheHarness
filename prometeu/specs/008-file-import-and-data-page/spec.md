# Specification: File import and data page

Status: draft
Owner: João Moog

## Problem

The prototype parses CSV, TXT and XLSX files inside the browser ("Arquivos são lidos no
seu navegador"), keeps the rows in localStorage and lists them on a data page that says
"Disponíveis apenas neste dispositivo". Its parser and validator are the contract
people already rely on: delimiter sniffing, quoted fields, accent-insensitive column
names, comma decimals, row-numbered pt-BR errors and a sample CSV. With sources stored
per workspace (007-analyses-and-sources-persistence) the file must reach the server
anyway, so parsing and validation move there, in one path, with the same messages,
and the data page shows the workspace's sources instead of the device's. Two
prototype strings change: the limit message loses the word "protótipo", and the
privacy callout no longer claims browser-only processing.

## Goal

An Editor uploads a CSV, TXT or XLSX file, sees a validated preview or a row-numbered
error, confirms once to get a new source and a new analysis in the current workspace,
and `/dados` lists the workspace's sources with the demonstration card, the sample CSV
and source removal.

## Out of scope

- The SAP connector: this spec only guarantees that a new source kind can be added
  without changing the consumers of sources and rows. The `Ver conexão` and
  `Explorar modelo` dialogs stay descriptive as in the prototype.
- Editing rows, appending to an existing source, re-importing over a source.
- CSV export of an analysis' rows (017-presentation-and-export).
- Character encodings other than UTF-8 (see the open questions) and files beyond the
  limits stated below.
- Modelos de dados: the card stays a `Próxima etapa` placeholder.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-00801 | Event | WHEN an Editor submits a file for import, the application SHALL parse and validate it on the server and answer with a preview or a single pt-BR error, storing no source until the import is confirmed. |
| FR-00802 | Unwanted | IF the file is larger than 3 MB, THEN the application SHALL refuse it before parsing with the message `O arquivo excede 3 MB.`. |
| FR-00803 | Ubiquitous | The application SHALL decide the file format from its content, treating a file that starts with the ZIP signature and contains a workbook as XLSX and any other file as delimited text, regardless of its extension. |
| FR-00804 | Unwanted | IF the content is neither a workbook nor decodable UTF-8 text, THEN the application SHALL refuse with the message `Formato não reconhecido. Envie CSV, TXT delimitado ou XLSX.`. |
| FR-00805 | Event | WHEN delimited text starts with a byte-order mark, the application SHALL discard the mark before reading the header. |
| FR-00806 | Ubiquitous | The application SHALL choose the delimiter from the first line: tab if it contains one, otherwise `;` if it contains one, otherwise `,`. |
| FR-00807 | Ubiquitous | The application SHALL read fields enclosed in double quotes with `""` as an escaped quote, keeping delimiters and line breaks inside quotes, SHALL accept CR, LF and CRLF line endings, and SHALL skip lines whose fields are all blank. |
| FR-00808 | Unwanted | IF a quoted field is not closed before the end of the file, THEN the application SHALL refuse with the message `Há aspas não fechadas no arquivo.`. |
| FR-00809 | Event | WHEN the file is a workbook, the application SHALL read only its first sheet, use numeric cells as numbers and convert native date cells in the date column to `AAAA-MM-DD`. |
| FR-00810 | Unwanted | IF the first sheet declares more than 10,000 rows or more than 100 columns, THEN the application SHALL refuse with the message `A planilha excede o tamanho aceito.` without loading its cells. |
| FR-00811 | Unwanted | IF the table has fewer than two rows, THEN the application SHALL refuse with the message `Inclua um cabeçalho e pelo menos uma linha de dados.`. |
| FR-00812 | Ubiquitous | The application SHALL match the header names `data`, `area`, `categoria`, `realizado` and `orcado` without regard to case, accents or surrounding spaces, in any column order, ignoring extra columns. |
| FR-00813 | Unwanted | IF any of the five columns is missing, THEN the application SHALL refuse with the message `Colunas necessárias: data, area, categoria, realizado, orcado. Baixe o arquivo de exemplo.`. |
| FR-00814 | Ubiquitous | The application SHALL read numeric values by removing `R$` and whitespace and, when a comma is present, treating dots as thousands separators and the comma as the decimal separator, so that `R$ 1.234,56` reads as 1234.56 and `1234.56` reads as 1234.56. |
| FR-00815 | Unwanted | IF a row's date is not a real calendar date in the form `AAAA-MM-DD`, THEN the application SHALL refuse with `Linha N: use uma data válida no formato AAAA-MM-DD.`, N being the row's line number in the file counting the header as line 1. |
| FR-00816 | Unwanted | IF a row's area or category is empty or longer than 100 characters after trimming, THEN the application SHALL refuse with `Linha N: área e categoria são obrigatórias (até 100 caracteres).`. |
| FR-00817 | Unwanted | IF a row's realizado or orçado is not a finite number greater than or equal to zero, THEN the application SHALL refuse with `Linha N: realizado e orçado devem ser números positivos ou zero.`. |
| FR-00818 | Unwanted | IF the file has a header but no data row after skipping blank lines, THEN the application SHALL refuse with `O arquivo não contém registros.`. |
| FR-00819 | Unwanted | IF the file has more than 5,000 data rows, THEN the application SHALL refuse with `São aceitos até 5.000 registros por arquivo.` before validating individual rows. |
| FR-00820 | Event | WHEN every row is valid, the preview SHALL show `<n> registros válidos. Total realizado: <total>.` with the total formatted as pt-BR currency, a table with the columns `Área`, `Categoria` and `Realizado` holding exactly the first three rows, and the action `Criar dashboard com este arquivo`. |
| FR-00821 | Event | WHEN the Editor confirms the preview, the application SHALL create a source of the file kind named after the file, holding the validated rows, and an analysis from it as defined in 007-analyses-and-sources-persistence, navigate to that analysis and show the toast `Arquivo importado. Seu dashboard está pronto.`. |
| FR-00822 | Unwanted | IF the same preview is confirmed more than once, THEN the application SHALL create no second source or analysis and answer with the ones already created. |
| FR-00823 | Unwanted | IF a preview is confirmed more than 30 minutes after it was produced, THEN the application SHALL refuse with the message `A prévia expirou. Envie o arquivo novamente.`. |
| FR-00824 | Unwanted | IF the file name contains a path separator or a control character, or is longer than 255 characters, THEN the application SHALL refuse with the message `Nome de arquivo inválido.`. |
| FR-00825 | Unwanted | IF a Leitor submits, confirms or deletes an import, THEN the application SHALL refuse with HTTP 403 as defined in 006-workspaces-and-roles. |
| FR-00826 | Ubiquitous | The import dialog SHALL be titled `Importar seus dados`, describe `CSV, TXT delimitado ou XLSX. Até 5.000 linhas e 3 MB. A primeira planilha do Excel será usada.`, offer a file field accepting `.csv,.txt,.xlsx`, state the columns `data, area, categoria, realizado, orcado` with the hint `Data no formato AAAA-MM-DD. Excel: células numéricas para valores e texto para data.`, offer `Baixar CSV de exemplo`, and announce the preview or error through a polite live region. |
| FR-00827 | Ubiquitous | `/dados` SHALL render the heading `De onde vêm seus dados?`, the action `Importar arquivo`, three cards — `SAP S/4HANA` with the tags `Demonstração` and `90 registros` and the action `Ver conexão`, `Seus arquivos` with the action `Escolher arquivo`, and `Modelos de dados` with the tag `Próxima etapa` and the action `Explorar modelo` — and a callout stating that files are processed on the server inside the workspace and are sent neither to SAP nor to an AI service. |
| FR-00828 | Ubiquitous | `/dados` SHALL render the section `Biblioteca de fontes` with the subtitle `Disponíveis neste workspace` and a table with the columns `Fonte`, `Tipo`, `Registros`, `Status` and `Ação`, one row per source of the current workspace: the demonstration source as `SAP · Custos e orçamento`, `Conjunto demonstrativo`, `90`, `Fictício`, and each file source as its name, `Arquivo importado`, its row count, `Disponível`; every row offers `Criar análise` and file rows also offer a delete button with the accessible name `Excluir <name>`. |
| FR-00829 | Event | WHEN a person activates `Baixar CSV de exemplo`, the application SHALL deliver a file named `prometeu-exemplo.csv`, UTF-8 with a byte-order mark, CRLF line endings, the header `data;area;categoria;realizado;orcado`, every field double-quoted, numbers with two decimals and a comma, containing exactly the demonstration rows whose area is `Tecnologia`. |
| FR-00830 | Event | WHEN the sample file is imported unchanged, the application SHALL produce a preview of 30 valid rows. |
| FR-00831 | Event | WHEN an Editor confirms the deletion of a file source in the dialog titled `Excluir fonte?` with the actions `Cancelar` and `Excluir fonte`, the application SHALL mark the source deleted so that it disappears from every list and its rows answer HTTP 404, keeping its data for recovery. |
| FR-00832 | Unwanted | IF deletion is requested for the demonstration source, THEN the application SHALL refuse with the message `A fonte de demonstração não pode ser removida.`. |
| FR-00833 | Ubiquitous | The explorer sidebar SHALL render a `Fontes` block listing `SAP S/4HANA` with `Base demonstrativa` and every file source of the workspace, with an `Adicionar fonte` button that opens the import dialog. |
| FR-00834 | Ubiquitous | Every consumer of sources and rows SHALL read a source through its kind-independent name, row count and rows, so that a source of a kind introduced later is listed, opened and analysed without changes to those consumers. |
| NFR-00801 | Ubiquitous | Parsing and validating a 5,000-row CSV of 3 MB SHALL complete within 1 second at p95 on the local server. |
| NFR-00802 | Ubiquitous | Parsing and validating a 3 MB XLSX SHALL complete within 3 seconds at p95 on the local server. |
| NFR-00803 | Ubiquitous | One import SHALL never hold more than 64 MB of additional process memory at its peak, measured on the 3 MB XLSX case. |
| NFR-00804 | Ubiquitous | The preview response for a valid 3 MB file SHALL be under 8 KB, independent of the number of rows. |
| NFR-00805 | Ubiquitous | An automated accessibility scan of `/dados`, the import dialog in its preview and error states and the delete dialog SHALL report zero violations of impact `serious` or `critical`. |

## Open questions

`[NEEDS CLARIFICATION: keep the prototype's 3 MB and 5,000-row limits now that parsing is server-side, or raise them? Both messages, the row cap of the rows endpoint and the timing requirements carry the numbers.]`

`[NEEDS CLARIFICATION: deleting a source that analyses reference — refuse, cascade the deletion, or leave the analyses with a `Fonte indisponível` label as the prototype did? It decides whether the delete needs a reference count and what the analysis page shows.]`

`[NEEDS CLARIFICATION: two files with the same name in one workspace — allowed, renamed with a counter, or refused? It changes the source name rule.]`

`[NEEDS CLARIFICATION: accept Windows-1252/Latin-1 text with a fallback decode, or refuse as unrecognised? Spreadsheet exports from Excel on Windows are often not UTF-8.]`

`[NEEDS CLARIFICATION: cap on sources per workspace — none in the prototype; a cap needs a number and a message.]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/008-file-import-and-data-page
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.
