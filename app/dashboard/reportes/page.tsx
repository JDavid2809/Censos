"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts"
import * as XLSX from "xlsx"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { Database, TrendingUp, FileSpreadsheet, Download, Loader2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Censo } from "@/lib/types"

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

type StatsType = {
  totalRegistros: number
  porStatus: { name: string; value: number }[]
  porFecha: { date: string; count: number }[]
  porCampo: { name: string; filled: number; empty: number }[]
  registrosRaw: { id: string; status: string; created_at: string; valores_registro: { campo_id: string; value: string }[] }[]
  camposRaw: { id: string; label: string; name: string }[]
}

export default function ReportesPage() {
  const [censos, setCensos] = useState<Censo[]>([])
  const [selectedCenso, setSelectedCenso] = useState<string>("")
  const [selectedCensoName, setSelectedCensoName] = useState<string>("")
  const [stats, setStats] = useState<StatsType | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  // Use ref to avoid re-creating supabase client on each render (prevents useEffect loop)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    async function fetchCensos() {
      const { data } = await supabase
        .from("censos")
        .select("*")
        .order("created_at", { ascending: false })

      setCensos(data || [])
      if (data && data.length > 0) {
        setSelectedCenso(data[0].id)
        setSelectedCensoName(data[0].name)
      }
      setLoading(false)
    }
    fetchCensos()
  }, [supabase])

  useEffect(() => {
    async function fetchStats() {
      if (!selectedCenso) return

      const { data: registros } = await supabase
        .from("registros")
        .select("*, valores_registro(*)")
        .eq("censo_id", selectedCenso)

      const { data: campos } = await supabase
        .from("campos_censo")
        .select("*")
        .eq("censo_id", selectedCenso)

      if (!registros || !campos) return

      const porStatus = [
        { name: "Completos", value: registros.filter((r) => r.status === "completo").length },
        { name: "Incompletos", value: registros.filter((r) => r.status === "incompleto").length },
        { name: "Con errores", value: registros.filter((r) => r.status === "error").length },
      ].filter((s) => s.value > 0)

      const dateGroups: Record<string, number> = {}
      registros.forEach((r) => {
        const date = new Date(r.created_at).toLocaleDateString("es-ES")
        dateGroups[date] = (dateGroups[date] || 0) + 1
      })
      const porFecha = Object.entries(dateGroups)
        .map(([date, count]) => ({ date, count }))
        .slice(-7)

      const porCampo = campos
        .map((campo) => {
          const filled = registros.filter((r) =>
            r.valores_registro.some(
              (v: { campo_id: string; value: string }) =>
                v.campo_id === campo.id && v.value && v.value.trim() !== ""
            )
          ).length
          return {
            name: campo.label,
            filled,
            empty: registros.length - filled,
          }
        })
        .slice(0, 8)

      setStats({
        totalRegistros: registros.length,
        porStatus,
        porFecha,
        porCampo,
        registrosRaw: registros,
        camposRaw: campos,
      })
    }

    fetchStats()
  }, [selectedCenso, supabase])

  async function handleExport(format: "xlsx" | "csv" | "pdf") {
    if (!stats || !stats.registrosRaw.length) return
    setExporting(true)

    const headers = stats.camposRaw.map((c) => c.label)
    const rows = stats.registrosRaw.map((r) => {
      const valMap = new Map(r.valores_registro.map((v) => [v.campo_id, v.value]))
      return stats.camposRaw.map((c) => valMap.get(c.id) || "")
    })

    const filename = `${selectedCensoName.replace(/[^a-zA-Z0-9]/g, "_")}_${
      new Date().toISOString().split("T")[0]
    }`

    if (format === "xlsx" || format === "csv") {
      const wsData = [headers, ...rows]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Datos")
      XLSX.writeFile(wb, `${filename}.${format}`, format === "csv" ? { bookType: "csv" } : undefined)
    } else {
      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.text(selectedCensoName, 14, 22)
      doc.setFontSize(10)
      doc.text(`Exportado: ${new Date().toLocaleString("es-ES")}`, 14, 30)
      doc.text(`Total registros: ${stats.totalRegistros}`, 14, 36)
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 42,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] },
      })
      doc.save(`${filename}.pdf`)
    }

    setExporting(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
          <p className="text-muted-foreground">
            Visualiza y analiza los datos de tus censos
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={selectedCenso}
            onValueChange={(id) => {
              setSelectedCenso(id)
              setSelectedCensoName(censos.find((c) => c.id === id)?.name || "")
            }}
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Selecciona un censo" />
            </SelectTrigger>
            <SelectContent>
              {censos.map((censo) => (
                <SelectItem key={censo.id} value={censo.id}>
                  {censo.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {stats && stats.totalRegistros > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={exporting}>
                  {exporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-blue-600" />
                  CSV (.csv)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-red-600" />
                  PDF (.pdf)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {censos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hay censos disponibles</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total registros</CardTitle>
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalRegistros || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasa de completitud</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats && stats.totalRegistros > 0
                    ? Math.round(
                        ((stats.porStatus.find((s) => s.name === "Completos")?.value || 0) /
                          stats.totalRegistros) *
                          100
                      )
                    : 0}
                  %
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Campos definidos</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.camposRaw.length || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribución por estado</CardTitle>
                <CardDescription>Registros agrupados por estado de completitud</CardDescription>
              </CardHeader>
              <CardContent>
                {stats && stats.porStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={stats.porStatus}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {stats.porStatus.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registros por fecha</CardTitle>
                <CardDescription>Evolución de capturas en los últimos días</CardDescription>
              </CardHeader>
              <CardContent>
                {stats && stats.porFecha.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={stats.porFecha}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        name="Registros"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Completitud por campo</CardTitle>
                <CardDescription>
                  Porcentaje de registros con cada campo completado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats && stats.porCampo.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.porCampo} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="filled" stackId="a" fill="#10b981" name="Completados" />
                      <Bar dataKey="empty" stackId="a" fill="#e5e7eb" name="Vacíos" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Sin datos
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
