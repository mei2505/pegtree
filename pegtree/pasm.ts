// PContext

class PContext {
  x: string;
  pos: number;
  epos: number;
  headpos: number;
  ast: PTree | null;
  state: PState | null;
  memos: PMemo[];
  constructor(inputs: string, pos: number, epos: number) {
    this.x = inputs;
    this.pos = pos;
    this.epos = epos;
    this.headpos = pos
    this.ast = null
    this.state = null
    this.memos = [];
    for (var i = 0; i < 1789; i += 1) {
      this.memos.push(new PMemo());
    }
  }
}

class PTree {
  prev: PTree | null;
  tag: string;
  spos: number;
  epos: number;
  child: PTree | null;
  constructor(prev: PTree | null, tag: string, spos: number, epos: number, child: PTree | null) {
    this.prev = prev
    this.tag = tag
    this.spos = spos
    this.epos = epos
    this.child = child
  }

  isEdge() {
    return (this.epos < 0);
  }

  dump(inputs: string) {
    const sb: string[] = []
    if (this.prev !== null) {
      sb.push(this.prev.dump(inputs))
      sb.push(',')
    }
    sb.push(`{#${this.tag} `)
    if (this.child === null) {
      sb.push("'")
      sb.push(inputs.substring(this.spos, this.epos))
      sb.push("'")
    }
    else {
      sb.push(this.child.dump(inputs))
    }
    sb.push('}')
    return sb.join('')
  }
}

class PMemo {
  key: number;
  pos: number;
  ast: PTree | null;
  result: boolean;
  constructor() {
    this.key = -1
    this.pos = 0
    this.ast = null
    this.result = false
  }
}

export type PFunc = (px: PContext) => boolean;

const match_empty: PFunc = (px: PContext) => true

const match_fail: PFunc = (px: PContext) => false

const match_any: PFunc = (px: PContext) => {
  if (px.pos < px.epos) {
    px.pos += 1
    return true
  }
  return false;
}

const match_skip: PFunc = (px: PContext) => {
  px.pos = Math.min(px.headpos, px.epos)
  return true
}

const match_trie = (px: PContext, d: any): boolean => {
  if (px.pos >= px.epos) {
    return false
  }
  if (!Array.isArray(d)) {
    const c = px.x[px.pos];
    if (c in d) {
      px.pos += 1;
      const s = d[c];
      if (typeof s === 'string') {
        if (px.x.startsWith(s, px.pos)) {
          px.pos += s.length;
          return true
        }
        return false;
      }
      return match_trie(px, s);
    }
    return false;
  }
  else {
    const inputs = px.x;
    const pos = px.pos;
    for (const s of d) {
      if (inputs.startsWith(s, pos)) {
        px.pos += s.length;
        return true
      }
    }
    return false;
  }
}
export const pEmpty = () => {
  return match_empty;
}

export const pFail = () => {
  return match_fail;
}

export const pAny = () => {
  return match_any;
}

export const pSkip = () => {
  return match_skip;
}

const CharCache: { [key: string]: PFunc } = {
  '': match_empty
}

const store = (cache: { [key: string]: PFunc }, key: string, gen: () => PFunc) => {
  if (!(key in cache)) {
    cache[key] = gen();
  }
  return cache[key];
}

export const pChar = (text: string) => {
  const clen = text.length;
  return store(CharCache, text, () => (px: PContext) => {
    if (px.x.startsWith(text, px.pos)) {
      px.pos += clen
      return true
    }
    return false
  });
}

const range_min = (chars: string, ranges: string) => {
  const s = chars + ranges;
  var min = 0xffff;
  for (var i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    min = Math.min(min, c);
  }
  return min;
}

const range_max = (chars: string, ranges: string) => {
  const s = chars + ranges;
  var min = 0;
  for (var i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    min = Math.max(min, c);
  }
  return min;
}

const range_bitmap = (chars: string, ranges: string) => {
  const codemax = range_max(chars, ranges) + 1;
  const bitmap = new Uint8Array(((codemax / 8) | 0) + 1);
  bitmap[0] = 2;
  for (var i = 0; i < chars.length; i += 1) {
    const c = chars.charCodeAt(i);
    const n = (c / 8) | 0;
    const mask = 1 << ((c % 8) | 0);
    bitmap[n] |= mask;
  }
  for (var i = 0; i < ranges.length; i += 2) {
    for (var c = ranges.charCodeAt(i); c <= ranges.charCodeAt(i + 1); c += 1) {
      const n = (c / 8) | 0;
      const mask = 1 << ((c % 8) | 0);
      bitmap[n] |= mask;
    }
  }
  return bitmap;
}

