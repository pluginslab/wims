/**
 * Turns a rendered Ink frame into a standalone SVG terminal screenshot.
 *
 * Ink's headless output is a full frame containing only SGR colour codes,
 * no cursor movement, so this only has to track styling, not emulate a terminal.
 *
 * Every run is placed at an explicit x and given a textLength, so the columns
 * stay aligned even where the viewer's monospace font has different metrics
 * from ours.
 */

const PALETTE = {
  0: '#3b4252', // black
  1: '#ff7b72', // red
  2: '#7ee787', // green
  3: '#e3b341', // yellow
  4: '#79c0ff', // blue
  5: '#d2a8ff', // magenta
  6: '#56d4dd', // cyan
  7: '#c9d1d9', // white
  8: '#6e7681', // bright black
  9: '#ffa198',
  10: '#a5f3ae',
  11: '#f2cc60',
  12: '#a5d6ff',
  13: '#e2c5ff',
  14: '#7ce8f0',
  15: '#f0f6fc',
};

const DEFAULT_FG = '#c9d1d9';
const TERMINAL_BG = '#0d1117';
const CHROME_BG = '#161b22';
const BORDER = '#30363d';

const CHAR_W = 8.4;
const LINE_H = 20;
const FONT_SIZE = 14;
const PAD_X = 16;
const PAD_Y = 14;
const TITLEBAR = 34;

const FONT =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace";

const xml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function blankStyle() {
  return { fg: null, bg: null, bold: false, dim: false, inverse: false };
}

/** Apply one SGR sequence's parameters to the running style. */
function applySgr(style, params) {
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    if (p === 0) Object.assign(style, blankStyle());
    else if (p === 1) style.bold = true;
    else if (p === 2) style.dim = true;
    else if (p === 7) style.inverse = true;
    else if (p === 22) {
      style.bold = false;
      style.dim = false;
    } else if (p === 27) style.inverse = false;
    else if (p >= 30 && p <= 37) style.fg = PALETTE[p - 30];
    else if (p === 39) style.fg = null;
    else if (p >= 40 && p <= 47) style.bg = PALETTE[p - 40];
    else if (p === 49) style.bg = null;
    else if (p >= 90 && p <= 97) style.fg = PALETTE[p - 90 + 8];
    else if (p >= 100 && p <= 107) style.bg = PALETTE[p - 100 + 8];
    else if (p === 38 || p === 48) {
      // Extended colour: 5;n (256) or 2;r;g;b (truecolor).
      const target = p === 38 ? 'fg' : 'bg';
      if (params[i + 1] === 5) {
        style[target] = ansi256(params[i + 2]);
        i += 2;
      } else if (params[i + 1] === 2) {
        style[target] = rgb(params[i + 2], params[i + 3], params[i + 4]);
        i += 4;
      }
    }
  }
}

const rgb = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');

function ansi256(n) {
  if (n < 16) return PALETTE[n];
  if (n < 232) {
    const i = n - 16;
    const step = [0, 95, 135, 175, 215, 255];
    return rgb(step[Math.floor(i / 36) % 6], step[Math.floor(i / 6) % 6], step[i % 6]);
  }
  const v = 8 + (n - 232) * 10;
  return rgb(v, v, v);
}

