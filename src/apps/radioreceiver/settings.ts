import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { BaseStyle } from "../../ui/styles.js";
import { SDR_KIND_LABELS } from "../../devices/provider.js";
import type { SdrKind } from "../../devices/provider.js";
import { GPS_SOURCE_LABELS, formatLatLon } from "../../gps/gps.js";
import type { GpsSource, GpsStatus } from "../../gps/gps.js";
import { RrWindow, WindowDelegate } from "../../ui/controls/window.js";
import "../../ui/controls/frequency-input.js";
import "../../ui/controls/window.js";

import { formatRate, sampleRatesFor } from "../../devices/rates.js";

export { sampleRatesFor };

export type ConnectedSdrInfo = {
  kind: "rtlsdr" | "hackrf";
  name: string;
  detail?: string;
};

const AVAILABLE_FFT_SIZES: number[] = (() => {
  let sizes = new Array();
  for (let s = 32; s <= 32768; s *= 2) {
    sizes.push(s);
  }
  return sizes;
})();

type LowFrequencyMethodName = LowFrequencyMethod["name"];
type DirectSamplingChannel = LowFrequencyMethod["channel"];

export type LowFrequencyMethod = {
  name: "default" | "directSampling" | "upconverter";
  channel: "I" | "Q";
  frequency: number;
  biasTee: boolean;
};

const LOW_FREQUENCY_METHODS: Map<LowFrequencyMethodName, string> = new Map([
  ["default", "Default method"],
  ["directSampling", "Direct sampling"],
  ["upconverter", "External upconverter"],
]);

const DIRECT_SAMPLING_CHANNELS: Map<DirectSamplingChannel, string> = new Map([
  ["Q", "Q"],
  ["I", "I"],
]);

const FM_DEEMPH_TCS: Map<number, string> = new Map([
  [50, "Europe"],
  [75, "USA"],
]);

export type PerformanceTradeoff = "cpu" | "latency" | "quality";

const PERFORMANCE_TRADEOFFS: Map<PerformanceTradeoff, string> = new Map([
  ["cpu", "Use more CPU"],
  ["latency", "Have more latency"],
  ["quality", "Have worse quality"],
]);

@customElement("rr-settings")
export class RrSettings extends WindowDelegate(LitElement) {
  static get styles() {
    return [
      BaseStyle,
      css`
        h3 {
          margin: 0.9em 0 0.35em;
          font-size: 0.78em;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.7;
        }
        h3:first-child {
          margin-top: 0.2em;
        }
        .note {
          font-size: 0.85em;
          opacity: 0.75;
          max-width: 34ch;
        }
        .ok {
          color: #16a34a;
        }
        .warn {
          color: #d97706;
        }
        .err {
          color: #dc2626;
        }
        @media (prefers-color-scheme: dark) {
          .ok {
            color: #4ade80;
          }
          .warn {
            color: #fbbf24;
          }
          .err {
            color: #f87171;
          }
        }
        .row {
          display: flex;
          gap: 0.5em;
          align-items: center;
          flex-wrap: wrap;
        }
      `,
    ];
  }

  private effectiveKind(): SdrKind {
    return this.connectedSdr?.kind ?? (this.sdrKind === "hackrf" ? "hackrf" : "rtlsdr");
  }

  private renderDevice() {
    const c = this.connectedSdr;
    return html`<h3>Device</h3>
      <div>
        <label for="sdrKind">SDR: </label
        ><select id="sdrKind" .disabled=${this.playing} @change=${this.onSdrKindChange}>
          ${[...SDR_KIND_LABELS.entries()].map(
            ([k, v]) => html`<option value=${k} .selected=${this.sdrKind == k}>${v}</option>`,
          )}
        </select>
      </div>
      <div class="note">
        ${c
          ? html`<span class="ok">●</span> ${c.name}${c.detail ? html` · ${c.detail}` : nothing}`
          : html`Press ▶ to choose a device. RTL-SDR on Windows needs the WinUSB driver
              (Zadig); HackRF works without extra drivers.`}
      </div>
      <div class="row">
        <button id="chooseDevice" .disabled=${this.playing} @click=${this.onChooseDevice}>
          Use a different device…
        </button>
      </div>
      <div .hidden=${this.effectiveKind() != "hackrf"}>
        <label for="hackrfAmp">HackRF RF amp (+14 dB): </label
        ><input
          type="checkbox"
          id="hackrfAmp"
          .checked=${this.hackrfAmp}
          @change=${this.onHackrfAmpChange}
        />
      </div>`;
  }

