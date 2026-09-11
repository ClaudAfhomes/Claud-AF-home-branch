import { createContext, useContext, useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useCmsRevision } from "@/hooks/useCmsRevision";

export const DraftContext = createContext<(id: string, dirty: boolean) => void>(() => {});
export function useAdminDraft<T>(initial: () => T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initial);
  const getter = useRef(initial);
  const mark = useContext(DraftContext);
  const id = useId();
  const revision = useCmsRevision();
  useEffect(() => {
    const refresh = () => setValue(getter.current());
    window.addEventListener("afhomes-cms-updated", refresh);
    return () => window.removeEventListener("afhomes-cms-updated", refresh);
  }, []);
  const dirty = JSON.stringify(value) !== JSON.stringify(getter.current());
  useEffect(() => { mark(id, dirty); }, [mark, id, dirty, revision]);
  useEffect(() => () => mark(id, false), [mark, id]);
  return [value, setValue];
}