/** Split one line into styled runs of equal styling. */
function parseLine(line) {
  const runs = [];
  const style = blankStyle();
  let col = 0;
  let buf = '';
  let bufStyle = { ...style };

  const flush = () => {
    if (buf) {
      runs.push({ text: buf, col: col - [...buf].length, style: bufStyle });
      buf = '';
    }
  };

  const re = /\x1b\[([0-9;]*)m/g;
  let last = 0;
  let m;
  const pushText = (text) => {
    for (const ch of text) {
      if (buf && !sameStyle(bufStyle, style)) flush();
      if (!buf) bufStyle = { ...style };
      buf += ch;
      col++;
    }
  };

  while ((m = re.exec(line))) {
    pushText(line.slice(last, m.index));
    flush();
    const params = m[1] === '' ? [0] : m[1].split(';').map((n) => Number(n) || 0);
    applySgr(style, params);
    bufStyle = { ...style };
    last = re.lastIndex;
  }
  pushText(line.slice(last));
  flush();
  return runs;
}

const sameStyle = (a, b) =>
  a.fg === b.fg && a.bg === b.bg && a.bold === b.bold && a.dim === b.dim && a.inverse === b.inverse;

/**
 * @param {string} frame  Ink frame containing SGR codes
 * @param {{title?:string, cols?:number}} opts
 */
export function ansiToSvg(frame, opts = {}) {
  const lines = frame.replace(/\n$/, '').split('\n');
  const cols = opts.cols ?? Math.max(...lines.map((l) => stripLen(l)));
  const rows = lines.length;

  const w = Math.round(cols * CHAR_W + PAD_X * 2);
  const h = Math.round(rows * LINE_H + PAD_Y * 2 + TITLEBAR);

  const bgRects = [];
  const texts = [];

  lines.forEach((line, r) => {
    const y = TITLEBAR + PAD_Y + r * LINE_H;
    for (const run of parseLine(line)) {
      let { fg, bg } = run.style;
      if (run.style.inverse) {
        const f = fg ?? DEFAULT_FG;
        const b = bg ?? TERMINAL_BG;
        fg = b;
        bg = f;
      }
      // Background covers the whole run, padding spaces included.
      const rawLen = [...run.text].length;
      if (bg) {
        bgRects.push(
          `<rect x="${(PAD_X + run.col * CHAR_W).toFixed(2)}" y="${(y - LINE_H + 5).toFixed(2)}" width="${(rawLen * CHAR_W).toFixed(2)}" height="${LINE_H}" fill="${bg}"/>`,
        );
      }

      // Text must exclude the padding: SVG does not reliably advance across
      // leading/trailing whitespace, so a textLength that counted those spaces
      // gets spent stretching the visible glyphs instead ("m a i n").
      const text = run.text.replace(/\s+$/, '');
      const lead = text.length - text.trimStart().length;
      const glyphs = text.slice(lead);
      if (!glyphs) continue;

      const x = PAD_X + (run.col + lead) * CHAR_W;
      const len = [...glyphs].length;

      const attrs = [
        `x="${x.toFixed(2)}"`,
        `y="${y.toFixed(2)}"`,
        `textLength="${(len * CHAR_W).toFixed(2)}"`,
        'lengthAdjust="spacing"',
        `fill="${fg ?? DEFAULT_FG}"`,
      ];
      if (run.style.bold) attrs.push('font-weight="600"');
      if (run.style.dim) attrs.push('opacity="0.55"');
      texts.push(`<text ${attrs.join(" ")}>${xml(glyphs)}</text>`);
    }
  });

  const title = opts.title ? xml(opts.title) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}" font-size="${FONT_SIZE}">
  <rect width="${w}" height="${h}" rx="10" fill="${CHROME_BG}"/>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="9.5" fill="none" stroke="${BORDER}"/>
  <rect x="1" y="${TITLEBAR}" width="${w - 2}" height="${h - TITLEBAR - 1}" fill="${TERMINAL_BG}"/>
  <circle cx="20" cy="17" r="6" fill="#ff5f57"/>
  <circle cx="40" cy="17" r="6" fill="#febc2e"/>
  <circle cx="60" cy="17" r="6" fill="#28c840"/>
  <text x="${w / 2}" y="22" text-anchor="middle" fill="#8b949e" font-size="12">${title}</text>
  <g>
${bgRects.map((r) => '    ' + r).join('\n')}
  </g>
  <g xml:space="preserve">
${texts.map((t) => '    ' + t).join('\n')}
  </g>
</svg>
`;
}

const stripLen = (l) => [...l.replace(/\x1b\[[0-9;]*m/g, '')].length;
