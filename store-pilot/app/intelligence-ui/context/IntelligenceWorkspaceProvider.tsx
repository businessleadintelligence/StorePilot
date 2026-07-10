import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  IntelligenceEntityView,
  IntelligenceFlowStep,
  WorkspaceContextValue,
} from "../types";

const IntelligenceWorkspaceContext = createContext<WorkspaceContextValue | null>(null);

type IntelligenceWorkspaceProviderProps = {
  children: ReactNode;
  initialStep?: IntelligenceFlowStep;
};

export function IntelligenceWorkspaceProvider({
  children,
  initialStep = "summary",
}: IntelligenceWorkspaceProviderProps) {
  const [activeStep, setActiveStep] = useState<IntelligenceFlowStep>(initialStep);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<IntelligenceEntityView | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);

  const openDrawer = useCallback((entity: IntelligenceEntityView) => {
    setSelectedEntity(entity);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedEntity(null);
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      activeStep,
      setActiveStep,
      drawerOpen,
      openDrawer,
      closeDrawer,
      selectedEntity,
      commandOpen,
      setCommandOpen,
    }),
    [activeStep, closeDrawer, commandOpen, drawerOpen, openDrawer, selectedEntity],
  );

  return (
    <IntelligenceWorkspaceContext.Provider value={value}>
      {children}
    </IntelligenceWorkspaceContext.Provider>
  );
}

export function useIntelligenceWorkspace(): WorkspaceContextValue {
  const context = useContext(IntelligenceWorkspaceContext);
  if (!context) {
    throw new Error("useIntelligenceWorkspace must be used within IntelligenceWorkspaceProvider");
  }
  return context;
}
