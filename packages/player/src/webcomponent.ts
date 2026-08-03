import { validate, type GlamDoc } from '@glam/core';
import { renderGlamour, type GlamPlayer } from './player.js';

const TAG_NAME = 'glam-canvas';

/**
 * `<glam-canvas>` — reads a `src` attribute (a URL to a `.glam` JSON file) or
 * a `doc` property (an already-parsed GlamDoc) and mounts a live
 * `renderGlamour` player inside itself.
 */
export class GlamCanvasElement extends HTMLElement {
  private _doc: GlamDoc | null = null;
  private _player: GlamPlayer | null = null;
  private _error: Error | null = null;
  private readonly _mount: HTMLElement;

  static get observedAttributes(): string[] {
    return ['src'];
  }

  /** The most recent load/validation error, if any (cleared on next success). */
  get error(): Error | null {
    return this._error;
  }

  constructor() {
    super();
    // Per the custom-element spec, constructors must not add attributes or
    // children to `this` — the mount div is created here but only appended
    // once connected (see connectedCallback / _remount).
    this._mount = document.createElement('div');
  }

  get doc(): GlamDoc | null {
    return this._doc;
  }

  set doc(value: GlamDoc | null) {
    this._doc = value;
    this._remount();
  }

  connectedCallback(): void {
    this._remount();
  }

  disconnectedCallback(): void {
    this._teardown();
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'src' && newValue) {
      void this._loadFromSrc(newValue);
    }
  }

  private async _loadFromSrc(src: string): Promise<void> {
    try {
      const res = await fetch(src);
      if (!res.ok) {
        throw new Error(`glam-canvas: failed to load "${src}" (HTTP ${res.status})`);
      }
      const json: unknown = await res.json();
      const result = validate(json);
      if (!result.ok) {
        throw new Error(`glam-canvas: invalid doc from "${src}": ${result.errors.join('; ')}`);
      }
      this._error = null;
      this.doc = json as GlamDoc;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._error = error;
      this.doc = null;
      this.dispatchEvent(new CustomEvent('glam-error', { detail: { error }, bubbles: true }));
    }
  }

  private _teardown(): void {
    this._player?.destroy();
    this._player = null;
  }

  private _remount(): void {
    this._teardown();
    if (!this._doc || !this.isConnected) return;
    if (!this._mount.isConnected) this.appendChild(this._mount);
    this._mount.replaceChildren();
    this._player = renderGlamour(this._doc, this._mount);
  }
}

/** Registers `<glam-canvas>` if it hasn't been registered yet (idempotent). */
export function defineGlamCanvas(): void {
  if (!customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, GlamCanvasElement);
  }
}
