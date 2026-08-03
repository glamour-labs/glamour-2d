/**
 * The WebGL2 rasterizer that replaces Konva's Canvas2D layer.
 *
 * Draw model, per node, in order:
 *   1. tessellate the node's geometry into a Mesh (mesh.ts)
 *   2. write that geometry into the STENCIL buffer only
 *   3. draw one bounding quad through the stencil, shaded solid / gradient / texture
 *   4. clear the stencil region
 *
 * Step 2/3 is the load-bearing choice. Drawing tessellated triangles directly
 * would antialias every internal triangle edge as well as the silhouette, and
 * overlapping quads-and-discs then leave visible seams inside a thick stroke
 * (observed directly in the WebGL draw-letter spike). A stencil union is binary
 * per sample, so with a multisampled default framebuffer only the true outline
 * gets antialiased. One extra draw per node buys correct edges.
 *
 * Glow/shadow renders the same silhouette into an offscreen target and runs a
 * separable Gaussian over it before compositing underneath the node.
 */

import { Mesh } from './mesh.js';

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface GradientPaint {
  kind: 'linear' | 'radial';
  from: [number, number];
  to: [number, number];
  startRadius: number;
  endRadius: number;
  stops: Array<{ offset: number; color: Rgba }>;
}

export interface ShadowPaint {
  color: Rgba;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export type Paint =
  | { kind: 'solid'; color: Rgba }
  | { kind: 'gradient'; gradient: GradientPaint }
  | {
      kind: 'texture';
      source: TexImageSource;
      x: number;
      y: number;
      w: number;
      h: number;
      /** Rotation pivot in canvas pixels — the node's own origin. */
      originX: number;
      originY: number;
      /** Rotation in degrees, matching the node's `rotation` prop. */
      rot: number;
    };

const MAX_STOPS = 8;

const VS_QUAD = `#version 300 es
in vec2 a_pos;
uniform vec2 u_res;
out vec2 v_px;
void main() {
  v_px = a_pos;
  vec2 clip = (a_pos / u_res) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FS_SOLID = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 o;
void main() { o = vec4(u_color.rgb * u_color.a, u_color.a); }`;

const FS_GRADIENT = `#version 300 es
precision highp float;
in vec2 v_px;
uniform int u_kind;          // 0 = linear, 1 = radial
uniform vec2 u_from;
uniform vec2 u_to;
uniform float u_r0;
uniform float u_r1;
uniform int u_nstops;
uniform float u_offsets[${MAX_STOPS}];
uniform vec4 u_colors[${MAX_STOPS}];
uniform float u_alpha;
out vec4 o;

vec4 sampleStops(float t) {
  if (u_nstops <= 0) return vec4(0.0);
  if (t <= u_offsets[0]) return u_colors[0];
  for (int i = 1; i < ${MAX_STOPS}; i++) {
    if (i >= u_nstops) break;
    if (t <= u_offsets[i]) {
      float span = max(u_offsets[i] - u_offsets[i - 1], 1e-5);
      float f = (t - u_offsets[i - 1]) / span;
      return mix(u_colors[i - 1], u_colors[i], f);
    }
  }
  return u_colors[u_nstops - 1];
}

void main() {
  float t;
  if (u_kind == 0) {
    vec2 d = u_to - u_from;
    float len2 = max(dot(d, d), 1e-6);
    t = clamp(dot(v_px - u_from, d) / len2, 0.0, 1.0);
  } else {
    float dist = length(v_px - u_from);
    t = clamp((dist - u_r0) / max(u_r1 - u_r0, 1e-6), 0.0, 1.0);
  }
  vec4 c = sampleStops(t);
  float a = c.a * u_alpha;
  o = vec4(c.rgb * a, a);
}`;

// Samples a bitmap (today: rasterized text) through the stencil mask.
//
// The mask is built from ROTATED geometry, so this must un-rotate the fragment
// position before computing uv — otherwise the glyph is sampled axis-aligned and
// then clipped by a rotated mask, which renders rotated text upright and
// truncated. (Caught by conformance/text-and-stroke.glam.)
const FS_TEXTURE = `#version 300 es
precision highp float;
in vec2 v_px;
uniform sampler2D u_tex;
uniform vec4 u_box;        // unrotated box: x, y, w, h in pixels
uniform vec2 u_origin;     // rotation pivot (the node origin)
uniform float u_rot;       // radians
uniform float u_alpha;
out vec4 o;
void main() {
  vec2 p = v_px - u_origin;
  float c = cos(-u_rot);
  float s = sin(-u_rot);
  vec2 q = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + u_origin;
  vec2 uv = (q - u_box.xy) / u_box.zw;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { o = vec4(0.0); return; }
  vec4 t = texture(u_tex, uv);
  o = vec4(t.rgb * t.a * u_alpha, t.a * u_alpha);
}`;

// Separable Gaussian used for glow. Reads a premultiplied silhouette.
const FS_BLUR = `#version 300 es
precision highp float;
in vec2 v_px;
uniform sampler2D u_tex;
uniform vec2 u_texel;      // 1 / textureSize
uniform vec2 u_dir;        // (1,0) then (0,1)
uniform float u_radius;
uniform vec2 u_res;
out vec4 o;
void main() {
  vec2 uv = v_px / u_res;
  float sigma = max(u_radius * 0.5, 0.6);
  float wsum = 0.0;
  vec4 acc = vec4(0.0);
  int taps = int(min(u_radius, 32.0));
  for (int i = -32; i <= 32; i++) {
    if (i < -taps || i > taps) continue;
    float fi = float(i);
    float w = exp(-(fi * fi) / (2.0 * sigma * sigma));
    acc += texture(u_tex, uv + u_dir * u_texel * fi) * w;
    wsum += w;
  }
  o = acc / max(wsum, 1e-5);
}`;

// Tints a premultiplied silhouette to the shadow colour and composites it.
//
// Two corrections live here, and only here:
//   1. Y FLIP. The vertex shader negates clip.y so a_pos is in canvas space
//      (top-left origin). Render that into an FBO and the texture — which has a
//      BOTTOM-left origin — stores the image upside down. Sampling with the same
//      top-left convention double-flips it, which put every glow at `h - y`
//      instead of `y`. The intermediate blur passes deliberately do NOT flip:
//      they read and write the same storage space, and a Gaussian is
//      positionally symmetric, so they are correct in storage coordinates.
//   2. OFFSET. Sampling at (v_px - offset) shifts the shadow by +offset while
//      the quad stays full-canvas. Offsetting the quad instead crops the
//      texture rather than moving it.
const FS_TINT = `#version 300 es
precision highp float;
in vec2 v_px;
uniform sampler2D u_tex;
uniform vec4 u_color;
uniform vec2 u_res;
uniform vec2 u_offset;
out vec4 o;
void main() {
  vec2 src = v_px - u_offset;
  vec2 uv = vec2(src.x / u_res.x, 1.0 - src.y / u_res.y);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { o = vec4(0.0); return; }
  float a = texture(u_tex, uv).a * u_color.a;
  o = vec4(u_color.rgb * a, a);
}`;

interface Program {
  p: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

const CONTEXT_ATTRS: WebGLContextAttributes = {
  antialias: true,
  alpha: true,
  premultipliedAlpha: true,
  stencil: true,
  preserveDrawingBuffer: true,
};

export class GlRenderer {
  gl: WebGL2RenderingContext;
  readonly width: number;
  readonly height: number;
  readonly dpr: number;

