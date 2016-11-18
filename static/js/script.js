const KAPPA = 0.5522847498307936; // (-1 + Math.sqrt(2)) / 3 * 4

const MOVETO = 'M';
const LINETO = 'L';
const QUADTO = 'Q';
const CURVETO = 'C';
const CLOSE = 'Z';

const MOVETO_RELATIVE = 'm';
const LINETO_RELATIVE = 'l';
const QUADTO_RELATIVE = 'q';
const CURVETO_RELATIVE = 'c';
const HORIZONTAL_RELATIVE = 'h';
const VERITCAL_RELATIVE = 'v';
const CLOSE_RELATIVE = 'z';

function joinNumbers(digits, ...numbers) {
  let s = '';
  for (let i = 0, n = numbers.length; i < n; i++) {
    let v = numbers[i];
    if (i > 0 && v >= 0) {
      s += ',';
    }
    s += v.toFixed(digits);
  }
  return s;
}

function parseUnitNumber(s) {
  if (!s) return undefined;
  let m = s.match(/^(-?[\d\.]+)(px)?$/);
  if (!m) {
    throw new Error('Could not parse number: ' + s);
  }
  let v = parseFloat(m[1]);
  if (m[2] === 'px') {
    return v;
  } else if (m[2] === undefined) {
    return v;
  } else {
   throw new Error('Unsupported unit: ' + m[2]);
  }
}

function smallestString(...strings) {
  let l;
  let smallest;
  for (let i = 0, n = strings.length; i < n; i++) {
    let s = strings[0];
    if (i === 0) {
      l = s.length;
      smallest = s;
    } else if (s.length < l) {
      smallest = s;
    }
  }
  return smallest;
}

function splitFileExtension(name) {
  let extPos = name.lastIndexOf('.');
  if (extPos === -1) return [name, ''];
  let baseName = name.substring(0, extPos);
  let ext = name.substring(extPos);
  return [baseName, ext];
}

function baseName(name) {
  let slashPos = name.lastIndexOf('/');
  if (slashPos === -1) return name;
  return name.substring(slashPos + 1);
}

class Transform {
  constructor(m) {
    this.m = Array.isArray(m) ? m : [1, 0, 0, 1, 0, 0];
  }

  translate(tx, ty) {
    this.m[4] += this.m[0] * tx + this.m[2] * ty;
    this.m[5] += this.m[1] * tx + this.m[3] * ty;
  }

  scale(sx, sy) {
    sx = sx !== undefined ? sx : 1.0;
    sy = sy !== undefined ? sy : sx;
    this.m[0] *= sx;
    this.m[1] *= sx;
    this.m[2] *= sy;
    this.m[3] *= sy;
  }

  transformPath(path) {
    let m = this.m;
    let newCommands = [];
    newCommands.length = path.commands.length;
    for (let i = 0, l = path.commands.length; i < l; i++) {
      let cmd = path.commands[i];
      switch(cmd.type) {
        case MOVETO:
        case LINETO:
          newCommands[i] = {
            type: cmd.type,
            x: cmd.x * m[0] + cmd.y * m[2] + m[4],
            y: cmd.x * m[1] + cmd.y * m[3] + m[5]
          };
          break;
        case QUADTO:
          newCommands[i] = {
            type: QUADTO,
            x: cmd.x * m[0] + cmd.y * m[2] + m[4],
            y: cmd.x * m[1] + cmd.y * m[3] + m[5],
            x1: cmd.x1 * m[0] + cmd.y1 * m[2] + m[4],
            y1: cmd.x1 * m[1] + cmd.y1 * m[3] + m[5]
          };
          break;
        case CURVETO:
          newCommands[i] = {
            type: CURVETO,
            x: cmd.x * m[0] + cmd.y * m[2] + m[4],
            y: cmd.x * m[1] + cmd.y * m[3] + m[5],
            x1: cmd.x1 * m[0] + cmd.y1 * m[2] + m[4],
            y1: cmd.x1 * m[1] + cmd.y1 * m[3] + m[5],
            x2: cmd.x2 * m[0] + cmd.y2 * m[2] + m[4],
            y2: cmd.x2 * m[1] + cmd.y2 * m[3] + m[5]
          };
          break;
        case CLOSE:
          newCommands[i] = { type: CLOSE };
          break;
        default:
          throw new Error('Unknown command type ' + cmd);
      }
    }
    return new Path(newCommands);
  }
}

class Path {
  constructor(commands) {
    this.commands = commands !== undefined ? commands : [];
  }

  moveTo(x, y) {
    this.commands.push({type: MOVETO, x: x, y: y});
  }