  private renderGps() {
    const st = this.gpsStatus;
    const cls =
      st.state === "fix" ? "ok" : st.state === "error" ? "err" : st.state === "off" ? "" : "warn";
    return html`<h3>Location</h3>
      <div class="row">
        <label for="gpsSource">GPS: </label
        ><select id="gpsSource" @change=${this.onGpsSourceChange}>
          ${[...GPS_SOURCE_LABELS.entries()].map(
            ([k, v]) => html`<option value=${k} .selected=${this.gpsSource == k}>${v}</option>`,
          )}
        </select>
        <button id="gpsConnect" .hidden=${this.gpsSource == "off"} @click=${this.onGpsConnect}>
          ${this.gpsSource == "gmouse" ? "Connect GPS…" : "Start"}
        </button>
      </div>
      <div class="note">
        <span class=${cls}>●</span>
        ${st.fix
          ? html`${formatLatLon(st.fix)}
              ${st.fix.accuracyM !== undefined ? html` ±${st.fix.accuracyM.toFixed(0)} m` : nothing}
              ${st.fix.satellites !== undefined ? html` · ${st.fix.satellites} sats` : nothing}`
          : st.message ?? (st.state === "off" ? "Off" : st.state)}
      </div>`;
  }

  private renderEngine() {
    return html`<h3>Performance</h3>
      <div class="note">
        DSP engine:
        ${this.dspActive
          ? html`<span class="ok">Rust/WebAssembly${this.dspSimd ? " (SIMD)" : ""}</span>`
          : html`<span class="warn">JavaScript</span>`}
      </div>
      <div>
        <label for="wasmDsp">Use Rust/WASM DSP: </label
        ><input
          type="checkbox"
          id="wasmDsp"
          .checked=${this.wasmDsp}
          @change=${this.onWasmDspChange}
        />
      </div>`;
  }

  render() {
    return html`<rr-window
      label="Settings"
      id="settings"
      closeable
      class=${this.inline ? "inline" : ""}
      .position=${this.position}
      .fixed=${this.inline}
    >
      ${this.renderDevice()}
      <h3>Radio</h3>
      <div>
        <label for="sampleRate">Sample rate: </label
        ><select
          id="sampleRate"
          .disabled=${this.playing}
          @change=${this.onSampleRateChange}
        >
          ${(() => {
            const rates = sampleRatesFor(this.effectiveKind());
            const list = rates.includes(this.sampleRate) ? rates : [...rates, this.sampleRate].sort((a, b) => a - b);
            return list.map(
              (r) =>
                html`<option value=${r} .selected=${this.sampleRate == r}>
                  ${formatRate(r)}
                </option>`,
            );
          })()}
        </select>
      </div>
      <div>
        <label for="ppm">Clock correction: </label
        ><input
          id="ppm"
          type="number"
          min="-500"
          max="500"
          step="1"
          .value=${String(this.ppm)}
          @change=${this.onPpmChange}
        />PPM
      </div>
      <div>
        <label for="fftSize">FFT size: </label
        ><select id="fftSize" @change=${this.onFftSizeChange}>
          ${AVAILABLE_FFT_SIZES.map(
            (s) =>
              html`<option value=${s} .selected=${this.fftSize == s}>
                ${s}
              </option>`,
          )}
        </select>
      </div>
      <div>
        <label for="fmDeemph">WBFM de-emphasis: </label
        ><select
          id="fmDeemph"
          .disabled=${this.playing}
          @change=${this.onFmDeemphChange}
        >
          ${FM_DEEMPH_TCS.entries().map(
            (r) =>
              html`<option value=${r[0]} .selected=${this.fmDeemph == r[0]}>
                ${r[0]}µs &mdash; ${r[1]}
              </option>`,
          )}
        </select>
      </div>
      <div>
        <label for="biasTee">Bias T: </label
        ><input
          type="checkbox"
          id="biasTee"
          .checked=${this.biasTee}
          @change=${this.onBiasTeeChange}
        />
      </div>
      <div .hidden=${this.effectiveKind() == "hackrf"}>
        <label for="lowFreqMethod">0-29MHz method: </label
        ><select id="lowFreqMethod" @change=${this.onLowFrequencyMethodChange}>
          ${LOW_FREQUENCY_METHODS.entries().map(
            ([k, v]) =>
              html`<option
                value=${String(k)}
                .selected=${this.lowFrequencyMethod.name == k}
              >
                ${v}
              </option>`,
          )}
        </select>
      </div>
      <div .hidden=${this.lowFrequencyMethod.name != "directSampling" || this.effectiveKind() == "hackrf"}>
        <label for="directSamplingChannel">Direct sampling channel: </label
        ><select
          id="directSamplingChannel"
          @change=${this.onDirectSamplingChannelChange}
        >
          ${DIRECT_SAMPLING_CHANNELS.entries().map(
            ([k, v]) =>
              html`<option
                value=${String(k)}
                .selected=${this.lowFrequencyMethod.channel == k}
              >
                ${v}
              </option>`,
          )}
        </select>
      </div>
      <div .hidden=${this.lowFrequencyMethod.name != "upconverter"}>
        <label for="upconverterFrequency">Upconverter frequency: </label
        ><input
          type="number"
          id="upconverterFrequency"
          min="1"
          max="1800000000"
          step="1"
          .value=${String(this.lowFrequencyMethod.frequency)}
          @change=${this.onUpconverterFrequencyChange}
        />
      </div>
      <div .hidden=${this.lowFrequencyMethod.name != "upconverter"}>
        <label for="upconverterBiasTee">Use bias T for upconverter: </label
        ><input
          type="checkbox"
          id="upconverterBiasTee"
          .checked=${this.lowFrequencyMethod.biasTee}
          @change=${this.onUpconverterBiasTeeChange}
        />
      </div>
      <div>
        <label for="performanceTradeoff">Performance trade-off: </label
        ><select
          id="performanceTradeoff"
          .disabled=${this.playing}
          @change=${this.onPerformanceTradeoffChange}
        >
          ${PERFORMANCE_TRADEOFFS.entries().map(
            (r) =>
              html`<option
                value=${r[0]}
                .selected=${this.performanceTradeoff == r[0]}
              >
                ${r[1]}
              </option>`,
          )}
        </select>
      </div>
      ${this.renderEngine()} ${this.renderGps()}
      ${this.canInstall
        ? html`<h3>App</h3>
            <button id="install" @click=${this.onInstall}>Install webRx as an app</button>`
        : nothing}
    </rr-window>`;
  }

