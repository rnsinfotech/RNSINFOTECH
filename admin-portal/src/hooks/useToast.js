import { useCallback, useState } from "react";

export default function useToast() {
  const [toast, setToast] = useState({ message: "", tone: "success" });

  const showToast = useCallback((message, tone = "success") => {
    setToast({ message: "", tone });
    // reset-then-set so a second toast with the same text still retriggers
    requestAnimationFrame(() => setToast({ message, tone }));
  }, []);

  const clearToast = useCallback(() => setToast((t) => ({ ...t, message: "" })), []);

  return { toast, showToast, clearToast };
}