const RANGETBL: { [key: string]: string } = {
  '\n': '\\n', '\t': '\\t', '\r': '\\r', '\v': '\\v', '\f': '\\f',
  '\\': '\\\\', ']': '\\]', '-': '\\-'
}

export const keyRange = (chars: string, ranges: string) => {
  const sb = []
  sb.push('[')
  sb.push(translate(chars, RANGETBL))
  const r = ranges
  for (var i = 0; i < r.length; i += 2) {
    sb.push(translate(r[i], RANGETBL))
    sb.push('-')
    sb.push(translate(r[i + 1], RANGETBL))
  }
  sb.push(']')
  return sb.join('')
}

const Bitmaps: { [key: string]: Uint8Array } = {}

const toBitmap = (chars: string, ranges: string) => {
  const key = keyRange(chars, ranges);
  if (!(key in Bitmaps)) {
    Bitmaps[key] = range_bitmap(chars, ranges);
  }
  return Bitmaps[key];
}

export const pRange = (chars: string, ranges = '') => {
  const bitmap = toBitmap(chars, ranges);
  return (px: PContext) => {
    if (px.pos < px.epos) {
      const c = px.x.charCodeAt(px.pos);
      const n = (c / 8) | 0;
      const mask = 1 << ((c % 8) | 0);
      if (n < bitmap.length && (bitmap[n] & mask) === mask) {
        px.pos += 1;
        return true;
      }
    }
    return false;
  }
}

export const pAnd = (pf: PFunc) => {
  return (px: PContext) => {
    const pos = px.pos
    if (pf(px)) {
      px.headpos = Math.max(px.pos, px.headpos)
      px.pos = pos
      return true
    }
    return false
  }
}

export const pNot = (pf: PFunc) => {
  return (px: PContext) => {
    const pos = px.pos
    const ast = px.ast
    if (!pf(px)) {
      px.headpos = Math.max(px.pos, px.headpos)
      px.pos = pos
      px.ast = ast
      return true
    }
    return false
  }
}

