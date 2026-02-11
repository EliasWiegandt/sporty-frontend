import type { FunctionalComponent } from 'preact';

type InlineInfoTipProps = {
  id: string;
  label: string;
  steps: string[];
};

const InlineInfoTip: FunctionalComponent<InlineInfoTipProps> = ({ id, label, steps }) => (
  <span className="info-tip-wrap">
    <button
      type="button"
      className="info-tip-trigger"
      aria-label={`About ${label.toLowerCase()}`}
      aria-describedby={id}
    >
      i
    </button>
    <span id={id} role="tooltip" className="info-tip-content">
      <span className="info-tip-title">{label}</span>
      <ul className="info-tip-list">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
    </span>
  </span>
);

export default InlineInfoTip;