  private solid!: Program;
  private gradient!: Program;
  private texture!: Program;
  private blur!: Program;
  private tint!: Program;
  private vao!: WebGLVertexArrayObject;
  private buf!: WebGLBuffer;
  private mesh = new Mesh();
  private texCache = new Map<string, WebGLTexture>();
  private fbo: { fb: WebGLFramebuffer; tex: WebGLTexture } | null = null;
  private fboB: { fb: WebGLFramebuffer; tex: WebGLTexture } | null = null;
  private destroyed = false;

  /**
   * True between `webglcontextlost` and `webglcontextrestored`. Every draw path
   * turns into a no-op while set: a lost context makes every GL call fail, and
   * throwing from a frame callback would take the whole player down for what is
   * a recoverable, browser-initiated event.
   */
  private lost = false;

  /** Called after a successful restore so the owner can repaint. */
  onRestored: (() => void) | null = null;
  /** Called when the context is lost, so the owner can stop asking for frames. */
  onLost: (() => void) | null = null;

  private detachHandlers: Array<() => void> = [];

  constructor(
    readonly canvas: HTMLCanvasElement | OffscreenCanvas,
    width: number,
    height: number,
    dpr = 1,
  ) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.gl = this.acquireContext();
    this.initGpu();
    this.attachContextHandlers();
  }

