import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react"

type StatCardProps = {
  title: string
  value: string | number
  subtitle?: string
  trend?: "up" | "down" | "stable"
  trendValue?: string
  icon?: LucideIcon
  className?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  className,
}: StatCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus

  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 mt-1">
            {trend && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  trend === "up" && "text-green-500",
                  trend === "down" && "text-red-500",
                  trend === "stable" && "text-muted-foreground"
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {trendValue && <span>{trendValue}</span>}
              </div>
            )}
            {subtitle && (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
