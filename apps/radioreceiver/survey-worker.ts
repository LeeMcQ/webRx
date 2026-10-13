// Web Worker for RM survey processing (gating, reduction, encoding, gzip, hashing).
import { handle, type SurveyProcessor, type ToWorker } from "../../src/survey/processor.js";

const state = { p: null as SurveyProcessor | null };
self.onmessage = async (e: MessageEvent<ToWorker>) => {
  try {
    const { reply, transfer } = await handle(state, e.data);
    (self as any).postMessage(reply, transfer);
  } catch (err: any) {
    (self as any).postMessage({ id: e.data.id, ok: false, error: String(err?.message ?? err) });
  }
};
