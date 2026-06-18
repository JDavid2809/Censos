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
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editingRegistro, setEditingRegistro] = useState<RegistroWithValores | null>(null)
  const [viewingRegistro, setViewingRegistro] = useState<RegistroWithValores | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string | string[]>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    async function fetchRegistros() {
      const { data } = await supabase
        .from("registros")
        .select("*, valores_registro(*)")
        .eq("censo_id", censoId)
        .order("created_at", { ascending: false })
        .limit(100)

      setRegistros(data || [])
      setLoading(false)
    }
    fetchRegistros()
  }, [censoId, supabase])

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

    // Upsert all field values
    const valoresData = campos
      .filter((c) => editValues[c.id] !== undefined)
      .map((c) => ({
        registro_id: editingRegistro.id,
        campo_id: c.id,
        value: Array.isArray(editValues[c.id])
          ? (editValues[c.id] as string[]).join(", ")
          : (editValues[c.id] as string),
      }))

    // Delete existing values then reinsert (simple upsert)
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

    // Check required fields to update status
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

    // Update local state
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
    setDeleteId(null)
    router.refresh()
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cargando registros...</p>
      </div>
    )
  }

  if (registros.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No hay registros capturados</p>
        <p className="text-sm text-muted-foreground">
          Comienza a capturar datos o importa desde un archivo
        </p>
      </div>
    )
  }

  const displayCampos = campos.slice(0, 4)

  const filteredRegistros = registros.filter((registro) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    const matchId = registro.id.toLowerCase().includes(searchLower)
    const matchStatus = registro.status.toLowerCase().includes(searchLower)
    const matchValues = registro.valores_registro.some((v) =>
      v.value?.toLowerCase().includes(searchLower)
    )
    return matchId || matchStatus || matchValues
  })

  return (
    <>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por ID, estado o cualquier campo..."
          className="pl-9 h-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            {displayCampos.map((campo) => (
              <TableHead key={campo.id}>{campo.label}</TableHead>
            ))}
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRegistros.length === 0 ? (
            <TableRow>
              <TableCell colSpan={displayCampos.length + 3} className="text-center py-8 text-muted-foreground text-sm">
                No se encontraron registros que coincidan con la búsqueda.
              </TableCell>
            </TableRow>
          ) : (
            filteredRegistros.map((registro) => {
              const valoresMap = new Map(registro.valores_registro.map((v) => [v.campo_id, v.value]))
              return (
                <TableRow key={registro.id}>
                  <TableCell className="font-mono text-xs">
                    {registro.id.slice(0, 8)}…
                  </TableCell>
                  {displayCampos.map((campo) => (
                    <TableCell key={campo.id} className="max-w-[150px] truncate">
                      {valoresMap.get(campo.id) || "-"}
                    </TableCell>
                  ))}
                  <TableCell>
                    <StatusBadge status={registro.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(registro.created_at).toLocaleDateString("es-ES")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
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