  lineTo(x, y) {
    this.commands.push({type: LINETO, x: x, y: y});
  }

  curveTo(x1, y1, x2, y2, x, y) {
    this.commands.push({type: CURVETO, x1: x1, y1: y1, x2: x2, y2: y2, x: x, y: y});
  }

  closePath() {
    this.commands.push({type: CLOSE});
  }

  close() {
    this.commands.push({type: CLOSE});
  }

  addEllipse(cx, cy, rx, ry) {
    let dx = rx * KAPPA;
    let dy = ry * KAPPA;
    this.moveTo(cx - rx, cx);
    this.curveTo(cx - rx, cx - dy, cx - dx, cy - ry, cx, cy - ry);
    this.curveTo(cx + dx, cy - ry, cx + rx, cx - dy, cx + rx, cx);
    this.curveTo(cx + rx, cx + dy, cx + dx, cy + ry, cx, cy + ry);
    this.curveTo(cx - dx, cy + ry, cx - rx, cx + dy, cx - rx, cx);
    this.close();
  }

  extend(path) {
    let commands = path.commands || path;
    Array.prototype.push.apply(this.commands, commands);
  }

  flatten() {
    return this;
  }

  transform(m) {
    if (m instanceof Transform) {
      return m.transformPath(this);
    } else {
      let t = new Transform(m);
      return t.transformPath(this);
    }
  }

  translate(tx, ty) {
    let t = new Transform();
    t.translate(tx, ty);
    return t.transformPath(this);
  }

  scale(sx, sy) {
    let t = new Transform();
    t.scale(sx, sy);
    return t.transformPath(this);
  }

  // Round off all floating-point numbers.
  // This is used to get cleaner output data when converting back to SVG.
  roundOff() {
    for (let i = 0, n = this.commands.length; i < n; i++) {
      let cmd = this.commands[i];
      switch(cmd.type) {
        case CURVETO:
          cmd.x2 = Math.round(cmd.x2);
          cmd.y2 = Math.round(cmd.y2);
          // Fall through...
        case QUADTO:
          cmd.x1 = Math.round(cmd.x1);
          cmd.y1 = Math.round(cmd.y1);
          // Fall through...
        case MOVETO:
        case LINETO:
          cmd.x = Math.round(cmd.x);
          cmd.y = Math.round(cmd.y);
      }
    }
  }

  toPathData(digits) {
    let d = '';
    let x, y;
    for (let i = 0, n = this.commands.length; i < n; i++) {
      let cmd = this.commands[i];
      if (cmd.type === MOVETO) {
        d += 'M';
        d += joinNumbers(digits, cmd.x, cmd.y);
        x = cmd.x;
        y = cmd.y;
      } else if (cmd.type === LINETO) {
        if (x === cmd.x) {
          let dAbs = 'V' + joinNumbers(digits, cmd.y);
          let dRel = 'v' + joinNumbers(digits, cmd.y - y);
          d += smallestString(dAbs, dRel);
        } else if (y === cmd.y) {
          let dAbs = 'H' + joinNumbers(digits, cmd.x);
          let dRel = 'h' + joinNumbers(digits, cmd.x - x);
          d += smallestString(dAbs, dRel);
        } else {
          let dAbs = 'L' + joinNumbers(digits, cmd.x, cmd.y);
          let dRel = 'l' + joinNumbers(digits, cmd.x - x, cmd.y - y);
          d += smallestString(dAbs, dRel);
        }
        x = cmd.x;
        y = cmd.y;
      } else if (cmd.type === QUADTO) {
        d += 'Q';
        d += joinNumbers(digits, cmd.x1, cmd.y1, cmd.x, cmd.y);
        x = cmd.x;
        y = cmd.y;
      } else if (cmd.type === CURVETO) {
        d += 'C';
        d += joinNumbers(digits, cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
        x = cmd.x;
        y = cmd.y;
      } else if (cmd.type === CLOSE) {
        d += 'z';
      }
    }
    return d;
  }

  // Draw the path to a 2D context.
  draw(ctx) {
    ctx.beginPath();
    let nCommands = this.commands.length;
    for (let i = 0; i < nCommands; i++) {
      let cmd = this.commands[i];
      if (cmd.type === MOVETO) {
        ctx.moveTo(cmd.x, cmd.y);
      } else if (cmd.type === LINETO) {
        ctx.lineTo(cmd.x, cmd.y);
      } else if (cmd.type === QUADTO) {
        ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
      } else if (cmd.type === CURVETO) {
        ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
      } else if (cmd.type === CLOSE) {
        ctx.closePath();
      }
    }
    ctx.fill();
  }
}

class Group {
  constructor(children) {
    this.children = children !== undefined ? children : [];
  }

