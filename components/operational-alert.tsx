"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  title?: string
  message: string
  severity?: "warning" | "error"
  onRetry?: () => void
}

export function OperationalAlert({ title, message, severity = "warning", onRetry }: Props) {
  const palette =
    severity === "error"
      ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
      : "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"

  return (
    <div className={`rounded-lg border p-3 text-sm ${palette}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {title || "Aviso operacional"}
          </div>
          <div className="mt-1">{message}</div>
        </div>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  )
}

