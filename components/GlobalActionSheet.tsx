import React, { createContext, useCallback, useContext, useState } from 'react';
import { ActionSheet, ActionSheetOption } from './ActionSheet';

interface SheetConfig {
  title?: string;
  message?: string;
  options: ActionSheetOption[];
}

const SheetContext = createContext<(config: SheetConfig) => void>(() => {});

export function GlobalActionSheetProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SheetConfig | null>(null);
  const show = useCallback((cfg: SheetConfig) => setConfig(cfg), []);
  const hide = useCallback(() => setConfig(null), []);

  return (
    <SheetContext.Provider value={show}>
      {children}
      <ActionSheet
        visible={!!config}
        title={config?.title}
        message={config?.message}
        options={config?.options ?? []}
        onClose={hide}
      />
    </SheetContext.Provider>
  );
}

/** Call this anywhere in the tree to show a custom action sheet instead of Alert.alert */
export function useSheet() {
  return useContext(SheetContext);
}