  private acquireContext(): WebGL2RenderingContext {
    const gl = this.canvas.getContext('webgl2', CONTEXT_ATTRS) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('GlRenderer: WebGL2 unavailable');
    return gl;
  }

  /**
   * Create every GPU-side resource. Runs at construction AND again after a
   * context restore — nothing created here survives a loss, so it must all be
   * rebuildable from CPU state alone.
   */
  private initGpu(): void {
    const gl = this.gl;
    this.solid = this.program(VS_QUAD, FS_SOLID, ['u_res', 'u_color']);
    this.gradient = this.program(VS_QUAD, FS_GRADIENT, [
      'u_res', 'u_kind', 'u_from', 'u_to', 'u_r0', 'u_r1', 'u_nstops', 'u_alpha',
      ...Array.from({ length: MAX_STOPS }, (_, i) => `u_offsets[${i}]`),
      ...Array.from({ length: MAX_STOPS }, (_, i) => `u_colors[${i}]`),
    ]);
    this.texture = this.program(VS_QUAD, FS_TEXTURE, ['u_res', 'u_tex', 'u_box', 'u_origin', 'u_rot', 'u_alpha']);
    this.blur = this.program(VS_QUAD, FS_BLUR, ['u_res', 'u_tex', 'u_texel', 'u_dir', 'u_radius']);
    this.tint = this.program(VS_QUAD, FS_TINT, ['u_res', 'u_tex', 'u_color', 'u_offset']);

    const vao = gl.createVertexArray();
    const buf = gl.createBuffer();
    if (!vao || !buf) throw new Error('GlRenderer: buffer allocation failed');
    this.vao = vao;
    this.buf = buf;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.viewport(0, 0, Math.round(this.width * this.dpr), Math.round(this.height * this.dpr));
    gl.enable(gl.BLEND);
    // Everything the shaders emit is premultiplied.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
  }

  /**
   * A WebGL context can be taken away at any time — backgrounded tab, GPU reset,
   * memory pressure, or another page winning the GPU. Canvas2D has no equivalent
   * failure mode, which is why v1 never needed this; without it the canvas goes
   * blank permanently, which in a long lesson means a student staring at nothing.
   *
   * `preventDefault()` on the lost event is REQUIRED: without it the browser
   * never fires `webglcontextrestored` and recovery is impossible.
   */
  private attachContextHandlers(): void {
    const target = this.canvas as unknown as {
      addEventListener?: (t: string, fn: (e: Event) => void) => void;
      removeEventListener?: (t: string, fn: (e: Event) => void) => void;
    };
    if (typeof target.addEventListener !== 'function') return;

    const onLost = (e: Event): void => {
      e.preventDefault();
      this.lost = true;
      // Every GL handle is now invalid. Drop the texture cache so a restore
      // re-uploads rather than binding dead names; the CPU-side rasters that
      // produced them live on the nodes and survive.
      this.texCache.clear();
      this.fbo = null;
      this.fboB = null;
      this.onLost?.();
    };

    const onRestored = (): void => {
      if (this.destroyed) return;
      try {
        this.gl = this.acquireContext();
        this.initGpu();
        this.lost = false;
        this.onRestored?.();
      } catch (err) {
        // Stay in the lost state rather than half-initialized; a later restore
        // event can try again.
        // eslint-disable-next-line no-console
        console.error('GlRenderer: context restore failed', err);
      }
    };

    target.addEventListener('webglcontextlost', onLost);
    target.addEventListener('webglcontextrestored', onRestored);
    this.detachHandlers.push(() => {
      target.removeEventListener?.('webglcontextlost', onLost);
      target.removeEventListener?.('webglcontextrestored', onRestored);
    });
  }

  /** True while the GPU context is unavailable. */
  get isContextLost(): boolean {
    return this.lost || this.gl.isContextLost();
  }

