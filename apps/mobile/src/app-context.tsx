import { createContext, useContext } from 'react';
export interface AppMeta { today: string; timezone: string; company: { name: string } | null; payrollMonth: { year: number; month: number; from: string; to: string } }
export const MetaCtx = createContext<{ meta: AppMeta | null; reload: () => void }>({ meta: null, reload: () => {} });
export const useMeta = () => useContext(MetaCtx);
