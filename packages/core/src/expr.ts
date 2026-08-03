/**
 * Tiny, safe expression evaluator for `bind.expr` and machine input-conditions.
 *
 * Deliberately NOT `expr-eval`: a hand-written recursive-descent parser over a
 * fixed grammar (numbers, identifiers, + - * /, parens, a whitelisted function
 * set) gives the same safety guarantee with zero extra runtime dependency and
 * no ESM/typing friction. See plan A3 note: "if expr-eval fights TypeScript
 * ESM, a small hand-written parser is acceptable."
 */

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '(' | ')' | ',' };

const WHITELISTED_FUNCTIONS = new Set(['lerp', 'clamp', 'min', 'max', 'abs']);

// Bound the surface a hostile/malformed expression can attack: a very long
// or deeply-nested expr (e.g. `"(".repeat(1e5)`) would otherwise recurse
// once per '(' through parseAddSub -> parseMulDiv -> parseUnary ->
// parsePrimary and blow the call stack with an uncatchable-feeling
// RangeError. Reject it up front as a normal, caught Error instead.
const MAX_EXPR_LENGTH = 500;
const MAX_EXPR_DEPTH = 64;

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === undefined) break;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if ('+-*/(),'.includes(c)) {
      tokens.push({ kind: 'op', value: c as '+' | '-' | '*' | '/' | '(' | ')' | ',' });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < expr.length && /[0-9.]/.test(expr[j] as string)) j++;
      const raw = expr.slice(i, j);
      const value = Number(raw);
      if (Number.isNaN(value)) {
        throw new Error(`invalid number literal "${raw}" in expression "${expr}"`);
      }
      tokens.push({ kind: 'num', value });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j] as string)) j++;
      tokens.push({ kind: 'ident', value: expr.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`unexpected character "${c}" in expression "${expr}"`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  private depth = 0;
  constructor(
    private tokens: Token[],
    private scope: Record<string, number>,
    private exprSrc: string,
  ) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new Error(`unexpected end of expression "${this.exprSrc}"`);
    this.pos++;
    return t;
  }

  private expectOp(value: string): void {
    const t = this.next();
    if (t.kind !== 'op' || t.value !== value) {
      throw new Error(`expected "${value}" in expression "${this.exprSrc}"`);
    }
  }

  parse(): number {
    const value = this.parseAddSub();
    if (this.pos !== this.tokens.length) {
      throw new Error(`unexpected trailing tokens in expression "${this.exprSrc}"`);
    }
    return value;
  }

  private parseAddSub(): number {
    let value = this.parseMulDiv();
    for (;;) {
      const t = this.peek();
      if (t?.kind === 'op' && (t.value === '+' || t.value === '-')) {
        this.next();
        const rhs = this.parseMulDiv();
        value = t.value === '+' ? value + rhs : value - rhs;
      } else {
        break;
      }
    }
    return value;
  }

  private parseMulDiv(): number {
    let value = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t?.kind === 'op' && (t.value === '*' || t.value === '/')) {
        this.next();
        const rhs = this.parseUnary();
        value = t.value === '*' ? value * rhs : value / rhs;
      } else {
        break;
      }
    }
    return value;
  }

  private parseUnary(): number {
    const t = this.peek();
    if (t?.kind === 'op' && t.value === '-') {
      this.next();
      return -this.parseUnary();
    }
    if (t?.kind === 'op' && t.value === '+') {
      this.next();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parseArgs(): number[] {
    this.expectOp('(');
    const args: number[] = [];
    if (!(this.peek()?.kind === 'op' && this.peek()?.value === ')')) {
      args.push(this.parseAddSub());
      while (this.peek()?.kind === 'op' && this.peek()?.value === ',') {
        this.next();
        args.push(this.parseAddSub());
      }
    }
    this.expectOp(')');
    return args;
  }

  private parsePrimary(): number {
    const t = this.next();
    if (t.kind === 'num') return t.value;
    if (t.kind === 'ident') {
      if (this.peek()?.kind === 'op' && this.peek()?.value === '(') {
        return this.callFunction(t.value);
      }
      if (!Object.hasOwn(this.scope, t.value)) {
        throw new Error(`unknown identifier "${t.value}" in expression "${this.exprSrc}"`);
      }
      return this.scope[t.value] as number;
    }
    if (t.kind === 'op' && t.value === '(') {
      this.depth++;
      if (this.depth > MAX_EXPR_DEPTH) {
        throw new Error(`expression "${this.exprSrc}" nests too deeply (max ${MAX_EXPR_DEPTH})`);
      }
      const value = this.parseAddSub();
      this.expectOp(')');
      this.depth--;
      return value;
    }
    throw new Error(`unexpected token in expression "${this.exprSrc}"`);
  }

  private callFunction(name: string): number {
    if (!WHITELISTED_FUNCTIONS.has(name)) {
      throw new Error(`unknown function "${name}" in expression "${this.exprSrc}"`);
    }
    this.depth++;
    if (this.depth > MAX_EXPR_DEPTH) {
      throw new Error(`expression "${this.exprSrc}" nests too deeply (max ${MAX_EXPR_DEPTH})`);
    }
    const args = this.parseArgs();
    this.depth--;
    switch (name) {
      case 'lerp': {
        const [a, b, t] = args;
        if (a === undefined || b === undefined || t === undefined) {
          throw new Error(`lerp requires 3 arguments in expression "${this.exprSrc}"`);
        }
        return a + (b - a) * t;
      }
      case 'clamp': {
        const [x, lo, hi] = args;
        if (x === undefined || lo === undefined || hi === undefined) {
          throw new Error(`clamp requires 3 arguments in expression "${this.exprSrc}"`);
        }
        return Math.min(Math.max(x, lo), hi);
      }
      case 'min':
        if (args.length === 0) throw new Error(`min requires at least 1 argument`);
        return Math.min(...args);
      case 'max':
        if (args.length === 0) throw new Error(`max requires at least 1 argument`);
        return Math.max(...args);
      case 'abs': {
        const [x] = args;
        if (x === undefined) throw new Error(`abs requires 1 argument`);
        return Math.abs(x);
      }
      default:
        throw new Error(`unhandled function "${name}"`);
    }
  }
}

export function evalExpr(expr: string, scope: Record<string, number>): number {
  if (expr.length > MAX_EXPR_LENGTH) {
    throw new Error(
      `expression exceeds max length of ${MAX_EXPR_LENGTH} characters (got ${expr.length})`,
    );
  }
  const tokens = tokenize(expr);
  if (tokens.length === 0) {
    throw new Error('empty expression');
  }
  return new Parser(tokens, scope, expr).parse();
}

export const CONDITION_OPS = ['<=', '>=', '==', '!=', '<', '>'] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];

