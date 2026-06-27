"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Edit,
  Settings,
  Plus,
  Upload,
  Download,
  CheckCircle2,
  PauseCircle,
  XCircle,
  FileSpreadsheet,
  BarChart3,
  PieChart as PieIcon,
  Activity,
  Loader2,
  Users,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Censo, CampoCenso, UserRole } from "@/lib/types"
import { RegistrosTable } from "@/components/registros-table"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts"

interface CensoDetailClientProps {
  censo: Censo
  campos: CampoCenso[]
  registrosCount: number
  statusCounts: Record<string, number>
  selectCampos: CampoCenso[]
  distributions: Record<string, Record<string, number>>
  userRole: UserRole
  capturistasActivity: { name: string; count: number }[]
}

const STATUS_CONFIG = {
  activo: { label: "Activo", bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  pausado: { label: "Pausado", bg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  finalizado: { label: "Finalizado", bg: "bg-muted text-muted-foreground border-border" },
}

// Quick action definition
const quickActions = (id: string) => [
  { label: "Capturar", href: `/dashboard/censos/${id}/capturar`, icon: Plus, color: "text-blue-500", bg: "bg-blue-500/10 hover:bg-blue-500/20", roles: ["administrador","capturista","analista","consulta"] },
  { label: "Importar", href: `/dashboard/censos/${id}/importar`, icon: Upload, color: "text-emerald-600", bg: "bg-emerald-500/10 hover:bg-emerald-500/20", roles: ["administrador","analista"] },
  { label: "Exportar", href: `/dashboard/censos/${id}/exportar`, icon: Download, color: "text-violet-600", bg: "bg-violet-500/10 hover:bg-violet-500/20", roles: ["administrador","analista"] },
  { label: "Campos", href: `/dashboard/censos/${id}/configurar`, icon: Settings, color: "text-amber-600", bg: "bg-amber-500/10 hover:bg-amber-500/20", roles: ["administrador"] },
]

export function CensoDetailClient({
  censo,
  campos,
  registrosCount,
  statusCounts,
  userRole,
  capturistasActivity,
}: CensoDetailClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const statusCfg = STATUS_CONFIG[censo.status] || STATUS_CONFIG.finalizado

  const [selectedCampoId, setSelectedCampoId] = useState<string>(campos.length > 0 ? campos[0].id : "")
  const [dynamicChartData, setDynamicChartData] = useState<{ name: string; value: number }[]>([])
  const [loadingChart, setLoadingChart] = useState(false)

  useEffect(() => {
    if (!selectedCampoId) return
    let isMounted = true

    async function loadData() {
      setLoadingChart(true)
      const { data } = await supabase
        .from("valores_registro")
        .select("value")
        .eq("campo_id", selectedCampoId)

      if (!isMounted) return

      if (data) {
        const dist: Record<string, number> = {}
        data.forEach(row => {
          const val = row.value || "Sin especificar"
          dist[val] = (dist[val] || 0) + 1
        })
        setDynamicChartData(
          Object.entries(dist)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 12)
        )
      } else {
        setDynamicChartData([])
      }
      setLoadingChart(false)
    }

    loadData()
    return () => { isMounted = false }
  }, [selectedCampoId, supabase])

  const completos = statusCounts.completo || 0
  const incompletos = statusCounts.incompleto || 0
  const errores = statusCounts.error || 0
  const completoPct = registrosCount > 0 ? Math.round((completos / registrosCount) * 100) : 0

  const statusChartData = [
    { name: "Completo", value: completos, color: "#10b981" },
    { name: "Incompleto", value: incompletos, color: "#f59e0b" },
    { name: "Error", value: errores, color: "#ef4444" },
  ].filter(d => d.value > 0)

  const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6", "#f97316"]

  const visibleActions = quickActions(censo.id).filter(a => a.roles.includes(userRole))

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 mt-0.5 shrink-0"
            onClick={() => router.push("/dashboard/censos")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md border">
                {censo.category || "General"}
              </span>
              <Badge className={`${statusCfg.bg} border font-medium text-xs px-2 py-0.5`}>
                {statusCfg.label}
              </Badge>
            </div>
            <h1 className="text-xl font-bold tracking-tight leading-tight">{censo.name}</h1>
            {censo.description && (
              <p className="text-sm text-muted-foreground max-w-xl">{censo.description}</p>
            )}
          </div>
        </div>

        {/* Header edit button — only for non-capturistas */}
        {userRole !== "capturista" && (
          <div className="flex items-center gap-2 shrink-0 pl-11 sm:pl-0">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/censos/${censo.id}/editar`}>
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                Editar
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* ── KPI row + Quick Actions side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* KPI cards — 2x2 grid inside, takes 2 cols */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total registros", value: registrosCount.toLocaleString(), color: "text-foreground", icon: FileSpreadsheet, iconBg: "bg-blue-500/10 text-blue-500" },
            { label: "Completos", value: completos.toLocaleString(), color: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2, iconBg: "bg-emerald-500/10 text-emerald-500" },
            { label: "Incompletos", value: incompletos.toLocaleString(), color: "text-amber-600 dark:text-amber-400", icon: PauseCircle, iconBg: "bg-amber-500/10 text-amber-500" },
            { label: "Con errores", value: errores.toLocaleString(), color: "text-red-600 dark:text-red-400", icon: XCircle, iconBg: "bg-red-500/10 text-red-500" },
          ].map(kpi => {
            const Icon = kpi.icon
            return (
              <Card key={kpi.label} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${kpi.iconBg}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className={`text-xl font-bold leading-none ${kpi.color}`}>{kpi.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Quick Actions — vertical list, takes 1 col */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Acciones rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-2 flex-1 justify-start">
            {visibleActions.map(action => {
              const Icon = action.icon
              return (
                <Button
                  key={action.label}
                  asChild
                  variant="ghost"
                  className={`w-full justify-start h-9 px-3 gap-2.5 font-medium text-sm ${action.bg}`}
                >
                  <Link href={action.href}>
                    <Icon className={`h-4 w-4 shrink-0 ${action.color}`} />
                    {action.label}
                  </Link>
                </Button>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* ── Charts row ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary" />
              Estado de registros
            </CardTitle>
            <CardDescription className="text-xs">Proporción de completitud</CardDescription>
          </CardHeader>
          <CardContent className="min-h-[200px] flex items-center justify-center">
            {statusChartData.length === 0 ? (
              <div className="text-center text-muted-foreground flex flex-col items-center gap-2">
                <Activity className="h-7 w-7 text-muted-foreground/30" />
                <p className="text-xs">Sin registros aún</p>
              </div>
            ) : (
              <div className="w-full h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} registros`, "Cantidad"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dynamic Field chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Análisis por campo
                </CardTitle>
                <CardDescription className="text-xs">Distribución de valores</CardDescription>
              </div>
              {campos.length > 0 && (
                <Select value={selectedCampoId} onValueChange={setSelectedCampoId}>
                  <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Seleccione campo" />
                  </SelectTrigger>
                  <SelectContent>
                    {campos.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent className="min-h-[200px] flex items-center justify-center">
            {loadingChart ? (
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/30" />
            ) : dynamicChartData.length === 0 ? (
              <div className="text-center text-muted-foreground flex flex-col items-center gap-2">
                <Activity className="h-7 w-7 text-muted-foreground/30" />
                <p className="text-xs">Sin datos para este campo</p>
              </div>
            ) : (
              <div className="w-full h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dynamicChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => v.length > 12 ? v.slice(0, 12) + "…" : v} />
                    <YAxis allowDecimals={false} fontSize={9} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => [`${value} registros`, "Total"]} />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {dynamicChartData.map((_, i) => (
                        <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Capturistas Activity ── */}
      {capturistasActivity.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Actividad de capturistas
            </CardTitle>
            <CardDescription className="text-xs">Registros capturados por usuario</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {capturistasActivity.map((c, i) => {
                const maxCount = capturistasActivity[0].count
                const pct = maxCount > 0 ? Math.round((c.count / maxCount) * 100) : 0
                return (
                  <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="text-xs text-muted-foreground font-mono w-5 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{c.name}</span>
                        <span className="text-xs font-semibold tabular-nums text-muted-foreground ml-3 shrink-0">{c.count.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Records Table ── */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-semibold">Registros del censo</CardTitle>
            <CardDescription className="text-xs">Visualiza y administra los registros capturados</CardDescription>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href={`/dashboard/censos/${censo.id}/capturar`}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Capturar
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <RegistrosTable censoId={censo.id} campos={campos} />
        </CardContent>
      </Card>
    </div>
  )
}
