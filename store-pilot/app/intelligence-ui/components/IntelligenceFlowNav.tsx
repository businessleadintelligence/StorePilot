import { INTELLIGENCE_FLOW_STEPS } from "../constants";
import { useIntelligenceWorkspace } from "../context/IntelligenceWorkspaceProvider";
import styles from "../intelligence-workspace.module.css";

export function IntelligenceFlowNav() {
  const { activeStep, setActiveStep } = useIntelligenceWorkspace();

  return (
    <nav aria-label="Intelligence exploration flow" className={styles.flowNav}>
      {INTELLIGENCE_FLOW_STEPS.map((step) => (
        <button
          key={step.key}
          type="button"
          className={`${styles.flowStep} ${activeStep === step.key ? styles.flowStepActive : ""}`}
          aria-current={activeStep === step.key ? "step" : undefined}
          onClick={() => setActiveStep(step.key)}
        >
          {step.label}
        </button>
      ))}
    </nav>
  );
}
