"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MoreHorizontal, Eye, Edit, Trash2, FileSpreadsheet, Loader2, Search } from "lucide-react"
import type { CampoCenso, FieldType, Registro, ValorRegistro } from "@/lib/types"

interface RegistrosTableProps {
  censoId: string
  campos: CampoCenso[]
}

type RegistroWithValores = Registro & { valores_registro: ValorRegistro[] }

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
    completo: { variant: "default", label: "Completo" },
    incompleto: { variant: "secondary", label: "Incompleto" },
    error: { variant: "destructive", label: "Error" },
  }
  const config = variants[status] || { variant: "secondary" as const, label: status }
  return <Badge variant={config.variant}>{config.label}</Badge>
}

function DynamicField({
  campo,
  value,
  onChange,
  disabled,
}: {
  campo: CampoCenso
  value: string | string[] | undefined
  onChange: (v: string | string[]) => void
  disabled: boolean
}) {
  const options = (campo.options as { options?: string[] })?.options || []

  const handleMulti = (opt: string, checked: boolean) => {
    const current = Array.isArray(value)
      ? value
      : (typeof value === "string" ? value.split(",").map((s) => s.trim()).filter(Boolean) : [])
    onChange(checked ? [...current, opt] : current.filter((v: string) => v !== opt))
  }

  switch (campo.field_type as FieldType) {
    case "texto":
    case "email":
    case "telefono":
      return (
        <Input
          type={campo.field_type === "email" ? "email" : campo.field_type === "telefono" ? "tel" : "text"}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )
    case "numero":
      return (
        <Input type="number" value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
      )
    case "decimal":
      return (
        <Input type="number" step="0.01" value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
      )
    case "fecha":
      return (
        <Input type="date" value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
      )
    case "booleano":
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={(value as string) === "true"}
            onCheckedChange={(c) => onChange(c ? "true" : "false")}
            disabled={disabled}
          />
          <span className="text-sm text-muted-foreground">{(value as string) === "true" ? "Sí" : "No"}</span>
        </div>
      )
    case "textarea":
    case "direccion":
      return (
        <Textarea value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={3} />
      )
    case "seleccion_unica":
      return (
        <Select value={(value as string) || ""} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccione" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    case "seleccion_multiple": {
      const currentArr = Array.isArray(value)
        ? value
        : (typeof value === "string" ? value.split(",").map((s) => s.trim()).filter(Boolean) : [])
      return (
        <div className="space-y-2">
          {options.map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <Checkbox
                id={`${campo.id}-${opt}`}
                checked={currentArr.includes(opt.trim())}
                onCheckedChange={(c) => handleMulti(opt.trim(), !!c)}
                disabled={disabled}
              />
              <Label htmlFor={`${campo.id}-${opt}`} className="text-sm font-normal">{opt}</Label>
            </div>
          ))}
        </div>
      )
    }
    default:
      return <Input value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
  }
}

