import type { Cell } from './types';

type Node = { kind: 'number'; value: number } | { kind: 'field'; key: string } | { kind: 'binary'; op: string; left: Node; right: Node } | { kind: 'negative'; child: Node };
/** Deliberately small arithmetic grammar. Never evaluates JavaScript or function calls. */
export function compileExpression(expression: string, allowedFields?: string[]) {
  if (!expression.trim() || expression.length > 500) throw new Error('Escreva uma fórmula com até 500 caracteres.');
  const tokens = expression.match(/\[[^\[\]]+\]|(?:\d+(?:\.\d*)?|\.\d+)|[()+*/-]|\S/g) || [];
  let index = 0;
  let depth = 0;
  const fields = new Set<string>();
  function atom(): Node {
    if (++depth > 32) throw new Error('A fórmula tem parênteses demais.');
    const token = tokens[index++];
    let node: Node;
    if (token === '-') node = { kind: 'negative', child: atom() };
    else if (token === '+') node = atom();
    else if (token === '(') { node = sum(); if (tokens[index++] !== ')') throw new Error('Feche os parênteses da fórmula.'); }
    else if (/^\[(.+)\]$/.test(token || '')) {
      const key = token.slice(1, -1);
      if (allowedFields && !allowedFields.includes(key)) throw new Error(`O campo [${key}] não é numérico ou não está disponível.`);
      fields.add(key); node = { kind: 'field', key };
    } else if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token || '')) { if (!Number.isFinite(Number(token))) throw new Error('Use números finitos na fórmula.'); node = { kind: 'number', value: Number(token) }; }
    else throw new Error('Use campos entre colchetes, números, +, −, *, / e parênteses.');
    depth--; return node;
  }
  function product(): Node { let node = atom(); while (tokens[index] === '*' || tokens[index] === '/') { const op = tokens[index++]; node = { kind: 'binary', op, left: node, right: atom() }; } return node; }
  function sum(): Node { let node = product(); while (tokens[index] === '+' || tokens[index] === '-') { const op = tokens[index++]; node = { kind: 'binary', op, left: node, right: product() }; } return node; }
  const tree = sum();
  if (index !== tokens.length) throw new Error('Há um trecho inválido na fórmula. Não use funções ou código.');
  function evaluate(node: Node, row: Record<string, Cell>): number | null {
    if (node.kind === 'number') return node.value;
    if (node.kind === 'field') { const value = row[node.key]; return typeof value === 'number' && Number.isFinite(value) ? value : null; }
    if (node.kind === 'negative') { const value = evaluate(node.child, row); return value == null ? null : -value; }
    const a = evaluate(node.left, row), b = evaluate(node.right, row);
    if (a == null || b == null || (node.op === '/' && b === 0)) return null;
    const value = node.op === '+' ? a + b : node.op === '-' ? a - b : node.op === '*' ? a * b : a / b;
    return Number.isFinite(value) ? value : null;
  }
  return { fields: [...fields], evaluate: (row: Record<string, Cell>) => evaluate(tree, row) };
}