  @property({ attribute: false }) inline: boolean = false;
  @property({ attribute: false }) playing: boolean = false;
  @property({ attribute: false }) sampleRate: number = 1024000;
  @property({ attribute: false }) ppm: number = 0;
  @property({ attribute: false }) fftSize: number = 2048;
  @property({ attribute: false }) fmDeemph: number = 50;
  @property({ attribute: false }) biasTee: boolean = false;
  @property({ attribute: false }) lowFrequencyMethod: LowFrequencyMethod = {
    name: "default",
    channel: "Q",
    frequency: 100000000,
    biasTee: false,
  };
  @property({ attribute: false }) performanceTradeoff: PerformanceTradeoff = "cpu";
  @property({ attribute: false }) sdrKind: SdrKind = "auto";
  @property({ attribute: false }) connectedSdr?: ConnectedSdrInfo;
  @property({ attribute: false }) hackrfAmp: boolean = false;
  @property({ attribute: false }) dspActive: boolean = false;
  @property({ attribute: false }) dspSimd: boolean = false;
  @property({ attribute: false }) wasmDsp: boolean = true;
  @property({ attribute: false }) gpsSource: GpsSource = "off";
  @property({ attribute: false }) gpsStatus: GpsStatus = { source: "off", state: "off" };
  @property({ attribute: false }) canInstall: boolean = false;
  @query("rr-window") protected window?: RrWindow;

  private onSdrKindChange(e: Event) {
    this.sdrKind = (e.target as HTMLSelectElement).selectedOptions[0].value as SdrKind;
    this.dispatchEvent(new SimpleEvent("rr-sdr-kind-changed"));
  }

  private onChooseDevice() {
    this.dispatchEvent(new SimpleEvent("rr-choose-device"));
  }

  private onHackrfAmpChange(e: Event) {
    this.hackrfAmp = (e.target as HTMLInputElement).checked;
    this.dispatchEvent(new SimpleEvent("rr-hackrf-amp-changed"));
  }

  private onWasmDspChange(e: Event) {
    this.wasmDsp = (e.target as HTMLInputElement).checked;
    this.dispatchEvent(new SimpleEvent("rr-wasm-dsp-changed"));
  }

  private onGpsSourceChange(e: Event) {
    this.gpsSource = (e.target as HTMLSelectElement).selectedOptions[0].value as GpsSource;
    this.dispatchEvent(new SimpleEvent("rr-gps-source-changed"));
  }

  private onGpsConnect() {
    this.dispatchEvent(new SimpleEvent("rr-gps-connect"));
  }

  private onInstall() {
    this.dispatchEvent(new SimpleEvent("rr-install-app"));
  }

  private onSampleRateChange(e: Event) {
    this.sampleRate = Number(
      (e.target as HTMLSelectElement).selectedOptions[0].value,
    );
    this.dispatchEvent(new SampleRateChangedEvent());
  }

