"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Plus,
  Trash2,
  Eye,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BookTemplate,
  MoreVertical,
  Pencil,
  Layers,
  Info,
  Globe,
  Lock,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface TemplateField {
  name: string
  label: string
  field_type: string
  required: boolean
  options?: { options: string[] } | null
}

interface DbTemplate {
  id: string
  name: string
  description: string | null
  category: string | null
  icon: string | null
  color: string | null
  campos: TemplateField[]
  is_public: boolean
  created_by: string | null
  created_at: string
}

const CATEGORIES = [
  "Población", "Economía", "Salud", "Educación",
  "Vivienda", "Agricultura", "Ganadería", "Medio ambiente", "Otro",
]

const FIELD_TYPES = [
  { value: "texto", label: "Texto" },
  { value: "numero", label: "Número" },
  { value: "decimal", label: "Decimal" },
  { value: "fecha", label: "Fecha" },
  { value: "booleano", label: "Sí / No" },
  { value: "email", label: "Email" },
  { value: "telefono", label: "Teléfono" },
  { value: "textarea", label: "Texto largo" },
  { value: "seleccion_unica", label: "Selección única" },
  { value: "seleccion_multiple", label: "Selección múltiple" },
  { value: "direccion", label: "Dirección" },
]

const CATEGORY_COLORS: Record<string, string> = {
  "Población": "bg-blue-500/10 text-blue-700 border-blue-200",
  "Economía": "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  "Salud": "bg-red-500/10 text-red-700 border-red-200",
  "Educación": "bg-purple-500/10 text-purple-700 border-purple-200",
  "Vivienda": "bg-amber-500/10 text-amber-700 border-amber-200",
  "Agricultura": "bg-lime-500/10 text-lime-700 border-lime-200",
  "Ganadería": "bg-orange-500/10 text-orange-700 border-orange-200",
  "Medio ambiente": "bg-teal-500/10 text-teal-700 border-teal-200",
}

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50)
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty field factory
// ─────────────────────────────────────────────────────────────────────────────
function newField(): TemplateField {
  return { name: "", label: "", field_type: "texto", required: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function PlantillasPage() {
  const router = useRouter()
  const supabase = createClient()

  const [templates, setTemplates] = useState<DbTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Preview dialog
  const [previewTemplate, setPreviewTemplate] = useState<DbTemplate | null>(null)

  // Create/Edit dialog
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<DbTemplate | null>(null)
  const [formName, setFormName] = useState("")
  const [formDesc, setFormDesc] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formIsPublic, setFormIsPublic] = useState(false)
  const [formFields, setFormFields] = useState<TemplateField[]>([newField()])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Using template
  const [usingTemplateId, setUsingTemplateId] = useState<string | null>(null)

  // ── Load templates
  async function loadTemplates() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from("plantillas_censo")
      .select("*")
      .order("name")
    if (err) setError(err.message)
    else setTemplates((data as DbTemplate[]) || [])
    setLoading(false)
  }

  useEffect(() => { loadTemplates() }, [])

  // ── Filtered
  const filtered = templates.filter(t =>
    !search ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.category || "").toLowerCase().includes(search.toLowerCase())
  )

  // ── Open create form
  function openCreate() {
    setEditingTemplate(null)
    setFormName(""); setFormDesc(""); setFormCategory(""); setFormIsPublic(false)
    setFormFields([newField()])
    setFormError(null)
    setIsFormOpen(true)
  }

  // ── Open edit form
  function openEdit(t: DbTemplate) {
    setEditingTemplate(t)
    setFormName(t.name)
    setFormDesc(t.description || "")
    setFormCategory(t.category || "")
    setFormIsPublic(t.is_public)
    setFormFields(t.campos?.length > 0 ? t.campos : [newField()])
    setFormError(null)
    setIsFormOpen(true)
  }

  // ── Submit form (create or edit)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) { setFormError("El nombre es requerido"); return }
    const validFields = formFields.filter(f => f.label.trim())
    if (validFields.length === 0) { setFormError("Agrega al menos un campo"); return }

    setSubmitting(true)
    setFormError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setFormError("Tu sesión ha expirado")
      setSubmitting(false)
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    const payload = {
      name: formName.trim(),
      description: formDesc.trim() || null,
      category: formCategory || null,
      is_public: formIsPublic,
      organization_id: profile?.organization_id || null,
      campos: validFields.map(f => ({
        ...f,
        name: f.name || toSlug(f.label),
      })),
      created_by: user.id,
    }

    try {
      if (editingTemplate) {
        const { error: err } = await supabase
          .from("plantillas_censo")
          .update(payload)
          .eq("id", editingTemplate.id)
        if (err) throw err
        setSuccessMsg(`Plantilla "${formName}" actualizada`)
      } else {
        const { error: err } = await supabase
          .from("plantillas_censo")
          .insert(payload)
        if (err) throw err
        setSuccessMsg(`Plantilla "${formName}" creada`)
      }

      setIsFormOpen(false)
      loadTemplates()
      setTimeout(() => setSuccessMsg(null), 3500)
    } catch (err: any) {
      setFormError(err.message || "Error al guardar la plantilla")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete
  async function handleDelete(t: DbTemplate) {
    if (!confirm(`¿Eliminar la plantilla "${t.name}"? Esta acción no se puede deshacer.`)) return
    const { error: err } = await supabase.from("plantillas_censo").delete().eq("id", t.id)
    if (err) { setError(err.message); return }
    setTemplates(prev => prev.filter(x => x.id !== t.id))
    setSuccessMsg(`Plantilla "${t.name}" eliminada`)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  // ── Use template → create censo
  async function handleUseTemplate(t: DbTemplate) {
    setUsingTemplateId(t.id)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError("Debes iniciar sesión"); setUsingTemplateId(null); return }

      const { data: profile } = await supabase
        .from("profiles").select("organization_id").eq("id", user.id).single()
      if (!profile?.organization_id) { setError("No se encontró tu organización"); setUsingTemplateId(null); return }

      const { data: censo, error: censoErr } = await supabase
        .from("censos")
        .insert({
          name: `${t.name} - ${new Date().getFullYear()}`,
          description: t.description,
          category: t.category,
          organization_id: profile.organization_id,
          created_by: user.id,
          status: "activo",
        })
        .select().single()

      if (censoErr || !censo) throw new Error(censoErr?.message || "Error al crear el censo")

      const camposData = (t.campos || []).map((campo, idx) => ({
        censo_id: censo.id,
        name: campo.name || toSlug(campo.label),
        label: campo.label,
        field_type: campo.field_type,
        options: campo.options || null,
        required: campo.required || false,
        order_index: idx,
      }))

      if (camposData.length > 0) {
        const { error: camposErr } = await supabase.from("campos_censo").insert(camposData)
        if (camposErr) throw new Error(camposErr.message)
      }

      await supabase.from("auditoria").insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        action: `Creó el censo "${censo.name}" desde la plantilla "${t.name}"`,
        table_name: "censos",
        record_id: censo.id,
      })

      router.push(`/dashboard/censos/${censo.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Error inesperado")
      setUsingTemplateId(null)
    }
  }

  // ── Field management helpers
  function updateField(idx: number, key: keyof TemplateField, value: string | boolean) {
    setFormFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: value } : f))
  }

  function addField() {
    setFormFields(prev => [...prev, newField()])
  }

  function removeField(idx: number) {
    setFormFields(prev => prev.filter((_, i) => i !== idx))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard/censos"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Plantillas de Censo</h1>
          <p className="text-muted-foreground">Crea y reutiliza plantillas con campos predefinidos para acelerar la creación de censos</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva plantilla
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {successMsg && (
        <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800 dark:text-emerald-200">{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar plantillas..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Templates grid */}
      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader><div className="h-5 w-3/4 bg-muted rounded" /></CardHeader>
              <CardContent><div className="h-12 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Layers className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="font-semibold text-muted-foreground">
              {search ? "No se encontraron plantillas" : "Aún no hay plantillas"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Intenta con otro término de búsqueda." : "Crea tu primera plantilla para reutilizarla en censos futuros."}
            </p>
            {!search && (
              <Button className="mt-4" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Crear primera plantilla
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(t => (
            <Card key={t.id} className="flex flex-col hover:shadow-lg hover:border-primary/30 transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {t.category && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[t.category] || "bg-muted text-muted-foreground"}`}>
                          {t.category}
                        </span>
                      )}
                      {t.is_public ? (
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" aria-label="Plantilla pública" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Plantilla privada" />
                      )}
                    </div>
                    <CardTitle className="text-base leading-tight">{t.name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 -mr-1">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setPreviewTemplate(t)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Vista previa
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(t)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(t)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="flex-1 pb-3">
                {t.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{t.description}</p>
                )}
                <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t.campos?.length || 0} campos predefinidos</span>
                  <span>{new Date(t.created_at).toLocaleDateString("es-ES")}</span>
                </div>
              </CardContent>

              <CardFooter className="flex gap-2 border-t bg-muted/30 rounded-b-lg p-3">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setPreviewTemplate(t)}>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Ver campos
                </Button>
                <Button size="sm" className="flex-1" onClick={() => handleUseTemplate(t)} disabled={usingTemplateId !== null}>
                  {usingTemplateId === t.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Usar plantilla
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* ── Preview Dialog ── */}
      <Dialog open={!!previewTemplate} onOpenChange={open => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {previewTemplate && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <BookTemplate className="h-5 w-5 text-muted-foreground" />
                  {previewTemplate.category && (
                    <Badge variant="secondary">{previewTemplate.category}</Badge>
                  )}
                </div>
                <DialogTitle>{previewTemplate.name}</DialogTitle>
                {previewTemplate.description && (
                  <DialogDescription>{previewTemplate.description}</DialogDescription>
                )}
              </DialogHeader>
              <div className="py-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {previewTemplate.campos?.length || 0} Campos del formulario
                </p>
                {(previewTemplate.campos || []).map((campo, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 text-sm">
                    <div>
                      <span className="font-medium">{campo.label}</span>
                      {campo.required && (
                        <span className="ml-1.5 text-[10px] text-destructive font-semibold uppercase">Req.</span>
                      )}
                      <div className="text-xs text-muted-foreground font-mono">{campo.name}</div>
                    </div>
                    <Badge variant="outline" className="text-xs">{campo.field_type.replace("_", " ")}</Badge>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewTemplate(null)}>Cerrar</Button>
                <Button onClick={() => { setPreviewTemplate(null); handleUseTemplate(previewTemplate) }} disabled={usingTemplateId !== null}>
                  {usingTemplateId === previewTemplate.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Usar plantilla
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={isFormOpen} onOpenChange={open => { setIsFormOpen(open); if (!open) setFormError(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar plantilla" : "Crear nueva plantilla"}</DialogTitle>
            <DialogDescription>
              Define los campos que tendrá cualquier censo creado con esta plantilla
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 py-2">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Nombre de la plantilla *</Label>
              <Input id="tpl-name" placeholder="Ej: Censo de Vivienda Municipal" value={formName} onChange={e => setFormName(e.target.value)} disabled={submitting} />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">Descripción</Label>
              <Textarea id="tpl-desc" placeholder="Describe el propósito de esta plantilla..." value={formDesc} onChange={e => setFormDesc(e.target.value)} disabled={submitting} rows={2} />
            </div>

            {/* Categoría + visibilidad */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tpl-cat">Categoría</Label>
                <Select value={formCategory} onValueChange={setFormCategory} disabled={submitting}>
                  <SelectTrigger id="tpl-cat"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Visibilidad</Label>
                <div className="flex gap-2 pt-1">
                  <Button type="button" size="sm" variant={formIsPublic ? "default" : "outline"} onClick={() => setFormIsPublic(true)} disabled={submitting} className="flex-1">
                    <Globe className="mr-1.5 h-3.5 w-3.5" />
                    Pública
                  </Button>
                  <Button type="button" size="sm" variant={!formIsPublic ? "default" : "outline"} onClick={() => setFormIsPublic(false)} disabled={submitting} className="flex-1">
                    <Lock className="mr-1.5 h-3.5 w-3.5" />
                    Privada
                  </Button>
                </div>
              </div>
            </div>

            {/* Campos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Campos ({formFields.filter(f => f.label.trim()).length})</Label>
                <Button type="button" variant="outline" size="sm" onClick={addField} disabled={submitting}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Agregar campo
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {formFields.map((field, idx) => (
                  <div key={idx} className="flex flex-col gap-2 p-2.5 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <Input
                          placeholder="Nombre del campo (ej: Nombre completo)"
                          value={field.label}
                          onChange={e => {
                            updateField(idx, "label", e.target.value)
                            updateField(idx, "name", toSlug(e.target.value))
                          }}
                          disabled={submitting}
                          className="h-8 text-sm mb-1"
                        />
                        <p className="text-xs text-muted-foreground font-mono pl-1">
                          id: {field.name || toSlug(field.label) || "…"}
                        </p>
                      </div>
                      <Select value={field.field_type} onValueChange={v => updateField(idx, "field_type", v)} disabled={submitting}>
                        <SelectTrigger className="w-36 h-8 text-xs flex-shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map(ft => (
                            <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeField(idx)}
                        disabled={submitting || formFields.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {["seleccion_unica", "seleccion_multiple"].includes(field.field_type) && (
                      <div className="pt-1">
                        <Textarea
                          placeholder={"Opciones (una por línea)\nOpcion 1\nOpcion 2"}
                          value={field.options?.options?.join("\n") || ""}
                          onChange={e => {
                            const optionsList = e.target.value.split("\n").filter(Boolean).map(s => s.trim());
                            updateField(idx, "options", { options: optionsList } as any)
                          }}
                          disabled={submitting}
                          rows={2}
                          className="text-xs h-16"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={submitting}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingTemplate ? "Guardar cambios" : "Crear plantilla"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