  draw(ctx) {
    let n = this.children.length;
    for (let i = 0, n = this.children.length; i < n; i++) {
      this.children[i].draw(ctx);
    }
  }

  // Combines all underlying elements into a single path.
  flatten() {
    let path = new Path();
    this.children.forEach(child => {
      path.extend(child.flatten());
    });
    return path;
  }
}

function parseTransform(el, path) {
  // TODO: Currently only supports matrix(a, b, c, d, e, f)
  let transform = el.getAttribute('transform');
  if (!transform) return path;
  let m = transform.match(/matrix\((-?[\d\.]+)\s+(-?[\d\.]+)\s+(-?[\d\.]+)\s+(-?[\d\.]+)\s+(-?[\d\.]+)\s+(-?[\d\.]+)\)/);
  if (!m) return path;
  m = m.slice(1);
  m = m.map(v => parseFloat(v));
  return path.transform(m);
}

function tokenIsCommand(c) {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
}

function tokenizePathData(d) {
  let tokens = [];
  for (let i = 0; i < d.length; i++) {
    let c = d[i];
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) {
      tokens.push(c);
    } else if ((c >= '0' && c <= '9') || c === '.' || c === '-') {
      let start = i;
      do {
        i++;
        c = d[i];
      } while ((c >= '0' && c <= '9') || (c === '.'))
      tokens.push(parseFloat(d.substring(start, i)));
      if (i !== start) {
        i--;
      }
    } else if (c === ',' || c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      // Do nothing on whitespace.
    } else {
      throw new Error('Unknown token ' + c);
    }
  }
  return tokens;
}

function parsePath(el) {
  let path = new Path();
  let d = el.getAttribute('d');
  let tokens = tokenizePathData(d);
  let currentCommand = null;
  let subPath = false;
  let x, y, x1, y1, x2, y2;
  let i = 0;
  for (;;) {
    if (i >= tokens.length) break;
    let token = tokens[i++];
    console.assert(tokenIsCommand(token));
    if (token === 'M') {
      x = tokens[i++];
      y = tokens[i++];
      path.moveTo(x, y);
      subPath = true;
    } else if (token === 'L') {
      console.assert(subPath); // TODO: not quite correct -- can start subpath
      x = tokens[i++];
      y = tokens[i++];
      path.lineTo(x, y);
    } else if (token === 'H') {
      console.assert(subPath); // TODO: not quite correct -- can start subpath
      console.assert(x !== undefined && y !== undefined);
      x = tokens[i++];
      path.lineTo(x, y);
    } else if (token === 'V') {
      console.assert(subPath); // TODO: not quite correct -- can start subpath
      console.assert(x !== undefined && y !== undefined);
      y = tokens[i++];
      path.lineTo(x, y);
    } else if (token === 'l') {
      console.assert(subPath); // TODO: not quite correct -- can start subpath
      console.assert(x !== undefined && y !== undefined);
      x += tokens[i++];
      y += tokens[i++];
      path.lineTo(x, y);
    } else if (token === 'h') {
      console.assert(subPath); // TODO: not quite correct -- can start subpath
      console.assert(x !== undefined && y !== undefined);
      x += tokens[i++];
      path.lineTo(x, y);
    } else if (token === 'v') {
      console.assert(subPath); // TODO: not quite correct -- can start subpath
      console.assert(x !== undefined && y !== undefined);
      y += tokens[i++];
      path.lineTo(x, y);
    } else if (token === 'C') {
      console.assert(subPath); // TODO: not quite correct -- can start subpath
      x1 = tokens[i++];
      y1 = tokens[i++];
      x2 = tokens[i++];
      y2 = tokens[i++];
      x = tokens[i++];
      y = tokens[i++];
      path.curveTo(x1, y1, x2, y2, x, y);
    } else if (token === 'c') {
      console.assert(subPath); // TODO: not quite correct -- can start subpath
      console.assert(x !== undefined && y !== undefined);
      x1 = x + tokens[i++];
      y1 = y + tokens[i++];
      x2 = x + tokens[i++];
      y2 = y + tokens[i++];
      x += tokens[i++];
      y += tokens[i++];
      path.curveTo(x1, y1, x2, y2, x, y);
    } else if (token === 'S') {
      console.assert(subPath); // TODO: not quite correct -- can start subpath
      x1 = x + (x - x2);
      y1 = y + (y - y2);
      x2 = tokens[i++];
      y2 = tokens[i++];
      x = tokens[i++];
      y = tokens[i++];
      path.curveTo(x1, y1, x2, y2, x, y);
    } else if (token === 's') {
      console.assert(subPath); // TODO: not quite correct -- can start subpath
      console.assert(x !== undefined && y !== undefined);
      x1 = x + (x - x2);
      y1 = y + (y - y2);
      x2 = x + tokens[i++];
      y2 = y + tokens[i++];
      x += tokens[i++];
      y += tokens[i++];
      path.curveTo(x1, y1, x2, y2, x, y);
    } else if (token === 'z' || token === 'Z') {
      console.assert(subPath); // TODO: not quite correct -- can start subpath
      path.closePath();
    } else {
      throw new Error('Unknown SVG command ' + token);
    }
  }
  path = parseTransform(el, path);
  return path;
}

