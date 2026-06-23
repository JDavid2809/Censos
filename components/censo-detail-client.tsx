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
  Layers,
  Calendar,
  AlertCircle,
  BarChart3,
  PieChart as PieIcon,
  Activity,
  Loader2
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Censo, CampoCenso } from "@/lib/types"
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
  Legend
} from "recharts"

interface CensoDetailClientProps {
  censo: Censo
  campos: CampoCenso[]
  registrosCount: number
  statusCounts: Record<string, number>
  selectCampos: CampoCenso[]
  distributions: Record<string, Record<string, number>>
}

const STATUS_CONFIG = {
  activo: { label: "Activo", variant: "default" as const, bg: "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" },
  pausado: { label: "Pausado", variant: "secondary" as const, bg: "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" },
  finalizado: { label: "Finalizado", variant: "outline" as const, bg: "bg-muted text-muted-foreground" },
}

export function CensoDetailClient({
  censo,
  campos,
  registrosCount,
  statusCounts,
  selectCampos,
  distributions,
}: CensoDetailClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const statusCfg = STATUS_CONFIG[censo.status] || STATUS_CONFIG.finalizado

  const [selectedCampoId, setSelectedCampoId] = useState<string>(campos.length > 0 ? campos[0].id : "")
  const [dynamicChartData, setDynamicChartData] = useState<{name: string, value: number}[]>([])
  const [loadingChart, setLoadingChart] = useState(false)

  useEffect(() => {
    if (!selectedCampoId) return
    let isMounted = true

    async function loadData() {
      setLoadingChart(true)
      const { data } = await supabase
        .from('valores_registro')
        .select('value')
        .eq('campo_id', selectedCampoId)

      if (!isMounted) return

      if (data) {
        const dist: Record<string, number> = {}
        data.forEach(row => {
          let val = row.value || "Sin especificar"
          dist[val] = (dist[val] || 0) + 1
        })
        const distData = Object.entries(dist)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 12)

        setDynamicChartData(distData)
      } else {
        setDynamicChartData([])
      }
      setLoadingChart(false)
    }

    loadData()
    return () => { isMounted = false }
  }, [selectedCampoId, supabase])

  // KPI Calculations
  const completos = statusCounts.completo || 0
  const incompletos = statusCounts.incompleto || 0
  const errores = statusCounts.error || 0

  // 1. Status Chart Data
  const statusChartData = [
    { name: "Completo", value: completos, color: "#10b981" },
    { name: "Incompleto", value: incompletos, color: "#f59e0b" },
    { name: "Error", value: errores, color: "#ef4444" },
  ].filter(d => d.value > 0)

  // 2. Field Type Composition (for fallback/extra details)
  const fieldTypeCounts = campos.reduce<Record<string, number>>((acc, c) => {
    acc[c.field_type] = (acc[c.field_type] || 0) + 1
    return acc
  }, {})
  const fieldTypeData = Object.entries(fieldTypeCounts).map(([type, count]) => ({
    name: type.replace("_", " ").toUpperCase(),
    value: count,
  }))

  const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6", "#f97316"]

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-6 py-6">
      {/* ── Top Navigation Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => router.push("/dashboard/censos")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {censo.category || "General"}
            </span>
            <Badge className={`${statusCfg.bg} border-none font-medium text-xs`}>
              {statusCfg.label}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">{censo.name}</h1>
          {censo.description && (
            <p className="text-sm text-muted-foreground max-w-2xl">{censo.description}</p>
          )}
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/censos/${censo.id}/editar`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar censo
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/censos/${censo.id}/configurar`}>
              <Settings className="mr-2 h-4 w-4" />
              Campos
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Key Statistics Widget ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Registros Totales</p>
              <p className="text-2xl font-bold">{registrosCount.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completos</p>
              <p className="text-2xl font-bold text-emerald-500">{completos.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Incompletos</p>
              <p className="text-2xl font-bold text-amber-500">{incompletos.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <PauseCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Con Errores</p>
              <p className="text-2xl font-bold text-red-500">{errores.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
              <XCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Actions Hub ── */}
      <Card className="bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 grid-cols-2 md:grid-cols-4 pt-0">
          <Button asChild className="h-20 flex flex-col items-center justify-center gap-1.5" variant="outline">
            <Link href={`/dashboard/censos/${censo.id}/capturar`}>
              <Plus className="h-5 w-5 text-blue-500" />
              <span className="text-xs font-semibold">Capturar registro</span>
            </Link>
          </Button>
          <Button asChild className="h-20 flex flex-col items-center justify-center gap-1.5" variant="outline">
            <Link href={`/dashboard/censos/${censo.id}/importar`}>
              <Upload className="h-5 w-5 text-emerald-500" />
              <span className="text-xs font-semibold">Importar datos</span>
            </Link>
          </Button>
          <Button asChild className="h-20 flex flex-col items-center justify-center gap-1.5" variant="outline">
            <Link href={`/dashboard/censos/${censo.id}/exportar`}>
              <Download className="h-5 w-5 text-purple-500" />
              <span className="text-xs font-semibold">Exportar datos</span>
            </Link>
          </Button>
          <Button asChild className="h-20 flex flex-col items-center justify-center gap-1.5" variant="outline">
            <Link href={`/dashboard/censos/${censo.id}/configurar`}>
              <Settings className="h-5 w-5 text-amber-500" />
              <span className="text-xs font-semibold">Configurar campos</span>
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* ── Charts & Visualizations ── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Status distribution chart */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary" />
              Estado de los Registros
            </CardTitle>
            <CardDescription>Proporción de completitud de datos cargados</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[250px] flex items-center justify-center">
            {statusChartData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center justify-center">
                <Activity className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs">No hay registros capturados todavía</p>
              </div>
            ) : (
              <div className="w-full h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={3}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
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

        {/* Dynamic Field analysis chart */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Análisis por Campo
                </CardTitle>
                <CardDescription>
                  Distribución de valores del campo seleccionado
                </CardDescription>
              </div>
              <Select value={selectedCampoId} onValueChange={setSelectedCampoId}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Seleccione un campo" />
                </SelectTrigger>
                <SelectContent>
                  {campos.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-[250px] flex items-center justify-center">
            {loadingChart ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
            ) : dynamicChartData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center justify-center">
                <Activity className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs">Sin datos suficientes para este campo</p>
              </div>
            ) : (
              <div className="w-full h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dynamicChartData}>
                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val} />
                    <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => [`${value} registros`, "Total"]} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
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

      {/* ── Records Table ── */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg font-bold">Registros del Censo</CardTitle>
            <CardDescription>Visualiza, busca y administra los registros capturados</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <RegistrosTable censoId={censo.id} campos={campos} />
        </CardContent>
      </Card>
    </div>
  )
}