export interface SplitCondition {
  input: string;
  op: ConditionOp;
  raw: string;
}

/**
 * Splits a condition-form `on` key ("<input> <op> <value>") into its parts.
 * Returns `null` if no comparison operator is found, or if either side is
 * empty (e.g. "progress>" — an operator with no RHS). Longer two-character
 * operators (`<=`, `>=`, `==`, `!=`) are checked before the single-character
 * ones so e.g. ">=" is never misread as a bare ">".
 *
 * Single-sourced (fix #8): both `validate.ts`'s `classifyOnKey` (via
 * `./onkey.js`) and `evalCondition` below parse conditions through this one
 * function, so an ambiguous key (one with both a comparison op AND a dot,
 * e.g. "a>b.click") is classified identically everywhere — including by the
 * player's machine mapping, which also imports `classifyOnKey`.
 */
export function splitCondition(key: string): SplitCondition | null {
  for (const op of CONDITION_OPS) {
    const idx = key.indexOf(op);
    if (idx > 0) {
      const input = key.slice(0, idx).trim();
      const raw = key.slice(idx + op.length).trim();
      if (input.length === 0 || raw.length === 0) {
        return null;
      }
      return { input, op, raw };
    }
  }
  return null;
}

function compare(op: ConditionOp, lhs: number | string, rhs: number | string): boolean {
  switch (op) {
    case '==':
      return lhs === rhs;
    case '!=':
      return lhs !== rhs;
    case '<':
      return lhs < rhs;
    case '>':
      return lhs > rhs;
    case '<=':
      return lhs <= rhs;
    case '>=':
      return lhs >= rhs;
  }
}

export function evalCondition(cond: string, inputs: Record<string, number | string>): boolean {
  const split = splitCondition(cond);
  if (!split) {
    throw new Error(`malformed condition "${cond}": no comparison operator found`);
  }
  const { input: inputName, op, raw: rawValue } = split;
  if (!(inputName in inputs)) {
    throw new Error(`condition "${cond}" references unknown input "${inputName}"`);
  }
  const inputValue = inputs[inputName] as number | string;
  const asNumber = Number(rawValue);
  const literal: number | string = Number.isNaN(asNumber) ? rawValue : asNumber;
  return compare(op, inputValue, literal);
}
