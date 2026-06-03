"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowLeft, Plus, GripVertical, Trash2, Loader2, Type, Hash, Calendar, ToggleLeft, List, Mail, Phone, MapPin, AlignLeft } from "lucide-react"
import type { CampoCenso, FieldType } from "@/lib/types"

const fieldTypes: { value: FieldType; label: string; icon: typeof Type; description: string }[] = [
  { value: "texto", label: "Texto", icon: Type, description: "Texto corto de una línea" },
  { value: "textarea", label: "Texto largo", icon: AlignLeft, description: "Texto de múltiples líneas" },
  { value: "numero", label: "Número entero", icon: Hash, description: "Números sin decimales" },
  { value: "decimal", label: "Número decimal", icon: Hash, description: "Números con decimales" },
  { value: "fecha", label: "Fecha", icon: Calendar, description: "Selector de fecha" },
  { value: "booleano", label: "Sí/No", icon: ToggleLeft, description: "Respuesta binaria" },
  { value: "seleccion_unica", label: "Selección única", icon: List, description: "Una opción de varias" },
  { value: "seleccion_multiple", label: "Selección múltiple", icon: List, description: "Varias opciones" },
  { value: "email", label: "Correo electrónico", icon: Mail, description: "Dirección de email" },
  { value: "telefono", label: "Teléfono", icon: Phone, description: "Número telefónico" },
  { value: "direccion", label: "Dirección", icon: MapPin, description: "Dirección postal" },
]

interface ConfigurarCamposClientProps {
  censoId: string
  censoName: string
  initialCampos: CampoCenso[]
}

// Sortable item component
function SortableCampoItem({
  campo,
  onEdit,
  onDelete,
}: {
  campo: CampoCenso
  onEdit: (campo: CampoCenso) => void
  onDelete: (campoId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: campo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const fieldTypeInfo = fieldTypes.find((t) => t.value === campo.field_type)
  const Icon = fieldTypeInfo?.icon || Type

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        aria-label="Arrastra para reordenar"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{campo.label}</p>
        <p className="text-sm text-muted-foreground">
          {fieldTypeInfo?.label} {campo.required && "• Requerido"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => onEdit(campo)}>
          Editar
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(campo.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function ConfigurarCamposClient({ censoId, censoName, initialCampos }: ConfigurarCamposClientProps) {
  const [campos, setCampos] = useState<CampoCenso[]>(initialCampos)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCampo, setEditingCampo] = useState<CampoCenso | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Form state
  const [fieldName, setFieldName] = useState("")
  const [fieldLabel, setFieldLabel] = useState("")
  const [fieldType, setFieldType] = useState<FieldType>("texto")
  const [fieldRequired, setFieldRequired] = useState(false)
  const [fieldDefault, setFieldDefault] = useState("")
  const [fieldOptions, setFieldOptions] = useState("")

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function resetForm() {
    setFieldName("")
    setFieldLabel("")
    setFieldType("texto")
    setFieldRequired(false)
    setFieldDefault("")
    setFieldOptions("")
    setEditingCampo(null)
    setError(null)
  }

  function openEditDialog(campo: CampoCenso) {
    setEditingCampo(campo)
    setFieldName(campo.name)
    setFieldLabel(campo.label)
    setFieldType(campo.field_type)
    setFieldRequired(campo.required)
    setFieldDefault(campo.default_value || "")
    setFieldOptions((campo.options as { options?: string[] })?.options?.join("\n") || "")
    setDialogOpen(true)
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    if (!fieldLabel.trim()) {
      setError("La etiqueta del campo es requerida")
      setLoading(false)
      return
    }

    const name =
      fieldName.trim() ||
      fieldLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")

    const campoData = {
      censo_id: censoId,
      name,
      label: fieldLabel.trim(),
      field_type: fieldType,
      required: fieldRequired,
      default_value: fieldDefault.trim() || null,
      options:
        ["seleccion_unica", "seleccion_multiple"].includes(fieldType) && fieldOptions.trim()
          ? { options: fieldOptions.split("\n").filter(Boolean).map((o) => o.trim()) }
          : null,
      order_index: editingCampo ? editingCampo.order_index : campos.length,
    }

    if (editingCampo) {
      const { error: updateError } = await supabase
        .from("campos_censo")
        .update(campoData)
        .eq("id", editingCampo.id)

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      setCampos(campos.map((c) => (c.id === editingCampo.id ? { ...c, ...campoData } : c)))
    } else {
      const { data, error: insertError } = await supabase
        .from("campos_censo")
        .insert(campoData)
        .select()
        .single()

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }

      setCampos([...campos, data])
    }

    setLoading(false)
    setDialogOpen(false)
    resetForm()
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteId) return
    const { error } = await supabase.from("campos_censo").delete().eq("id", deleteId)
    if (!error) {
      setCampos(campos.filter((c) => c.id !== deleteId))
      router.refresh()
    }
    setDeleteId(null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = campos.findIndex((c) => c.id === active.id)
    const newIndex = campos.findIndex((c) => c.id === over.id)
    const reordered = arrayMove(campos, oldIndex, newIndex).map((c, i) => ({
      ...c,
      order_index: i,
    }))

    setCampos(reordered)

    // Persist new order to DB
    await Promise.all(
      reordered.map((c) =>
        supabase.from("campos_censo").update({ order_index: c.order_index }).eq("id", c.id)
      )
    )
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/dashboard/censos/${censoId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Configurar campos</h1>
          <p className="text-muted-foreground">{censoName}</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Agregar campo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingCampo ? "Editar campo" : "Nuevo campo"}</DialogTitle>
              <DialogDescription>Define las propiedades del campo</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="fieldLabel">Etiqueta *</Label>
                <Input
                  id="fieldLabel"
                  placeholder="Ej: Nombre completo"
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fieldName">Nombre interno</Label>
                <Input
                  id="fieldName"
                  placeholder="Se genera automáticamente"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Identificador único para exportaciones y API
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tipo de campo</Label>
                <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {["seleccion_unica", "seleccion_multiple"].includes(fieldType) && (
                <div className="space-y-2">
                  <Label htmlFor="fieldOptions">Opciones (una por línea)</Label>
                  <textarea
                    id="fieldOptions"
                    className="w-full min-h-[100px] px-3 py-2 border rounded-md bg-background text-sm"
                    placeholder={"Opción 1\nOpción 2\nOpción 3"}
                    value={fieldOptions}
                    onChange={(e) => setFieldOptions(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="fieldDefault">Valor por defecto</Label>
                <Input
                  id="fieldDefault"
                  placeholder="Opcional"
                  value={fieldDefault}
                  onChange={(e) => setFieldDefault(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="fieldRequired">Campo requerido</Label>
                  <p className="text-xs text-muted-foreground">
                    El usuario debe completar este campo
                  </p>
                </div>
                <Switch
                  id="fieldRequired"
                  checked={fieldRequired}
                  onCheckedChange={setFieldRequired}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingCampo ? "Guardar cambios" : "Agregar campo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campos del censo</CardTitle>
          <CardDescription>
            Arrastra los campos para reordenarlos. El orden se guarda automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-2">No hay campos configurados</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar primer campo
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={campos.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {campos.map((campo) => (
                    <SortableCampoItem
                      key={campo.id}
                      campo={campo}
                      onEdit={openEditDialog}
                      onDelete={(id) => setDeleteId(id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar campo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el campo y todos los datos capturados en él.
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
    </div>
  )
}
