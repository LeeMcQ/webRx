import { css } from "lit";

export const BaseStyle = css`
  :host {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    accent-color: #2563eb;
  }

  input,
  select,
  button {
    font: inherit;
  }

  select,
  input[type="number"],
  input[type="text"] {
    border: 1px solid #94a3b8;
    border-radius: 6px;
    padding: 2px 6px;
    background: #fff;
    color: inherit;
  }

  button {
    border: 1px solid #94a3b8;
    border-radius: 6px;
    background: #f1f5f9;
    color: inherit;
    cursor: pointer;
    padding: 2px 8px;
  }

  button:hover:not(:disabled) {
    filter: brightness(0.96);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 1px;
  }

  @media (prefers-color-scheme: dark) {
    select,
    input,
    input[type="number"],
    input[type="text"] {
      background: #0b1220;
      color: #e2e8f0;
      border-color: #334155;
    }

    button {
      background: #1e293b;
      color: #e2e8f0;
      border-color: #334155;
    }

    button:hover:not(:disabled) {
      filter: brightness(1.15);
    }
  }

  rr-window {
    bottom: calc(1em + 24px);
    right: 1em;
  }

  @media (max-width: 778px) {
    rr-window {
      bottom: calc(1em + 48px);
    }
  }

  button:has(svg[width="16"][height="16"]) {
    padding-inline: 0;
    width: 24px;
    height: 24px;
  }

  button > svg[width="16"][height="16"] {
    display: block;
    width: 16px;
    height: 16px;
    margin: auto;
  }

  /* Bigger touch targets on phones and tablets. */
  @media (pointer: coarse) {
    select,
    input[type="number"],
    input[type="text"],
    button {
      min-height: 34px;
    }

    button:has(svg[width="16"][height="16"]) {
      width: 36px;
      height: 36px;
    }
  }
`;