export function RegistrosTable({ censoId, campos }: RegistrosTableProps) {
  const [registros, setRegistros] = useState<RegistroWithValores[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedFieldForValueFilter, setSelectedFieldForValueFilter] = useState<string>("none")
  const [selectedValueFilter, setSelectedValueFilter] = useState<string>("all")
  const [uniqueValues, setUniqueValues] = useState<string[]>([])
  const [loadingUniqueValues, setLoadingUniqueValues] = useState(false)
  const PAGE_SIZE = 25

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editingRegistro, setEditingRegistro] = useState<RegistroWithValores | null>(null)
  const [viewingRegistro, setViewingRegistro] = useState<RegistroWithValores | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string | string[]>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedFieldForValueFilter, selectedValueFilter])

  // Fetch unique values for the secondary filter
  useEffect(() => {
    if (selectedFieldForValueFilter === "none") {
      setUniqueValues([])
      setSelectedValueFilter("all")
      return
    }

    let isMounted = true
    async function fetchUniqueValues() {
      setLoadingUniqueValues(true)
      try {
        const { data: censoRegs } = await supabase
          .from("registros")
          .select("id")
          .eq("censo_id", censoId)

        const regIds = censoRegs?.map(r => r.id) || []
        if (regIds.length === 0) {
          if (isMounted) {
            setUniqueValues([])
            setSelectedValueFilter("all")
          }
          return
        }

        let allValues: string[] = []
        const CHUNK = 500
        for (let i = 0; i < regIds.length; i += CHUNK) {
          const chunk = regIds.slice(i, i + CHUNK)
          const { data: vals } = await supabase
            .from("valores_registro")
            .select("value")
            .eq("campo_id", selectedFieldForValueFilter)
            .in("registro_id", chunk)
          if (vals) {
            allValues = [...allValues, ...vals.map(v => v.value).filter(Boolean)]
          }
        }

        const distinct = Array.from(new Set(allValues))
        if (isMounted) {
          setUniqueValues(distinct.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })))
          setSelectedValueFilter("all")
        }
      } catch (err) {
        console.error("Error fetching unique values:", err)
      } finally {
        if (isMounted) setLoadingUniqueValues(false)
      }
    }

    fetchUniqueValues()
    return () => {
      isMounted = false
    }
  }, [selectedFieldForValueFilter, censoId, supabase])

  useEffect(() => {
    let isMounted = true

    async function fetchRegistros() {
      setLoading(true)
      try {
        const from = (currentPage - 1) * PAGE_SIZE
        const to = from + PAGE_SIZE - 1

        // Get ALL registry IDs for this censo
        const { data: allCensoRegs } = await supabase
          .from("registros")
          .select("id")
          .eq("censo_id", censoId)

        const allCensoRegIds = allCensoRegs?.map((r) => r.id) || []

        // Apply secondary exact value filter if selected
        let valueFilterRegIds = [...allCensoRegIds]
        const isValueFilterActive = selectedFieldForValueFilter !== "none" && selectedValueFilter !== "all"
        if (isValueFilterActive && allCensoRegIds.length > 0) {
          const { data: matchedValFilter } = await supabase
            .from("valores_registro")
            .select("registro_id")
            .eq("campo_id", selectedFieldForValueFilter)
            .eq("value", selectedValueFilter)
          
          const valMatchedIds = matchedValFilter?.map((m) => m.registro_id) || []
          valueFilterRegIds = allCensoRegIds.filter((id) => valMatchedIds.includes(id))
        }

        if (debouncedSearch.trim() !== "") {
          const searchLower = debouncedSearch.toLowerCase()

          // Search in values (using only the subset that matches the value filter if active)
          let valMatchIds: string[] = []
          if (valueFilterRegIds.length > 0) {
            const CHUNK = 500
            for (let i = 0; i < valueFilterRegIds.length; i += CHUNK) {
              const chunk = valueFilterRegIds.slice(i, i + CHUNK)
              const { data: valChunk } = await supabase
                .from("valores_registro")
                .select("registro_id")
                .in("registro_id", chunk)
                .ilike("value", `%${searchLower}%`)
              if (valChunk) {
                valMatchIds = [...valMatchIds, ...valChunk.map((v) => v.registro_id)]
              }
            }
          }

          let idStatusMatchIds: string[] = []
          if (valueFilterRegIds.length > 0) {
            const { data: regMatches } = await supabase
              .from("registros")
              .select("id")
              .eq("censo_id", censoId)
              .or(`id.ilike.%${searchLower}%,status.ilike.%${searchLower}%`)
            const regMatchIds = regMatches?.map((r) => r.id) || []
            idStatusMatchIds = regMatchIds.filter((id) => valueFilterRegIds.includes(id))
          }

          const matchedIds = Array.from(
            new Set([...idStatusMatchIds, ...valMatchIds])
          )

          if (matchedIds.length === 0) {
            if (isMounted) {
              setRegistros([])
              setTotalCount(0)
              setLoading(false)
            }
            return
          }

          if (isMounted) setTotalCount(matchedIds.length)

          const paginatedIds = matchedIds.slice(from, to + 1)
          const { data: paginatedData } = await supabase
            .from("registros")
            .select("*, valores_registro(*)")
            .in("id", paginatedIds)
            .order("created_at", { ascending: false })

          if (isMounted) {
            setRegistros((paginatedData as RegistroWithValores[]) || [])
          }
        } else {
          // No text search, but value filter might be active
          if (isValueFilterActive) {
            if (valueFilterRegIds.length === 0) {
              if (isMounted) {
                setRegistros([])
                setTotalCount(0)
                setLoading(false)
              }
              return
            }

            if (isMounted) setTotalCount(valueFilterRegIds.length)

            const paginatedIds = valueFilterRegIds.slice(from, to + 1)
            const { data: paginatedData } = await supabase
              .from("registros")
              .select("*, valores_registro(*)")
              .in("id", paginatedIds)
              .order("created_at", { ascending: false })

            if (isMounted) {
              setRegistros((paginatedData as RegistroWithValores[]) || [])
            }
          } else {
            // Regular pagination with no search & no value filters
            const { count } = await supabase
              .from("registros")
              .select("*", { count: "exact", head: true })
              .eq("censo_id", censoId)

            if (isMounted) {
              setTotalCount(count || 0)
            }

            const { data } = await supabase
              .from("registros")
              .select("*, valores_registro(*)")
              .eq("censo_id", censoId)
              .order("created_at", { ascending: false })
              .range(from, to)

            if (isMounted) {
              setRegistros((data as RegistroWithValores[]) || [])
            }
          }
        }
      } catch (err) {
        console.error("Error fetching registers:", err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchRegistros()
    return () => {
      isMounted = false
    }
  }, [censoId, currentPage, debouncedSearch, selectedFieldForValueFilter, selectedValueFilter, supabase])

  function openEdit(registro: RegistroWithValores) {
    const valMap: Record<string, string | string[]> = {}
    registro.valores_registro.forEach((v) => {
      if (v.campo_id && v.value) valMap[v.campo_id] = v.value
    })
    setEditValues(valMap)
    setEditingRegistro(registro)
    setSaveError(null)
  }

  async function handleSave() {
    if (!editingRegistro) return
    setSaving(true)
    setSaveError(null)

    const valoresData = campos
      .filter((c) => editValues[c.id] !== undefined)
      .map((c) => ({
        registro_id: editingRegistro.id,
        campo_id: c.id,
        value: Array.isArray(editValues[c.id])
          ? (editValues[c.id] as string[]).join(", ")
          : (editValues[c.id] as string),
      }))

    const { error: delError } = await supabase
      .from("valores_registro")
      .delete()
      .eq("registro_id", editingRegistro.id)

    if (delError) {
      setSaveError(delError.message)
      setSaving(false)
      return
    }

    if (valoresData.length > 0) {
      const { error: insError } = await supabase.from("valores_registro").insert(valoresData)
      if (insError) {
        setSaveError(insError.message)
        setSaving(false)
        return
      }
    }

    const missingRequired = campos
      .filter((c) => c.required)
      .filter((c) => {
        const val = editValues[c.id]
        if (Array.isArray(val)) return val.length === 0
        return !val || (val as string).trim() === ""
      })

    const newStatus = missingRequired.length > 0 ? "incompleto" : "completo"

    await supabase
      .from("registros")
      .update({ status: newStatus })
      .eq("id", editingRegistro.id)

    setRegistros((prev) =>
      prev.map((r) =>
        r.id === editingRegistro.id
          ? {
            ...r,
            status: newStatus,
            valores_registro: valoresData.map((v) => ({
              id: "",
              registro_id: v.registro_id,
              campo_id: v.campo_id,
              value: v.value,
              created_at: new Date().toISOString(),
            })),
          }
          : r
      )
    )

    setSaving(false)
    setEditingRegistro(null)
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteId) return
    await supabase.from("registros").delete().eq("id", deleteId)
    setRegistros((prev) => prev.filter((r) => r.id !== deleteId))
    setTotalCount((c) => Math.max(0, c - 1))
    setDeleteId(null)
    router.refresh()
  }

  if (loading && registros.length === 0) {
    return (
      <div className="text-center py-12 flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Cargando registros...</p>
      </div>
    )
  }

  if (totalCount === 0 && !debouncedSearch) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">No hay registros capturados</p>
        <p className="text-xs text-muted-foreground mt-1">
          Comienza a capturar datos o importa desde un archivo
        </p>
      </div>
    )
  }

  const displayCampos = campos.slice(0, 4)
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const startRecord = totalCount > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const endRecord = Math.min(currentPage * PAGE_SIZE, totalCount)

  const getPageNumbers = () => {
    const pages = []
    const maxVisiblePages = 5
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      let start = Math.max(1, currentPage - 2)
      let end = Math.min(totalPages, currentPage + 2)
      if (currentPage <= 3) {
        start = 1
        end = maxVisiblePages
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - maxVisiblePages + 1
        end = totalPages
      }
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
    }
    return pages
  }

  return (
    <>
      <div className="flex flex-col md:flex-row gap-3 mb-6 p-4 rounded-xl border bg-card text-card-foreground shadow-sm items-end">
        {/* Global Text Search */}
        <div className="flex-1 w-full space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Buscar por texto</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar en todos los campos..."
              className="pl-9 h-9 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Dynamic Value Filter (Double Filter): Campo Selector */}
        <div className="w-full md:w-[220px] space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtrar por campo</span>
          <Select
            value={selectedFieldForValueFilter}
            onValueChange={(v) => setSelectedFieldForValueFilter(v)}
          >
            <SelectTrigger className="w-full h-9 text-xs">
              <SelectValue placeholder="Seleccionar campo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">Ninguno</SelectItem>
              {campos.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dynamic Value Filter (Double Filter): Value Selector */}
        <div className="flex-1 w-full space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor registrado</span>
          <div className="flex gap-2">
            <Select
              value={selectedValueFilter}
              onValueChange={(v) => setSelectedValueFilter(v)}
              disabled={selectedFieldForValueFilter === "none" || loadingUniqueValues}
            >
              <SelectTrigger className="flex-1 h-9 text-xs">
                <SelectValue
                  placeholder={
                    selectedFieldForValueFilter === "none"
                      ? "Seleccione campo primero"
                      : loadingUniqueValues
                      ? "Cargando valores..."
                      : "Seleccione valor..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos los valores</SelectItem>
                {uniqueValues.map((val) => (
                  <SelectItem key={val} value={val} className="text-xs">
                    {val}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear button if any filter is active */}
            {(selectedFieldForValueFilter !== "none" || selectedValueFilter !== "all" || search !== "") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("")
                  setSelectedFieldForValueFilter("none")
                  setSelectedValueFilter("all")
                }}
                className="h-9 px-3 text-xs shrink-0"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="relative rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">ID</TableHead>
              {displayCampos.map((campo) => (
                <TableHead key={campo.id}>{campo.label}</TableHead>
              ))}
              <TableHead className="w-[120px]">Estado</TableHead>
              <TableHead className="w-[120px]">Fecha</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.length === 0 ? (
              <TableRow>
                <TableCell colSpan={displayCampos.length + 4} className="text-center py-12 text-muted-foreground text-xs">
                  No se encontraron registros que coincidan con la búsqueda.
                </TableCell>
              </TableRow>
            ) : (
              registros.map((registro) => {
                const valoresMap = new Map(registro.valores_registro.map((v) => [v.campo_id, v.value]))
                return (
                  <TableRow key={registro.id}>
                    <TableCell className="font-mono text-[11px] text-muted-foreground font-semibold">
                      {registro.id.slice(0, 8)}…
                    </TableCell>
                    {displayCampos.map((campo) => (
                      <TableCell key={campo.id} className="max-w-[150px] truncate text-xs">
                        {valoresMap.get(campo.id) || "-"}
                      </TableCell>
                    ))}
                    <TableCell>
                      <StatusBadge status={registro.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(registro.created_at).toLocaleDateString("es-ES")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Acciones</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingRegistro(registro)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalle
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(registro)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(registro.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Loading Overlay */}
        {loading && registros.length > 0 && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-2 py-2">
          <p className="text-xs text-muted-foreground">
            Mostrando <span className="font-semibold text-foreground">{startRecord}</span> a{" "}
            <span className="font-semibold text-foreground">{endRecord}</span> de{" "}
            <span className="font-semibold text-foreground">{totalCount}</span> registros
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1 || loading}
              className="h-8 px-2 text-xs"
            >
              Anterior
            </Button>

            <div className="flex items-center gap-1">
              {getPageNumbers().map((pageNum) => (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  className="w-8 h-8 p-0 text-xs"
                  onClick={() => setCurrentPage(pageNum)}
                  disabled={loading}
                >
                  {pageNum}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || loading}
              className="h-8 px-2 text-xs"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewingRegistro} onOpenChange={(open) => !open && setViewingRegistro(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del registro</DialogTitle>
            <DialogDescription>
              ID: <span className="font-mono">{viewingRegistro?.id}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {campos.map((campo) => {
              const val = viewingRegistro?.valores_registro.find((v) => v.campo_id === campo.id)?.value
              return (
                <div key={campo.id}>
                  <p className="text-sm font-medium">{campo.label}</p>
                  <p className="text-sm text-muted-foreground">{val || "—"}</p>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingRegistro} onOpenChange={(open) => !open && setEditingRegistro(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar registro</DialogTitle>
            <DialogDescription>Modifica los datos del registro</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
            {campos.map((campo) => (
              <div key={campo.id} className="space-y-2">
                <Label>
                  {campo.label}
                  {campo.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <DynamicField
                  campo={campo}
                  value={editValues[campo.id]}
                  onChange={(v) => setEditValues((prev) => ({ ...prev, [campo.id]: v }))}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRegistro(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el registro y todos sus valores permanentemente.
              Esta acción no se puede deshacer.
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