  /** Test seam: force a loss/restore cycle through the standard extension. */
  __simulateContextLoss(restoreAfterMs = 0): boolean {
    const ext = this.gl.getExtension('WEBGL_lose_context');
    if (!ext) return false;
    ext.loseContext();
    if (restoreAfterMs >= 0) {
      setTimeout(() => {
        try { ext.restoreContext(); } catch { /* already gone */ }
      }, restoreAfterMs);
    }
    return true;
  }

  private compile(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(type);
    if (!s) throw new Error('GlRenderer: createShader failed');
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      // ANGLE can reject non-ASCII bytes with an empty log, so surface both.
      throw new Error(`GlRenderer: shader compile failed: ${gl.getShaderInfoLog(s) || '(empty log)'}`);
    }
    return s;
  }

  private program(vs: string, fs: string, uniforms: string[]): Program {
    const gl = this.gl;
    const p = gl.createProgram();
    if (!p) throw new Error('GlRenderer: createProgram failed');
    gl.attachShader(p, this.compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, fs));
    // Attribute 0 is always a_pos so one VAO serves every program.
    gl.bindAttribLocation(p, 0, 'a_pos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`GlRenderer: link failed: ${gl.getProgramInfoLog(p) || '(empty log)'}`);
    }
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniforms) u[name] = gl.getUniformLocation(p, name);
    return { p, u };
  }

  /** Clear the whole canvas to a background colour. */
  begin(bg: Rgba): void {
    if (this.isContextLost) return;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, Math.round(this.width * this.dpr), Math.round(this.height * this.dpr));
    gl.clearColor(bg.r * bg.a, bg.g * bg.a, bg.b * bg.a, bg.a);
    gl.clearStencil(0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  }

  /**
   * Draw one node: `build` fills the mesh with the node's geometry (in canvas
   * pixels), then the paint is shaded through the resulting stencil mask.
   */
  drawNode(
    build: (m: Mesh) => void,
    paint: Paint,
    alpha: number,
    shadow?: ShadowPaint,
  ): void {
    if (alpha <= 0 || this.isContextLost) return;
    this.mesh.clear();
    build(this.mesh);
    if (this.mesh.count === 0) return;
    const verts = new Float32Array(this.mesh.v);

    if (shadow && shadow.blur > 0 && shadow.color.a > 0) {
      this.drawGlow(verts, shadow);
    }

    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.stencilFrom(verts);
    this.shadeThroughStencil(paint, alpha, bounds(this.mesh.v));
    this.clearStencil(verts);
  }

  /** Mark the mesh's coverage in the stencil buffer. */
  private stencilFrom(verts: Float32Array): void {
    const gl = this.gl;
    gl.enable(gl.STENCIL_TEST);
    gl.colorMask(false, false, false, false);
    gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    gl.stencilOp(gl.REPLACE, gl.REPLACE, gl.REPLACE);
    gl.stencilMask(0xff);
    this.rawDraw(this.solid, verts, () => {
      gl.uniform4f(this.solid.u.u_color!, 0, 0, 0, 0);
    });
    gl.colorMask(true, true, true, true);
    gl.stencilFunc(gl.EQUAL, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  }

  /** Reset only the region this node touched, so the next node starts clean. */
  private clearStencil(verts: Float32Array): void {
    const gl = this.gl;
    gl.colorMask(false, false, false, false);
    gl.stencilFunc(gl.ALWAYS, 0, 0xff);
    gl.stencilOp(gl.REPLACE, gl.REPLACE, gl.REPLACE);
    this.rawDraw(this.solid, verts, () => {
      gl.uniform4f(this.solid.u.u_color!, 0, 0, 0, 0);
    });
    gl.colorMask(true, true, true, true);
    gl.disable(gl.STENCIL_TEST);
  }

  private shadeThroughStencil(paint: Paint, alpha: number, box: Box): void {
    const gl = this.gl;
    const quad = quadVerts(box);
    if (paint.kind === 'solid') {
      this.rawDraw(this.solid, quad, () => {
        const c = paint.color;
        gl.uniform4f(this.solid.u.u_color!, c.r, c.g, c.b, c.a * alpha);
      });
      return;
    }
    if (paint.kind === 'gradient') {
      const g = paint.gradient;
      this.rawDraw(this.gradient, quad, () => {
        const u = this.gradient.u;
        gl.uniform1i(u.u_kind!, g.kind === 'linear' ? 0 : 1);
        gl.uniform2f(u.u_from!, g.from[0], g.from[1]);
        gl.uniform2f(u.u_to!, g.to[0], g.to[1]);
        gl.uniform1f(u.u_r0!, g.startRadius);
        gl.uniform1f(u.u_r1!, g.endRadius);
        gl.uniform1f(u.u_alpha!, alpha);
        const n = Math.min(g.stops.length, MAX_STOPS);
        gl.uniform1i(u.u_nstops!, n);
        for (let i = 0; i < n; i++) {
          const s = g.stops[i];
          gl.uniform1f(u[`u_offsets[${i}]`]!, s.offset);
          gl.uniform4f(u[`u_colors[${i}]`]!, s.color.r, s.color.g, s.color.b, s.color.a);
        }
      });
      return;
    }
    const tex = this.uploadTexture(paint.source);
    this.rawDraw(this.texture, quad, () => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(this.texture.u.u_tex!, 0);
      gl.uniform4f(this.texture.u.u_box!, paint.x, paint.y, paint.w, paint.h);
      gl.uniform2f(this.texture.u.u_origin!, paint.originX, paint.originY);
      gl.uniform1f(this.texture.u.u_rot!, (paint.rot * Math.PI) / 180);
      gl.uniform1f(this.texture.u.u_alpha!, alpha);
    });
  }

  /**
   * Glow: silhouette → offscreen, blur X, blur Y, tint, composite at the offset.
   */
  private drawGlow(verts: Float32Array, shadow: ShadowPaint): void {
    const gl = this.gl;
    const a = this.ensureFbo('a');
    const b = this.ensureFbo('b');
    const W = Math.round(this.width * this.dpr);
    const H = Math.round(this.height * this.dpr);

    // Silhouette into A (no stencil needed — we only want coverage).
    gl.bindFramebuffer(gl.FRAMEBUFFER, a.fb);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);
    this.rawDraw(this.solid, verts, () => {
      gl.uniform4f(this.solid.u.u_color!, 1, 1, 1, 1);
    });

    const full = quadVerts({ x0: 0, y0: 0, x1: this.width, y1: this.height });
    // Blur A → B (horizontal), B → A (vertical).
    const pass = (src: WebGLTexture, dstFb: WebGLFramebuffer, dir: [number, number]): void => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dstFb);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.rawDraw(this.blur, full, () => {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src);
        gl.uniform1i(this.blur.u.u_tex!, 0);
        gl.uniform2f(this.blur.u.u_texel!, 1 / W, 1 / H);
        gl.uniform2f(this.blur.u.u_dir!, dir[0], dir[1]);
        gl.uniform1f(this.blur.u.u_radius!, shadow.blur * this.dpr);
      });
    };
    pass(a.tex, b.fb, [1, 0]);
    pass(b.tex, a.fb, [0, 1]);

    // Composite the tinted blur. Full-canvas quad — the offset is applied as a
    // sampling shift inside FS_TINT, not by moving the geometry.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.enable(gl.BLEND);
    this.rawDraw(this.tint, full, () => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, a.tex);
      gl.uniform1i(this.tint.u.u_tex!, 0);
      const c = shadow.color;
      gl.uniform4f(this.tint.u.u_color!, c.r, c.g, c.b, c.a);
      gl.uniform2f(this.tint.u.u_offset!, shadow.offsetX, shadow.offsetY);
    });
  }

  private ensureFbo(which: 'a' | 'b'): { fb: WebGLFramebuffer; tex: WebGLTexture } {
    const existing = which === 'a' ? this.fbo : this.fboB;
    if (existing) return existing;
    const gl = this.gl;
    const W = Math.round(this.width * this.dpr);
    const H = Math.round(this.height * this.dpr);
    const tex = gl.createTexture();
    const fb = gl.createFramebuffer();
    if (!tex || !fb) throw new Error('GlRenderer: FBO allocation failed');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const made = { fb, tex };
    if (which === 'a') this.fbo = made;
    else this.fboB = made;
    return made;
  }

  private uploadTexture(source: TexImageSource): WebGLTexture {
    const gl = this.gl;
    // Text rasters are cached by the scene; identity is enough here.
    const key = String((source as { __glamKey?: string }).__glamKey ?? '');
    const hit = key && this.texCache.get(key);
    if (hit) return hit;
    const tex = gl.createTexture();
    if (!tex) throw new Error('GlRenderer: createTexture failed');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (key) this.texCache.set(key, tex);
    return tex;
  }

  private rawDraw(prog: Program, verts: Float32Array, setUniforms: () => void): void {
    const gl = this.gl;
    gl.useProgram(prog.p);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(prog.u.u_res!, this.width, this.height);
    setUniforms();
    gl.drawArrays(gl.TRIANGLES, 0, verts.length / 2);
  }

  /** Read the canvas back as raw RGBA — used by the headless render path. */
  readPixels(): Uint8Array {
    const gl = this.gl;
    if (this.isContextLost) {
      // Transparent black rather than a throw: a caller mid-capture gets an
      // obviously-empty frame instead of an exception from a recoverable event.
      return new Uint8Array(Math.round(this.width * this.dpr) * Math.round(this.height * this.dpr) * 4);
    }
    const W = Math.round(this.width * this.dpr);
    const H = Math.round(this.height * this.dpr);
    const out = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return out;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const off of this.detachHandlers) off();
    this.detachHandlers = [];
    const gl = this.gl;
    // A lost context has already reclaimed everything; deleting dead handles is
    // harmless but pointless, and gl.delete* on a lost context can warn.
    if (this.lost || gl.isContextLost()) {
      this.texCache.clear();
      this.fbo = null;
      this.fboB = null;
      return;
    }
    for (const t of this.texCache.values()) gl.deleteTexture(t);
    this.texCache.clear();
    for (const f of [this.fbo, this.fboB]) {
      if (!f) continue;
      gl.deleteFramebuffer(f.fb);
      gl.deleteTexture(f.tex);
    }
    this.fbo = null;
    this.fboB = null;
    gl.deleteBuffer(this.buf);
    gl.deleteVertexArray(this.vao);
    for (const p of [this.solid, this.gradient, this.texture, this.blur, this.tint]) {
      gl.deleteProgram(p.p);
    }
    // Deliberately NOT calling WEBGL_lose_context.loseContext(): under React
    // StrictMode / HMR the effect runs mount→unmount→mount on the SAME canvas,
    // and losing the context leaves the remount with a dead one.
  }
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Bounding box of a flat vertex array, padded so the AA fringe is inside. */
function bounds(v: readonly number[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < v.length; i += 2) {
    if (v[i] < x0) x0 = v[i];
    if (v[i] > x1) x1 = v[i];
    if (v[i + 1] < y0) y0 = v[i + 1];
    if (v[i + 1] > y1) y1 = v[i + 1];
  }
  const pad = 2;
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

function quadVerts(b: Box): Float32Array {
  return new Float32Array([
    b.x0, b.y0, b.x1, b.y0, b.x1, b.y1,
    b.x0, b.y0, b.x1, b.y1, b.x0, b.y1,
  ]);
}

/** `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()` → normalized Rgba. */
export function parseColor(input: string | undefined, fallback: Rgba = { r: 0, g: 0, b: 0, a: 0 }): Rgba {
  if (!input) return fallback;
  const s = input.trim();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const p = (i: number): number => parseInt(hex[i] + hex[i], 16) / 255;
      return { r: p(0), g: p(1), b: p(2), a: hex.length === 4 ? p(3) : 1 };
    }
    if (hex.length === 6 || hex.length === 8) {
      const p = (i: number): number => parseInt(hex.slice(i, i + 2), 16) / 255;
      return { r: p(0), g: p(2), b: p(4), a: hex.length === 8 ? p(6) : 1 };
    }
    return fallback;
  }
  const m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const parts = m[1].split(',').map((x) => parseFloat(x.trim()));
    if (parts.length >= 3) {
      return {
        r: (parts[0] || 0) / 255,
        g: (parts[1] || 0) / 255,
        b: (parts[2] || 0) / 255,
        a: parts.length > 3 ? (Number.isFinite(parts[3]) ? parts[3] : 1) : 1,
      };
    }
  }
  return fallback;
}