export const pMany = (pf: PFunc) => {
  return (px: PContext) => {
    var pos = px.pos
    var ast = px.ast
    while (pf(px) && pos < px.pos) {
      pos = px.pos
      ast = px.ast
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ast = ast
    return true
  }
}

export const pMany1 = (pf: PFunc) => {
  return (px: PContext) => {
    if (!pf(px)) {
      return false;
    }
    var pos = px.pos
    var ast = px.ast
    while (pf(px) && pos < px.pos) {
      pos = px.pos
      ast = px.ast
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ast = ast
    return true
  }
}

export const pOption = (pf: PFunc) => {
  return (px: PContext) => {
    const pos = px.pos
    const ast = px.ast
    if (!pf(px)) {
      px.headpos = Math.max(px.pos, px.headpos)
      px.pos = pos
      px.ast = ast
    }
    return true
  }
}

export const pSeq = (...pfs: PFunc[]) => {
  return (px: PContext) => {
    for (const pf of pfs) {
      if (!pf(px)) {
        return false;
      }
    }
    return true;
  }
}

export const pOre = (...pfs: PFunc[]) => {
  return (px: PContext) => {
    const pos = px.pos
    const ast = px.ast
    for (const pf of pfs) {
      if (pf(px)) {
        return true;
      }
      px.headpos = Math.max(px.pos, px.headpos)
      px.pos = pos
      px.ast = ast
    }
    return false;
  }
}

export const pSeq2 = (pf: PFunc, pf2: PFunc) => {
  return (px: PContext) => {
    return pf(px) && pf2(px)
  }
}

export const pSeq3 = (pf: PFunc, pf2: PFunc, pf3: PFunc) => {
  return (px: PContext) => {
    return pf(px) && pf2(px) && pf3(px);
  }
}

export const pSeq4 = (pf: PFunc, pf2: PFunc, pf3: PFunc, pf4: PFunc) => {
  return (px: PContext) => {
    return pf(px) && pf2(px) && pf3(px) && pf4(px);
  }
}

export const pOre2 = (pf: PFunc, pf2: PFunc) => {
  return (px: PContext) => {
    const pos = px.pos
    const ast = px.ast
    if (pf(px)) {
      return true;
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ast = ast
    return pf2(px);
  }
}

export const pOre3 = (pf: PFunc, pf2: PFunc, pf3: PFunc) => {
  return (px: PContext) => {
    const pos = px.pos
    const ast = px.ast
    if (pf(px)) {
      return true;
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ast = ast
    if (pf2(px)) {
      return true;
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ast = ast
    return pf3(px);
  }
}

export const pOre4 = (pf: PFunc, pf2: PFunc, pf3: PFunc, pf4: PFunc) => {
  return (px: PContext) => {
    const pos = px.pos
    const ast = px.ast
    if (pf(px)) {
      return true;
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ast = ast
    if (pf2(px)) {
      return true;
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ast = ast
    if (pf3(px)) {
      return true;
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ast = ast
    return pf4(px);
  }
}

export const pDict = (...ss: string[]) => {
  return (px: PContext) => {
    const pos = px.pos
    for (const s of ss) {
      if (px.x.startsWith(s, pos)) {
        px.pos += s.length;
        return true;
      }
    }
    return false;
  }
}

export const pRef = (generated: any, uname: string) => {
  if (!(uname in generated)) {
    generated[uname] = (px: PContext) => generated[uname](px);
  }
  return generated[uname];
}

export const pNode = (pf: PFunc, tag: string, shift: number) => {
  return (px: PContext) => {
    const pos = px.pos
    const prev = px.ast
    px.ast = null;
    if (pf(px)) {
      px.ast = new PTree(prev, tag, pos + shift, px.pos, px.ast);
      return true;
    }
    return false;
  }
}

export const pEdge = (edge: string, pf: PFunc) => {
  if (edge === '') {
    return pf;
  }
  return (px: PContext) => {
    const pos = px.pos
    const prev = px.ast
    px.ast = null;
    if (pf(px)) {
      px.ast = new PTree(prev, edge, pos, -px.pos, px.ast);
      return true;
    }
    return false;
  }
}

export const pFold = (edge: string, pf: PFunc, tag: string, shift: number) => {
  return (px: PContext) => {
    const pos = px.pos
    var pt = px.ast;
    const prev = pt ? pt.prev : null;
    pt = pt ? (prev ? new PTree(null, pt.tag, pt.epos, pt.epos, pt.child) : pt) : null;
    px.ast = edge !== '' ? new PTree(null, edge, pos, -pos, pt) : pt;
    if (pf(px)) {
      px.ast = new PTree(prev, tag, pos, px.pos, px.ast);
      return true;
    }
    return false;
  }
}

export const pAbs = (pf: PFunc) => {
  return (px: PContext) => {
    const ast = px.ast
    if (pf(px)) {
      px.ast = ast;
      return true;
    }
    return false;
  }
}

// state parser

class PState {
  sid: number;
  val: any;
  prev: PState | null;
  constructor(sid: number, val: any, prev: PState | null) {
    this.sid = sid;
    this.val = val;
    this.prev = prev;
  }
}

const getstate = (state: PState | null, sid: number) => {
  while (state !== null) {
    if (state.sid === sid) {
      return state;
    }
    state = state.prev;
  }
  return state;
}

export const pSymbol = (pf: PFunc, sid: number) => {
  return (px: PContext) => {
    const pos = px.pos;
    if (pf(px)) {
      px.state = new PState(sid, px.x.substring(pos, px.pos), px.state);
      return true;
    }
    return false;
  }
}

export const pScope = (pf: PFunc) => {
  return (px: PContext) => {
    const state = px.state;
    if (pf(px)) {
      px.state = state;
      return true;
    }
    return false;
  }
}

export const pExists = (sid: number) => {
  return (px: PContext) => {
    return getstate(px.state, sid) !== null;
  }
}

export const pMatch = (sid: number) => {
  return (px: PContext) => {
    const state = getstate(px.state, sid);
    if (state !== null && px.x.startsWith(state.val, px.pos)) {
      px.pos += state.val.length;
      return true;
    }
    return false;
  }
}


// ParseTree

export class ParseTree {
  static readonly EMPTY: ParseTree[] = [];
  tag_: string;
  inputs_: string;
  spos_: number;
  epos_: number;
  urn_: string;
  subs_: ParseTree[];

  public constructor(tag: string, inputs: string, spos = 0, epos = -1, urn = '(unknown source)') {
    this.tag_ = tag
    this.inputs_ = inputs
    this.spos_ = spos
    this.epos_ = (epos === -1) ? (inputs.length - spos) : epos
    this.urn_ = urn
    this.subs_ = ParseTree.EMPTY;
  }

  public is(tag: string) {
    return this.tag_ === tag;
  }

  public gettag() {
    return this.tag_;
  }

  public add(t: ParseTree, edge: string = '') {
    if (edge === '') {
      if (this.subs_ === ParseTree.EMPTY) {
        this.subs_ = [];
      }
      this.subs_.push(t)
    }
    else {
      (this as any)[edge] = t;
    }
  }

  public get(key: string) {
    return (this as any)[key];
  }

  public subNodes() {
    return this.subs_;
  }

  public isSyntaxError() {
    return this.tag_ === 'err'
  }

  private pos_(pos: number) {
    const s = this.inputs_;
    pos = Math.min(pos, s.length);
    var row = 0;
    var col = 0;
    for (var i = 0; i <= pos; i += 1) {
      if (s.charCodeAt(i) == 10) {
        row += 1;
        col = 0;
      }
      else {
        col += 1;
      }
    }
    return [pos, row, col]
  }

  public beginPosition() {
    return this.pos_(this.spos_);
  }

  public endPosition() {
    return this.pos_(this.spos_);
  }

  public length() {
    return this.epos_ - this.spos_;
  }

  public keys() {
    return Object.keys(this).filter(x => !x.endsWith('_'));
  }

  public toString() {
    return this.inputs_.substring(this.spos_, this.epos_);
  }

  public dump() {
    const sb: string[] = [];
    this.strOut(sb);
    return sb.join('');
  }

  protected strOut(sb: string[]) {
    var c = 0;
    sb.push("[#")
    sb.push(this.tag_)
    for (const node of this.subNodes()) {
      c += 1;
      sb.push(` `);
      node.strOut(sb);
    }
    for (const key of this.keys()) {
      sb.push(` ${key} = `);
      (this as any)[key].strOut(sb);
    }
    if (c == 0) {
      sb.push(' ');
      sb.push(quote(this.inputs_.substring(this.spos_, this.epos_)))
    }
    sb.push("]")
  }

  public showing(msg = 'Syntax Error') {
    const p = this.beginPosition();
    const pos = p[0];
    const row = p[1];
    const col = p[2];
    return `(${this.urn_}:${row}+${col}) ${msg}`
  }
}

const PTree2ParseTree = (pt: PTree, urn: string, inputs: string) => {
  if (pt.prev !== null) {
    return PTree2ParseTreeImpl('', urn, inputs, pt.spos, pt.epos, pt)
  }
  else {
    return PTree2ParseTreeImpl(pt.tag, urn, inputs, pt.spos, pt.epos, pt.child)
  }
}

const PTree2ParseTreeImpl = (tag: string, urn: string, inputs: string, spos: number, epos: number, subnode: PTree | null) => {
  const t = new ParseTree(tag, inputs, spos, epos, urn);
  while (subnode !== null) {
    if (subnode.isEdge()) {
      if (subnode.child === null) {
        var tt = PTree2ParseTreeImpl('', urn, inputs, subnode.spos, Math.abs(subnode.epos), null)
      }
      else {
        tt = PTree2ParseTree(subnode.child, urn, inputs);
      }
      t.add(tt, subnode.tag);
    }
    else {
      t.add(PTree2ParseTreeImpl(subnode.tag, urn, inputs,
        subnode.spos, Math.abs(subnode.epos), subnode.child))
    }
    subnode = subnode.prev;
  }
  const tail = t.subs_.length - 1
  for (var i = 0; i < (tail + 1) / 2; i += 1) {
    const t0 = t.subs_[i];
    t.subs_[i] = t.subs_[tail - i]
    t.subs_[tail - i] = t0;
  }
  return t;
}

const translate = (s: string, dic: { [key: string]: string }) => {
  var foundESC = false;
  for (const c of Object.keys(dic)) {
    if (s.indexOf(c) !== -1) {
      foundESC = true;
      break;
    }
  }
  if (foundESC) {
    const sb = []
    for (const c of s) {
      if (c in dic) {
        sb.push(dic[c]);
      }
      else {
        sb.push(c);
      }
    }
    return sb.join('')
  }
  return s;
}

const ESCTBL = { '\n': '\\n', '\t': '\\t', '\r': '\\r', '\v': '\\v', '\f': '\\f', '\\': '\\\\', "'": "\\'" }

export const quote = (s: string) => {
  return "'" + translate(s, ESCTBL) + "'"
}


export const generate = (generated: { [key: string]: PFunc }, start: string) => {
  const pf = generated[start];
  return (inputs: string, options: any = {}) => {
    const pos: number = options.pos || options.spos || 0;
    const epos: number = options.epos || (inputs.length - pos);
    const px = new PContext(inputs, pos, epos);
    if (pf(px)) {
      if (!px.ast) {
        px.ast = new PTree(null, "", pos, px.pos, null);
      }
    }
    else {
      px.ast = new PTree(null, "err", px.headpos, px.headpos, null);
    }
    const conv: ((t: PTree, urn: string, inputs: string) => any) = options.conv || PTree2ParseTree;
    const urn = options.urn || '(unknown source)';
    return conv(px.ast!, urn, inputs);
  }
}

const example = (generated: { [key: string]: PFunc }, start: string, input: string) => {
  const p = generate(generated, start);
  const t = p(input)
  console.log(t.dump())
}

export const pRule = (peg: { [key: string]: PFunc }, name: string, e: PFunc) => {
  peg[name] = e;
}

const TPEG = (peg: any) => {
  pRule(peg, 'Start', pSeq3(pRef(peg, '__'), pRef(peg, 'Source'), pRef(peg, 'EOF')));
  pRule(peg, '__', pMany(pOre2(pRange(' \t\r\n'), pRef(peg, 'COMMENT'))))
  pRule(peg, '_', pMany(pOre2(pRange(' \t'), pRef(peg, 'COMMENT'))))
  pRule(peg, 'COMMENT', pOre2(pSeq3(pChar('/*'), pMany(pSeq2(pNot(pChar('*/')), pAny())), pChar('*/')), pSeq2(pChar('//'), pMany(pSeq2(pNot(pRef(peg, 'EOL')), pAny())))))
  pRule(peg, 'EOL', pOre(pChar('\n'), pChar('\r\n'), pRef(peg, 'EOF')))
  pRule(peg, 'EOF', pNot(pAny()))
  pRule(peg, 'S', pRange(' \t'))
  pRule(peg, 'Source', pNode(pMany(pEdge('', pRef(peg, 'Statement'))), 'Source', 0))
  pRule(peg, 'EOS', pOre2(pSeq2(pRef(peg, '_'), pMany1(pSeq2(pChar(';'), pRef(peg, '_')))), pMany1(pSeq2(pRef(peg, '_'), pRef(peg, 'EOL')))))
  pRule(peg, 'Statement', pOre(pRef(peg, 'Import'), pRef(peg, 'Example'), pRef(peg, 'Rule')))
  pRule(peg, 'Import', pSeq2(pNode(pSeq(pChar('from'), pRef(peg, 'S'), pRef(peg, '_'), pEdge('name', pOre2(pRef(peg, 'Identifier'), pRef(peg, 'Char'))), pOption(pSeq(pRef(peg, '_'), pChar('import'), pRef(peg, 'S'), pRef(peg, '_'), pEdge('names', pRef(peg, 'Names'))))), 'Import', 0), pRef(peg, 'EOS')))
  pRule(peg, 'Example', pSeq2(pNode(pSeq(pChar('example'), pRef(peg, 'S'), pRef(peg, '_'), pEdge('names', pRef(peg, 'Names')), pEdge('doc', pRef(peg, 'Doc'))), 'Example', 0), pRef(peg, 'EOS')))
  pRule(peg, 'Names', pNode(pSeq3(pEdge('', pRef(peg, 'Identifier')), pRef(peg, '_'), pMany(pSeq(pChar(','), pRef(peg, '_'), pEdge('', pRef(peg, 'Identifier')), pRef(peg, '_')))), '', 0))
  pRule(peg, 'Doc', pOre(pRef(peg, 'Doc1'), pRef(peg, 'Doc2'), pRef(peg, 'Doc0')))
  pRule(peg, 'Doc0', pNode(pMany(pSeq2(pNot(pRef(peg, 'EOL')), pAny())), 'Doc', 0))
  pRule(peg, 'Doc1', pSeq(pRef(peg, 'DELIM1'), pMany(pRef(peg, 'S')), pRef(peg, 'EOL'), pNode(pMany(pSeq2(pNot(pSeq2(pRef(peg, 'DELIM1'), pRef(peg, 'EOL'))), pAny())), 'Doc', 0), pRef(peg, 'DELIM1')))
  pRule(peg, 'DELIM1', pChar("'''"))
  pRule(peg, 'Doc2', pSeq(pRef(peg, 'DELIM2'), pMany(pRef(peg, 'S')), pRef(peg, 'EOL'), pNode(pMany(pSeq2(pNot(pSeq2(pRef(peg, 'DELIM2'), pRef(peg, 'EOL'))), pAny())), 'Doc', 0), pRef(peg, 'DELIM2')))
  pRule(peg, 'DELIM2', pChar('```'))
  pRule(peg, 'Rule', pSeq2(pNode(pSeq(pEdge('name', pOre2(pRef(peg, 'Identifier'), pRef(peg, 'QName'))), pRef(peg, '__'), pOre2(pChar('='), pChar('<-')), pRef(peg, '__'), pOption(pSeq2(pRange('/|'), pRef(peg, '__'))), pEdge('e', pRef(peg, 'Expression'))), 'Rule', 0), pRef(peg, 'EOS')))
  pRule(peg, 'Identifier', pNode(pRef(peg, 'NAME'), 'Name', 0))
  pRule(peg, 'NAME', pSeq2(pRange('_', 'AZaz'), pMany(pRange('_.', 'AZaz09'))))
  pRule(peg, 'Expression', pSeq2(pRef(peg, 'Choice'), pOption(pFold('', pMany1(pSeq(pRef(peg, '__'), pChar('|'), pNot(pChar('|')), pRef(peg, '_'), pEdge('', pRef(peg, 'Choice')))), 'Alt', 0))))
  pRule(peg, 'Choice', pSeq2(pRef(peg, 'Sequence'), pOption(pFold('', pMany1(pSeq(pRef(peg, '__'), pOre2(pChar('/'), pChar('||')), pRef(peg, '_'), pEdge('', pRef(peg, 'Sequence')))), 'Ore', 0))))
  pRule(peg, 'Sequence', pSeq2(pRef(peg, 'Predicate'), pOption(pFold('', pMany1(pSeq2(pRef(peg, 'SS'), pEdge('', pRef(peg, 'Predicate')))), 'Seq', 0))))
  pRule(peg, 'SS', pOre2(pSeq3(pRef(peg, 'S'), pRef(peg, '_'), pNot(pRef(peg, 'EOL'))), pSeq3(pMany1(pSeq2(pRef(peg, '_'), pRef(peg, 'EOL'))), pRef(peg, 'S'), pRef(peg, '_'))))
  pRule(peg, 'Predicate', pOre(pRef(peg, 'Not'), pRef(peg, 'And'), pRef(peg, 'Suffix')))
  pRule(peg, 'Not', pSeq2(pChar('!'), pNode(pEdge('e', pRef(peg, 'Predicate')), 'Not', 0)))
  pRule(peg, 'And', pSeq2(pChar('&'), pNode(pEdge('e', pRef(peg, 'Predicate')), 'And', 0)))
  pRule(peg, 'Suffix', pSeq2(pRef(peg, 'Term'), pOption(pOre(pFold('e', pChar('*'), 'Many', 0), pFold('e', pChar('+'), 'Many1', 0), pFold('e', pChar('?'), 'Option', 0)))))
  pRule(peg, 'Term', pOre(pRef(peg, 'Group'), pRef(peg, 'Char'), pRef(peg, 'Class'), pRef(peg, 'Any'), pRef(peg, 'Node'), pRef(peg, 'Fold'), pRef(peg, 'EdgeFold'), pRef(peg, 'Edge'), pRef(peg, 'Func'), pRef(peg, 'Ref')))
  pRule(peg, 'Empty', pNode(pEmpty(), 'Empty', 0))
  pRule(peg, 'Group', pSeq(pChar('('), pRef(peg, '__'), pOre2(pRef(peg, 'Expression'), pRef(peg, 'Empty')), pRef(peg, '__'), pChar(')')))
  pRule(peg, 'Any', pNode(pChar('.'), 'Any', 0))
  pRule(peg, 'Char', pSeq3(pChar("'"), pNode(pMany(pOre2(pSeq2(pChar('\\'), pAny()), pSeq2(pNot(pChar("'")), pAny()))), 'Char', 0), pChar("'")))
  pRule(peg, 'Class', pSeq3(pChar('['), pNode(pMany(pOre2(pSeq2(pChar('\\'), pAny()), pSeq2(pNot(pChar(']')), pAny()))), 'Class', 0), pChar(']')))
  pRule(peg, 'Node', pNode(pSeq(pChar('{'), pRef(peg, '__'), pOption(pSeq2(pEdge('tag', pRef(peg, 'Tag')), pRef(peg, '__'))), pEdge('e', pOre2(pSeq2(pRef(peg, 'Expression'), pRef(peg, '__')), pRef(peg, 'Empty'))), pOption(pSeq2(pEdge('tag', pRef(peg, 'Tag')), pRef(peg, '__'))), pRef(peg, '__'), pChar('}')), 'Node', 0))
  pRule(peg, 'Tag', pSeq2(pChar('#'), pNode(pMany1(pSeq2(pNot(pRange(' \t\r\n}')), pAny())), 'Tag', 0)))
  pRule(peg, 'Fold', pNode(pSeq(pChar('^'), pRef(peg, '_'), pChar('{'), pRef(peg, '__'), pOption(pSeq2(pEdge('tag', pRef(peg, 'Tag')), pRef(peg, '__'))), pEdge('e', pOre2(pSeq2(pRef(peg, 'Expression'), pRef(peg, '__')), pRef(peg, 'Empty'))), pOption(pSeq2(pEdge('tag', pRef(peg, 'Tag')), pRef(peg, '__'))), pRef(peg, '__'), pChar('}')), 'Fold', 0))
  pRule(peg, 'Edge', pNode(pSeq(pEdge('edge', pRef(peg, 'Identifier')), pChar(':'), pRef(peg, '_'), pNot(pChar('^')), pEdge('e', pRef(peg, 'Term'))), 'Edge', 0))
  pRule(peg, 'EdgeFold', pNode(pSeq(pEdge('edge', pRef(peg, 'Identifier')), pChar(':'), pRef(peg, '_'), pChar('^'), pRef(peg, '_'), pChar('{'), pRef(peg, '__'), pOption(pSeq2(pEdge('tag', pRef(peg, 'Tag')), pRef(peg, '__'))), pEdge('e', pOre2(pSeq2(pRef(peg, 'Expression'), pRef(peg, '__')), pRef(peg, 'Empty'))), pOption(pSeq2(pEdge('tag', pRef(peg, 'Tag')), pRef(peg, '__'))), pRef(peg, '__'), pChar('}')), 'Fold', 0))
  pRule(peg, 'Func', pNode(pSeq(pChar('@'), pEdge('', pRef(peg, 'Identifier')), pChar('('), pRef(peg, '__'), pOre2(pEdge('', pRef(peg, 'Expression')), pEdge('', pRef(peg, 'Empty'))), pMany(pSeq(pRef(peg, '_'), pChar(','), pRef(peg, '__'), pEdge('', pRef(peg, 'Expression')))), pRef(peg, '__'), pChar(')')), 'Func', 0))
  pRule(peg, 'Ref', pOre2(pRef(peg, 'Identifier'), pRef(peg, 'QName')))
  pRule(peg, 'QName', pNode(pSeq3(pChar('"'), pMany(pOre2(pSeq2(pChar('\\'), pAny()), pSeq2(pNot(pChar('"')), pAny()))), pChar('"')), 'Name', 0))
  return peg
}

const G = TPEG({})
console.log(G)
example(G, 'Expression', 'A A A')