function tokenizePointData(d) {
  let tokens = [];
  for (let i = 0; i < d.length; i++) {
    let c = d[i];
    if ((c >= '0' && c <= '9') || c === '.' || c === '-') {
      let start = i;
      do {
        i++;
        c = d[i];
      } while ((c >= '0' && c <= '9') || (c === '.'))
      tokens.push(parseFloat(d.substring(start, i)));
      if (i !== start) {
        i--;
      }
    } else if (c === ',' || c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      // Do nothing on whitespace.
    } else {
      throw new Error('Unknown token ' + c);
    }
  }
  return tokens;
}

function parsePolygon(el) {
  let points = el.getAttribute('points');
  let tokens = tokenizePointData(points);
  let path = new Path();
  for (let i = 0; i < tokens.length; i += 2) {
    let x = tokens[i];
    let y = tokens[i + 1];
    if (i === 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }
  path = parseTransform(el, path);
  return path;
}

function parseRect(el) {
  let x = parseFloat(el.getAttribute('x') || 0);
  let y = parseFloat(el.getAttribute('y') || 0);
  let width = parseFloat(el.getAttribute('width'));
  let height  = parseFloat(el.getAttribute('height'));
  let path = new Path();
  path.moveTo(x, y);
  path.lineTo(x + width, y);
  path.lineTo(x + width, y + height);
  path.lineTo(x, y + height);
  path.closePath();
  path = parseTransform(el, path);
  return path;
}

function parseEllipse(el) {
  let cx = parseFloat(el.getAttribute('cx') || 0);
  let cy = parseFloat(el.getAttribute('cy') || 0);
  let rx = parseFloat(el.getAttribute('rx'));
  let ry = parseFloat(el.getAttribute('ry'));
  let path = new Path();
  path.addEllipse(cx, cy, rx, ry);
  return path;
}

function parseCircle(el) {
  let cx = parseFloat(el.getAttribute('cx') || 0);
  let cy = parseFloat(el.getAttribute('cy') || 0);
  let r = parseFloat(el.getAttribute('r'));
  let path = new Path();
  path.addEllipse(cx, cy, r, r);
  return path;
}

// Parse the child elements and add them to the path.
function parseElement(el) {
  if (el.nodeName === 'g') {
    let paths = Array.from(el.children).map(child => parseElement(child));
    return new Group(paths);
  } else if (el.nodeName === 'path') {
    return parsePath(el);
  } else if (el.nodeName === 'polygon') {
    return parsePolygon(el);
  } else if (el.nodeName === 'rect') {
    return parseRect(el);
  } else if (el.nodeName === 'ellipse') {
    return parseEllipse(el);
  } else if (el.nodeName === 'circle') {
    return parseCircle(el);
  } else {
    throw new Error('Unsupported SVG node ' + el.nodeName);
  }
}

function parseSvg(svg) {
  let viewBox = svg.getAttribute('viewBox');
  let width = parseUnitNumber(svg.getAttribute('width'));
  let height = parseUnitNumber(svg.getAttribute('height'));
  let viewWidth, viewHeight;
  let viewX = 0;
  let viewY = 0;
  if (viewBox) {
    let m = viewBox.match(/(-?[\d\.]+)\s+(-?[\d\.]+)\s+(-?[\d\.]+)\s+(-?[\d\.]+)/);
    if (m) {
      viewX = parseFloat(m[1]);
      viewY = parseFloat(m[2]);
      viewWidth = parseFloat(m[3]);
      viewHeight = parseFloat(m[4]);
    }
  }
  let paths = Array.from(svg.children).map(child => parseElement(child));
  let g = new Group(paths);
  let scale = 1;
  if (width === undefined) {
    width = viewWidth;
  }
  if (viewWidth !== undefined) {
    scale = width / viewWidth;
  }
  return {width: width, height: height, scale: scale, tx: viewX, ty: viewY, root: g};
}

//let canvas = document.getElementById('c');
//let ctx = canvas.getContext('2d');

let afterSvg = '', afterPathData = '';
let beforeFileName = '';
let dataMode = 'svg';

function crushSvg(text) {
  let beforeDiv = document.getElementById('before-preview');
  beforeDiv.innerHTML = text;
  let beforeBytes = document.getElementById('before-bytes');
  beforeBytes.innerHTML = text.length;
  let svg = parseSvg(beforeDiv.querySelector('svg'));
  let path = svg.root.flatten();

  // Compensate for view width scaling.
  path = path.scale(svg.scale);
  if (svg.tx !== 0 || svg.ty !== 0) {
    path = path.translate(-svg.tx, -svg.ty);
  }
  // Normalize to a 1000 x 1000 grid
  let factor = 1000 / svg.width;
  path = path.scale(factor);

  let viewWidth = 1000;
  let viewHeight = 1000;
  path.roundOff();
  let d = path.toPathData();

  let newSvg = `<svg width="1000" height="1000" viewBox="0 0 ${viewWidth} ${viewHeight}" xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`;
  let afterDiv = document.getElementById('after-preview');
  afterDiv.innerHTML = newSvg;
  let afterBytes = document.getElementById('after-bytes');
  afterBytes.innerHTML = newSvg.length;
  afterSvg = newSvg;
  afterPathData = d;

  updateTextArea();

  document.body.classList.add('has-file');
}

let beforePreview = document.getElementById('before-preview');
let beforeFileInput = document.getElementById('before-file-input');
let afterPreview = document.getElementById('after-preview');
let pathDataTextArea = document.getElementById('path-data');
let svgModeButton = document.getElementById('mode-svg');
let pathDataModeButton = document.getElementById('mode-path-data');

function highlightDropArea(e) {
  e.preventDefault();
  beforePreview.classList.add('hot');
}

function cancelHighlightDropArea(e) {
  e.preventDefault();
  beforePreview.classList.remove('hot');
}

function clickFile(e) {
  beforeFileInput.value = null;
  beforeFileInput.click();
}

function selectFile() {
  uploadFiles(this.files);
}

function dropFile(e) {
  cancelHighlightDropArea(e);
  let dt = e.dataTransfer;
  uploadFiles(dt.files);
  return false;
}

function uploadFiles(files) {
  if (files.length === 0) return;
  let file = files[0];
  beforeFileName = file.name;
  let reader = new FileReader();
  reader.addEventListener('loadend', function() {
    crushSvg(reader.result);
  });
  reader.readAsText(file);
}

function downloadFile() {
  if (afterSvg.length === 0) return;
  let [baseName, ext] = splitFileExtension(beforeFileName);
  let afterFileName = baseName + '.min' + ext;
  let el = document.createElement('a');
  el.setAttribute('href', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(afterSvg));
  el.setAttribute('download', afterFileName);
  el.style.display = 'none';
  document.body.appendChild(el);
  el.click();
  document.body.removeChild(el);
}

function svgMode() {
  dataMode = 'svg';
  updateTextArea();
  svgModeButton.classList.add('active');
  pathDataModeButton.classList.remove('active');
}

function pathDataMode() {
  dataMode = 'pathData';
  updateTextArea();
  pathDataModeButton.classList.add('active');
  svgModeButton.classList.remove('active');
}

function updateTextArea() {
  if (dataMode === 'svg') {
    pathDataTextArea.value = afterSvg;
  } else {
    pathDataTextArea.value = afterPathData;
  }
}

function selectDemoFile() {
  let url = this.getAttribute('src');
  beforeFileName = baseName(url);
  fetch(url).then(res => res.text()).then(crushSvg);
}

beforePreview.addEventListener('dragover', highlightDropArea);
beforePreview.addEventListener('dragenter', highlightDropArea);
beforePreview.addEventListener('drop', dropFile);
window.addEventListener('mouseup', cancelHighlightDropArea);

beforePreview.addEventListener('click', clickFile);
beforeFileInput.addEventListener('change', selectFile);

afterPreview.addEventListener('click', downloadFile);

svgModeButton.addEventListener('click', svgMode);
pathDataModeButton.addEventListener('click', pathDataMode);
pathDataTextArea.addEventListener('click', function() { this.select(); });

Array.from(document.querySelectorAll('.demo-file')).forEach(el => {
  el.addEventListener('mousedown', selectDemoFile);
});
