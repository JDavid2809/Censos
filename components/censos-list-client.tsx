"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  Search,
  Database,
  FileSpreadsheet,
  Layers,
  Clock,
  ArrowRight,
  Trash2,
  Edit,
  BookTemplate,
  MoreVertical,
  CheckCircle2,
  PauseCircle,
  XCircle,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Censo } from "@/lib/types"

type CensoWithCounts = Censo & {
  campos_censo: { count: number }[]
  registros: { count: number }[]
}

interface CensosListClientProps {
  initialCensos: CensoWithCounts[]
}

// Mini-sparkline bar chart using just divs (no chart library needed)
function MiniBarChart({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.min((value / max) * 100, 100)
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// Status config
const STATUS_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string; bg: string }> = {
  activo: {
    icon: CheckCircle2,
    label: "Activo",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-800",
  },
  pausado: {
    icon: PauseCircle,
    label: "Pausado",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-200 dark:border-amber-800",
  },
  finalizado: {
    icon: XCircle,
    label: "Finalizado",
    color: "text-muted-foreground",
    bg: "bg-muted border-border",
  },
}

// Category accent colors
const CATEGORY_ACCENT: Record<string, string> = {
  "Población": "from-blue-500/20 to-blue-500/5 border-t-blue-400",
  "Economía": "from-emerald-500/20 to-emerald-500/5 border-t-emerald-400",
  "Salud": "from-red-500/20 to-red-500/5 border-t-red-400",
  "Educación": "from-purple-500/20 to-purple-500/5 border-t-purple-400",
  "Vivienda": "from-amber-500/20 to-amber-500/5 border-t-amber-400",
  "Agricultura": "from-lime-500/20 to-lime-500/5 border-t-lime-400",
  "Ganadería": "from-orange-500/20 to-orange-500/5 border-t-orange-400",
  "Medio ambiente": "from-teal-500/20 to-teal-500/5 border-t-teal-400",
  "default": "from-primary/10 to-primary/5 border-t-primary/50",
}

const CATEGORY_BAR_COLOR: Record<string, string> = {
  "Población": "bg-blue-500",
  "Economía": "bg-emerald-500",
  "Salud": "bg-red-500",
  "Educación": "bg-purple-500",
  "Vivienda": "bg-amber-500",
  "Agricultura": "bg-lime-500",
  "Ganadería": "bg-orange-500",
  "Medio ambiente": "bg-teal-500",
  "default": "bg-primary",
}

export function CensosListClient({ initialCensos }: CensosListClientProps) {
  const [censos, setCensos] = useState<CensoWithCounts[]>(initialCensos)
  const [search, setSearch] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const router = useRouter()
  const supabase = createClient()

  const filtered = censos.filter(c => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (c.category?.toLowerCase().includes(search.toLowerCase()) ?? false)
    const matchStatus = filterStatus === "all" || c.status === filterStatus
    return matchSearch && matchStatus
  })

  const maxRegistros = Math.max(...censos.map(c => c.registros?.[0]?.count || 0), 1)

  async function handleDelete() {
    if (!deleteId) return
    await supabase.from("censos").delete().eq("id", deleteId)
    setCensos(prev => prev.filter(c => c.id !== deleteId))
    setDeleteId(null)
    router.refresh()
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, descripción o categoría..."
            className="pl-9 h-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1.5">
          {[
            { value: "all", label: "Todos" },
            { value: "activo", label: "Activos" },
            { value: "pausado", label: "Pausados" },
            { value: "finalizado", label: "Finalizados" },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* New censo button */}
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="h-10">
            <Link href="/dashboard/censos/plantillas">
              <BookTemplate className="mr-2 h-4 w-4" />
              Plantillas
            </Link>
          </Button>
          <Button asChild size="sm" className="h-10">
            <Link href="/dashboard/censos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo censo
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-5">
            <Database className="h-9 w-9 text-muted-foreground/50" />
          </div>
          <h3 className="font-semibold text-lg mb-1">
            {search || filterStatus !== "all" ? "Sin resultados" : "No hay censos aún"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {search
              ? `No se encontraron censos que coincidan con "${search}"`
              : filterStatus !== "all"
              ? "No hay censos con este estado. Cambia el filtro."
              : "Comienza creando tu primer censo o usa una plantilla predefinida."}
          </p>
          {!search && filterStatus === "all" && (
            <div className="flex gap-3 mt-5">
              <Button asChild variant="outline">
                <Link href="/dashboard/censos/plantillas">
                  <BookTemplate className="mr-2 h-4 w-4" />
                  Desde plantilla
                </Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard/censos/nuevo">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear censo
                </Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* ── Census cards grid ── */
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(censo => {
            const registrosCount = censo.registros?.[0]?.count || 0
            const camposCount = censo.campos_censo?.[0]?.count || 0
            const statusCfg = STATUS_CONFIG[censo.status] || STATUS_CONFIG.finalizado
            const StatusIcon = statusCfg.icon
            const accent = CATEGORY_ACCENT[censo.category || ""] || CATEGORY_ACCENT.default
            const barColor = CATEGORY_BAR_COLOR[censo.category || ""] || CATEGORY_BAR_COLOR.default
            const createdDate = new Date(censo.created_at).toLocaleDateString("es-ES", {
              day: "numeric", month: "short", year: "numeric",
            })

            return (
              <div
                key={censo.id}
                className={`group relative rounded-xl border bg-card overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-t-2 ${accent.split(" ").find(c => c.startsWith("border-t-")) || "border-t-primary/30"}`}
                onClick={() => router.push(`/dashboard/censos/${censo.id}`)}
              >
                {/* Gradient header band */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${accent.split(" ").slice(0, 2).join(" ")}`} />

                <div className="p-5">
                  {/* Top row: title + menu */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-base leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                        {censo.name}
                      </h3>
                      {censo.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {censo.description}
                        </p>
                      )}
                    </div>

                    {/* 3-dot menu — stops card click propagation */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <button className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/censos/${censo.id}/editar`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar censo
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(censo.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Category + Status */}
                  <div className="flex items-center gap-2 mb-4">
                    {censo.category && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {censo.category}
                      </span>
                    )}
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Layers className="h-3 w-3" /> Campos
                        </span>
                        <span className="text-xs font-bold">{camposCount}</span>
                      </div>
                      <MiniBarChart value={camposCount} max={Math.max(camposCount, 10)} color="bg-primary/60" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <FileSpreadsheet className="h-3 w-3" /> Registros
                        </span>
                        <span className="text-xs font-bold">{registrosCount.toLocaleString()}</span>
                      </div>
                      <MiniBarChart value={registrosCount} max={maxRegistros} color={barColor} />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/60">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {createdDate}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Ver censo
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Delete confirm dialog ── */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar censo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el censo y <strong>todos sus registros y campos</strong> de forma permanente.
              No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
