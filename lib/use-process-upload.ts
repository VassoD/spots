"use client";

import { useCallback, useState } from "react";
import type { ProcessResult } from "./types";

interface ApiError {
  error?: { code?: string; message?: string };
}

interface UploadState {
  status: "idle" | "loading" | "success" | "error";
  result: ProcessResult | null;
  error: string | null;
}

interface UseProcessUpload extends UploadState {
  process: (files: File[]) => Promise<void>;
  reset: () => void;
}

export function useProcessUpload(): UseProcessUpload {
  const [state, setState] = useState<UploadState>({
    status: "idle",
    result: null,
    error: null,
  });

  const process = useCallback(async (files: File[]): Promise<void> => {
    if (files.length === 0) return;
    setState({ status: "loading", result: null, error: null });

    const form = new FormData();
    for (const file of files) form.append("files", file);

    try {
      const res = await fetch("/api/process", { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiError;
        throw new Error(body.error?.message ?? `Upload failed (${res.status})`);
      }
      const result = (await res.json()) as ProcessResult;
      setState({ status: "success", result, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setState({ status: "error", result: null, error: message });
    }
  }, []);

  const reset = useCallback((): void => {
    setState({ status: "idle", result: null, error: null });
  }, []);

  return { ...state, process, reset };
}