  private onPpmChange(e: Event) {
    let input = e.target as HTMLInputElement;
    let value = Number(input.value);
    if (isNaN(value)) {
      input.value = String(this.ppm);
      return;
    }
    this.ppm = value;
    this.dispatchEvent(new PpmChangedEvent());
  }

  private onFftSizeChange(e: Event) {
    this.fftSize = Number(
      (e.target as HTMLSelectElement).selectedOptions[0].value,
    );
    this.dispatchEvent(new FftSizeChangedEvent());
  }

  private onFmDeemphChange(e: Event) {
    this.fmDeemph = Number(
      (e.target as HTMLSelectElement).selectedOptions[0].value,
    );
    this.dispatchEvent(new FmDeemphChangedEvent());
  }

  private onBiasTeeChange(e: Event) {
    this.biasTee = (e.target as HTMLInputElement).checked;
    this.dispatchEvent(new BiasTeeChangedEvent());
  }

  private onLowFrequencyMethodChange(e: Event) {
    let method = { ...this.lowFrequencyMethod };
    method.name = (e.target as HTMLSelectElement).selectedOptions[0]
      .value as LowFrequencyMethodName;
    this.lowFrequencyMethod = method;
    this.dispatchEvent(new LowFrequencyMethodChangedEvent());
  }

  private onDirectSamplingChannelChange(e: Event) {
    let method = { ...this.lowFrequencyMethod };
    method.channel = (e.target as HTMLSelectElement).selectedOptions[0]
      .value as DirectSamplingChannel;
    this.lowFrequencyMethod = method;
    this.dispatchEvent(new LowFrequencyMethodChangedEvent());
  }

  private onUpconverterFrequencyChange(e: Event) {
    let target = e.target as HTMLInputElement;
    let value = Number(target.value);
    if (isNaN(value)) {
      target.value = String(this.lowFrequencyMethod.frequency);
      return;
    }
    let method = { ...this.lowFrequencyMethod };
    method.frequency = value;
    this.lowFrequencyMethod = method;
    this.dispatchEvent(new LowFrequencyMethodChangedEvent());
  }

  private onUpconverterBiasTeeChange(e: Event) {
    let method = { ...this.lowFrequencyMethod };
    method.biasTee = (e.target as HTMLInputElement).checked;
    this.lowFrequencyMethod = method;
    this.dispatchEvent(new LowFrequencyMethodChangedEvent());
  }

  private onPerformanceTradeoffChange(e: Event) {
    this.performanceTradeoff = (
      e.target as HTMLSelectElement
    ).selectedOptions[0].value as PerformanceTradeoff;
    this.dispatchEvent(new PerformanceTradeoffChangedEvent());
  }
}

class SimpleEvent extends Event {
  constructor(type: string) {
    super(type, { bubbles: true, composed: true });
  }
}

class SampleRateChangedEvent extends Event {
  constructor() {
    super("rr-sample-rate-changed", { bubbles: true, composed: true });
  }
}

class PpmChangedEvent extends Event {
  constructor() {
    super("rr-ppm-changed", { bubbles: true, composed: true });
  }
}

class FftSizeChangedEvent extends Event {
  constructor() {
    super("rr-fft-size-changed", { bubbles: true, composed: true });
  }
}

class FmDeemphChangedEvent extends Event {
  constructor() {
    super("rr-fm-deemph-changed", { bubbles: true, composed: true });
  }
}

class BiasTeeChangedEvent extends Event {
  constructor() {
    super("rr-bias-tee-changed", { bubbles: true, composed: true });
  }
}

class LowFrequencyMethodChangedEvent extends Event {
  constructor() {
    super("rr-low-frequency-method-changed", { bubbles: true, composed: true });
  }
}

class PerformanceTradeoffChangedEvent extends Event {
  constructor() {
    super("rr-performance-tradeoff-changed", { bubbles: true, composed: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    "rr-sample-rate-changed": SampleRateChangedEvent;
    "rr-ppm-changed": PpmChangedEvent;
    "rr-fft-size-changed": FftSizeChangedEvent;
    "rr-fm-deemph-changed": FmDeemphChangedEvent;
    "rr-bias-tee-changed": BiasTeeChangedEvent;
    "rr-low-frequency-method-changed": LowFrequencyMethodChangedEvent;
    "rr-performance-tradeoff-changed": PerformanceTradeoffChangedEvent;
    "rr-sdr-kind-changed": Event;
    "rr-choose-device": Event;
    "rr-hackrf-amp-changed": Event;
    "rr-wasm-dsp-changed": Event;
    "rr-gps-source-changed": Event;
    "rr-gps-connect": Event;
    "rr-install-app": Event;
  }
}
