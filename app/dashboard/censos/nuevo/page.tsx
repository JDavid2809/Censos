"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Plus,
  FileSpreadsheet,
  FileCode2,
  Database,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  BookTemplate,
  Layers,
  Eye,
  EyeOff,
  Table2,
  RefreshCw,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type CreationMode = "scratch" | "excel" | "xml" | "sql" | "template"
type WizardStep = "mode" | "file" | "preview" | "config" | "importing"

interface DetectedField {
  colKey: string          // original column key from the file
  name: string            // slug for DB
  label: string           // human readable label
  field_type: string
  sample_values: string[]
  included: boolean       // whether the user wants to include this column
}

interface DbTemplate {
  id: string
  name: string
  description: string | null
  category: string | null
  campos: { name: string; label: string; field_type: string; required: boolean }[]
  is_public: boolean
  created_at: string
}

type SheetRow = Record<string, string | number | boolean | null>

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
]

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50) || "campo"
}

/** Infer field type from sample string values */
function inferFieldType(values: string[]): string {
  const nonEmpty = values.filter(v => v !== "" && v !== null && v !== undefined)
  if (nonEmpty.length === 0) return "texto"
  const s = nonEmpty.slice(0, 15)
  if (s.every(v => /^(true|false|sí|si|no|1|0)$/i.test(v.trim()))) return "booleano"
  if (s.every(v => /^[\w.+-]+@[\w-]+\.[a-z]{2,}$/i.test(v.trim()))) return "email"
  if (s.every(v => !isNaN(Number(v)) && v.trim() !== "" && v.includes("."))) return "decimal"
  if (s.every(v => /^\d+$/.test(v.trim()))) return "numero"
  if (s.every(v => /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(v.trim()))) return "fecha"
  if (s.some(v => v.length > 100)) return "textarea"
  return "texto"
}

/**
 * Read XLSX/CSV and return clean rows + columns.
 * - Skips columns with empty or __EMPTY headers (like Excel's blank column A)
 * - Normalizes all cell values to strings
 */
function readExcelFile(buffer: ArrayBuffer): { rows: SheetRow[]; columns: string[] } {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]

  // Get raw JSON — defval:"" fills empty cells
  const rawRows = XLSX.utils.sheet_to_json<SheetRow>(ws, {
    defval: "",
    raw: false,    // convert everything to strings (dates, numbers)
    dateNF: "YYYY-MM-DD",
  })

  if (rawRows.length === 0) return { rows: [], columns: [] }

  // Filter out columns with empty or auto-generated (__EMPTY*) headers
  const allCols = Object.keys(rawRows[0])
  const validCols = allCols.filter(col => {
    const trimmed = String(col).trim()
    return (
      trimmed !== "" &&
      !trimmed.startsWith("__EMPTY") &&
      trimmed !== "__rowNum__"
    )
  })

  // Rebuild rows keeping only valid columns
  const cleanRows: SheetRow[] = rawRows.map(row => {
    const clean: SheetRow = {}
    validCols.forEach(col => { clean[col] = row[col] ?? "" })
    return clean
  })

  return { rows: cleanRows, columns: validCols }
}

/** Parse XML to rows and columns */
function readXmlFile(xmlText: string): { rows: SheetRow[]; columns: string[] } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, "text/xml")
  if (doc.querySelector("parsererror")) throw new Error("Archivo XML inválido o mal formado")

  const root = doc.documentElement
  let records: Element[] = []
  const children = Array.from(root.children)
  if (children.length > 0) {
    const firstTag = children[0].tagName
    const sameTag = children.filter(c => c.tagName === firstTag)
    records = sameTag.length > 1 ? sameTag : Array.from(children[0]?.children || [])
  }
  if (records.length === 0) throw new Error("No se encontraron registros en el XML. Verifica la estructura del archivo.")

  const colSet = new Set<string>()
  records.forEach(rec => Array.from(rec.children).forEach(el => colSet.add(el.tagName)))
  const columns = Array.from(colSet)

  const rows: SheetRow[] = records.map(rec => {
    const row: SheetRow = {}
    columns.forEach(col => {
      const el = rec.querySelector(col)
      row[col] = el ? (el.textContent?.trim() ?? "") : ""
    })
    return row
  })
  return { rows, columns }
}

/** Parse SQL CREATE TABLE → tables map */
function readSqlFile(sql: string): Record<string, string[]> {
  const tables: Record<string, string[]> = {}
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[\w.]+"?\.)?"?([\w]+)"?\s*\(([\s\S]+?)\)(?:\s*;|\s*$)/gi
  let match
  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1]
    const block = match[2]
    const cols: string[] = []
    for (const line of block.split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("--")) continue
      if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|INDEX)/i.test(t)) continue
      const col = t.match(/^"?([\w]+)"?\s+\S/i)
      if (col) cols.push(col[1])
    }
    if (cols.length > 0) tables[tableName] = cols
  }
  return tables
}

/** Build DetectedField[] from column names and row data */
function buildDetectedFields(columns: string[], rows: SheetRow[]): DetectedField[] {
  return columns.map(col => {
    const samples = rows.slice(0, 20).map(r => String(r[col] ?? "")).filter(Boolean)
    return {
      colKey: col,
      name: toSlug(col),
      label: col,
      field_type: inferFieldType(samples),
      sample_values: samples.slice(0, 4),
      included: true,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function NuevoCensoPage() {
  const router = useRouter()
  const supabase = createClient()

  // Wizard state
  const [mode, setMode] = useState<CreationMode | null>(null)
  const [step, setStep] = useState<WizardStep>("mode")

  // Census metadata
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([])
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([])

  // SQL specific
  const [sqlTables, setSqlTables] = useState<Record<string, string[]>>({})
  const [selectedSqlTable, setSelectedSqlTable] = useState("")

  // Templates
  const [templates, setTemplates] = useState<DbTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<DbTemplate | null>(null)

  // Progress
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Included fields (derived)
  const includedFields = detectedFields.filter(f => f.included)

  // Load templates from DB
  useEffect(() => {
    if (mode === "template") {
      setLoadingTemplates(true)
      supabase
        .from("plantillas_censo")
        .select("*")
        .order("name")
        .then(({ data }) => {
          setTemplates((data as DbTemplate[]) || [])
          setLoadingTemplates(false)
        })
    }
  }, [mode])

  // ── File handlers ────────────────────────────────────────────────────────

  async function handleExcelFile(f: File) {
    setError(null)
    setImportFile(f)
    try {
      const buffer = await f.arrayBuffer()
      const { rows, columns } = readExcelFile(buffer)

      if (rows.length === 0 || columns.length === 0) {
        setError("El archivo no contiene datos o no tiene encabezados válidos en la primera fila.")
        return
      }

      setSheetRows(rows)
      setDetectedFields(buildDetectedFields(columns, rows))
      if (!name) setName(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim())
      setStep("preview")
    } catch (e: any) {
      setError("Error al leer el archivo: " + (e.message || "formato inválido"))
    }
  }

  async function handleXmlFile(f: File) {
    setError(null)
    setImportFile(f)
    try {
      const text = await f.text()
      const { rows, columns } = readXmlFile(text)
      setSheetRows(rows)
      setDetectedFields(buildDetectedFields(columns, rows))
      if (!name) setName(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim())
      setStep("preview")
    } catch (e: any) {
      setError(e.message || "Error al leer el archivo XML")
    }
  }

  async function handleSqlFile(f: File) {
    setError(null)
    setImportFile(f)
    try {
      const text = await f.text()
      const tables = readSqlFile(text)
      if (Object.keys(tables).length === 0) {
        setError("No se encontraron sentencias CREATE TABLE en el archivo SQL.")
        return
      }
      setSqlTables(tables)
      const first = Object.keys(tables)[0]
      setSelectedSqlTable(first)
      setSheetRows([])
      setDetectedFields(tables[first].map(col => ({
        colKey: col, name: toSlug(col), label: col, field_type: "texto", sample_values: [], included: true,
      })))
      setStep("preview")
    } catch (e: any) {
      setError(e.message || "Error al leer el archivo SQL")
    }
  }

  function handleSqlTableSwitch(tableName: string) {
    setSelectedSqlTable(tableName)
    setDetectedFields(sqlTables[tableName].map(col => ({
      colKey: col, name: toSlug(col), label: col, field_type: "texto", sample_values: [], included: true,
    })))
  }

  function handleTemplateSelect(t: DbTemplate) {
    setSelectedTemplate(t)
    setDetectedFields(t.campos.map(c => ({
      colKey: c.name, name: c.name, label: c.label, field_type: c.field_type,
      sample_values: [], included: true,
    })))
    if (!name) setName(t.name)
    if (!description) setDescription(t.description || "")
    if (!category) setCategory(t.category || "")
  }

  // ── Field editing helpers ─────────────────────────────────────────────────

  function toggleField(idx: number) {
    setDetectedFields(prev => prev.map((f, i) => i === idx ? { ...f, included: !f.included } : f))
  }

  function updateField(idx: number, key: keyof DetectedField, value: string) {
    setDetectedFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: value } : f))
  }

  function addManualField() {
    setDetectedFields(prev => [...prev, {
      colKey: `campo_${prev.length + 1}`, name: `campo_${prev.length + 1}`,
      label: `Campo ${prev.length + 1}`, field_type: "texto", sample_values: [], included: true,
    }])
  }

  function removeField(idx: number) {
    setDetectedFields(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Create census ─────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!name.trim()) { setError("El nombre del censo es requerido"); return }

    const fields = detectedFields.filter(f => f.included && f.label.trim())
    if (fields.length === 0 && mode !== "scratch") {
      setError("Selecciona al menos un campo para incluir")
      return
    }

    setLoading(true)
    setProgress(5)
    setError(null)
    setStep("importing")

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Tu sesión expiró. Por favor inicia sesión de nuevo.")

      const { data: profile } = await supabase
        .from("profiles").select("organization_id").eq("id", user.id).single()
      if (!profile?.organization_id) throw new Error("No se encontró tu organización.")

      // 1. Create censo
      setProgressLabel("Creando censo...")
      setProgress(10)

      const { data: censo, error: censoErr } = await supabase
        .from("censos")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          category: category || null,
          organization_id: profile.organization_id,
          created_by: user.id,
          status: "activo",
        })
        .select().single()

      if (censoErr || !censo) throw new Error(censoErr?.message || "Error al crear el censo")
      setProgress(25)

      // 2. Create campos
      let camposInserted: { id: string; name: string }[] = []
      if (fields.length > 0) {
        setProgressLabel(`Creando ${fields.length} campo(s)...`)

        const camposData = fields.map((f, idx) => ({
          censo_id: censo.id,
          name: f.name || toSlug(f.label),
          label: f.label,
          field_type: f.field_type,
          required: false,
          order_index: idx,
        }))

        const { data: inserted, error: camposErr } = await supabase
          .from("campos_censo").insert(camposData).select("id, name")

        if (camposErr) throw new Error("Error al crear campos: " + camposErr.message)
        camposInserted = inserted || []
        setProgress(45)
      }

      // 3. Import rows (Excel / XML only)
      if (sheetRows.length > 0 && camposInserted.length > 0) {
        setProgressLabel(`Importando ${sheetRows.length} registros...`)

        // Map: original column key → campo DB id
        const colToId: Record<string, string> = {}
        fields.forEach((f, idx) => {
          if (camposInserted[idx]) {
            colToId[f.colKey] = camposInserted[idx].id
            colToId[f.label] = camposInserted[idx].id   // also map by label
          }
        })

        // Batch insert registros
        const { data: registros, error: regErr } = await supabase
          .from("registros")
          .insert(sheetRows.map(() => ({ censo_id: censo.id, status: "completo" as const, created_by: user.id })))
          .select("id")

        if (regErr) throw new Error("Error al importar registros: " + regErr.message)
        setProgress(65)

        // Build valores
        const allValores: { registro_id: string; campo_id: string; value: string }[] = []
        registros.forEach((reg, i) => {
          const row = sheetRows[i]
          Object.entries(row).forEach(([colKey, val]) => {
            const campoId = colToId[colKey]
            if (campoId) {
              const strVal = String(val ?? "").trim()
              if (strVal !== "") allValores.push({ registro_id: reg.id, campo_id: campoId, value: strVal })
            }
          })
        })

        // Insert values in chunks
        const CHUNK = 500
        for (let i = 0; i < allValores.length; i += CHUNK) {
          const { error: vErr } = await supabase.from("valores_registro").insert(allValores.slice(i, i + CHUNK))
          if (vErr) throw new Error("Error al guardar valores: " + vErr.message)
          setProgress(65 + Math.round(((i + CHUNK) / Math.max(allValores.length, 1)) * 30))
        }

        setProgressLabel("¡Importación completada!")
      }

      setProgress(100)
      setProgressLabel("¡Censo creado con éxito!")
      await new Promise(r => setTimeout(r, 800))
      router.push(`/dashboard/censos/${censo.id}`)
      router.refresh()
    } catch (e: any) {
      setError(e.message || "Ocurrió un error inesperado")
      setLoading(false)
      setStep(mode === "scratch" ? "config" : "preview")
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Mode selector
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "mode") {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/dashboard/censos"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Crear nuevo censo</h1>
            <p className="text-muted-foreground">Elige cómo quieres iniciar tu censo</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              mode: "scratch" as const,
              title: "Desde cero",
              desc: "Define manualmente nombre y campos del censo",
              icon: Plus,
              color: "primary",
              badge: null,
            },
            {
              mode: "excel" as const,
              title: "Importar Excel / CSV",
              desc: "Detecta columnas automáticamente e importa todos los datos del archivo",
              icon: FileSpreadsheet,
              color: "emerald",
              badge: "Detecta campos + datos",
            },
            {
              mode: "xml" as const,
              title: "Importar XML",
              desc: "Analiza la estructura XML y genera campos con sus registros automáticamente",
              icon: FileCode2,
              color: "blue",
              badge: "Detecta campos + datos",
            },
            {
              mode: "sql" as const,
              title: "Esquema PostgreSQL",
              desc: "Sube un .sql y extrae las columnas de las tablas como campos del censo",
              icon: Database,
              color: "indigo",
              badge: "Solo estructura",
            },
            {
              mode: "template" as const,
              title: "Desde plantilla",
              desc: "Usa una plantilla guardada en tu organización con campos predefinidos",
              icon: BookTemplate,
              color: "violet",
              badge: null,
            },
          ].map(opt => {
            const Icon = opt.icon
            const borderColor: Record<string, string> = {
              primary: "hover:border-primary/60",
              emerald: "hover:border-emerald-500/60",
              blue: "hover:border-blue-500/60",
              indigo: "hover:border-indigo-500/60",
              violet: "hover:border-violet-500/60",
            }
            const iconBg: Record<string, string> = {
              primary: "bg-primary/10 group-hover:bg-primary/20",
              emerald: "bg-emerald-500/10 group-hover:bg-emerald-500/20",
              blue: "bg-blue-500/10 group-hover:bg-blue-500/20",
              indigo: "bg-indigo-500/10 group-hover:bg-indigo-500/20",
              violet: "bg-violet-500/10 group-hover:bg-violet-500/20",
            }
            const iconColor: Record<string, string> = {
              primary: "text-primary",
              emerald: "text-emerald-600",
              blue: "text-blue-600",
              indigo: "text-indigo-600",
              violet: "text-violet-600",
            }
            return (
              <Card
                key={opt.mode}
                className={`cursor-pointer ${borderColor[opt.color]} hover:shadow-md transition-all duration-200 group`}
                onClick={() => {
                  setMode(opt.mode)
                  setStep(opt.mode === "scratch" ? "config" : "file")
                  setError(null)
                }}
              >
                <CardContent className="flex flex-col items-center text-center pt-8 pb-6 gap-3">
                  <div className={`w-14 h-14 rounded-2xl ${iconBg[opt.color]} flex items-center justify-center transition-colors`}>
                    <Icon className={`h-7 w-7 ${iconColor[opt.color]}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">{opt.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.desc}</p>
                  </div>
                  {opt.badge && <Badge variant="secondary" className="text-xs">{opt.badge}</Badge>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 (scratch): Basic config form
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "config" && mode === "scratch") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setStep("mode"); setMode(null) }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Crear censo desde cero</h1>
        </div>

        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

        <Card>
          <CardHeader><CardTitle>Información básica</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name-s">Nombre del censo *</Label>
              <Input id="name-s" placeholder="Ej: Censo de población 2025" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc-s">Descripción</Label>
              <Textarea id="desc-s" placeholder="Describe el propósito del censo..." value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-s">Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="cat-s"><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear censo
          </Button>
          <Button variant="outline" onClick={() => { setStep("mode"); setMode(null) }}>Cancelar</Button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 (import modes): File upload step
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "file") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setStep("mode"); setMode(null); setImportFile(null) }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "excel" && "Importar desde Excel / CSV"}
            {mode === "xml" && "Importar desde XML"}
            {mode === "sql" && "Esquema PostgreSQL (.sql)"}
            {mode === "template" && "Seleccionar plantilla"}
          </h1>
        </div>

        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

        {/* ── Excel / CSV ── */}
        {mode === "excel" && (
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar archivo</CardTitle>
              <CardDescription>Soporta .xlsx, .xls y .csv con encabezados en la primera fila</CardDescription>
            </CardHeader>
            <CardContent>
              <label htmlFor="excel-upload" className="cursor-pointer block">
                <div className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20`}>
                  <FileSpreadsheet className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                  <p className="font-medium">Haz clic para seleccionar un archivo</p>
                  <p className="text-sm text-muted-foreground mt-1">.xlsx, .xls, .csv</p>
                </div>
                <input id="excel-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleExcelFile(f) }} />
              </label>
            </CardContent>
          </Card>
        )}

        {/* ── XML ── */}
        {mode === "xml" && (
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar archivo XML</CardTitle>
              <CardDescription>Se analizará la estructura automáticamente para detectar campos y datos</CardDescription>
            </CardHeader>
            <CardContent>
              <label htmlFor="xml-upload" className="cursor-pointer block">
                <div className="border-2 border-dashed rounded-xl p-12 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20">
                  <FileCode2 className="h-10 w-10 text-blue-500 mx-auto mb-3" />
                  <p className="font-medium">Haz clic para seleccionar un archivo</p>
                  <p className="text-sm text-muted-foreground mt-1">.xml</p>
                </div>
                <input id="xml-upload" type="file" accept=".xml" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleXmlFile(f) }} />
              </label>
            </CardContent>
          </Card>
        )}

        {/* ── SQL ── */}
        {mode === "sql" && (
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar archivo SQL</CardTitle>
              <CardDescription>Debe contener sentencias CREATE TABLE de PostgreSQL</CardDescription>
            </CardHeader>
            <CardContent>
              <label htmlFor="sql-upload" className="cursor-pointer block">
                <div className="border-2 border-dashed rounded-xl p-12 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20">
                  <Database className="h-10 w-10 text-indigo-500 mx-auto mb-3" />
                  <p className="font-medium">Haz clic para seleccionar un archivo</p>
                  <p className="text-sm text-muted-foreground mt-1">.sql, .txt</p>
                </div>
                <input id="sql-upload" type="file" accept=".sql,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleSqlFile(f) }} />
              </label>
            </CardContent>
          </Card>
        )}

        {/* ── Template ── */}
        {mode === "template" && (
          <Card>
            <CardHeader>
              <CardTitle>Plantillas disponibles</CardTitle>
              <CardDescription>Plantillas guardadas en tu organización</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTemplates ? (
                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando plantillas...
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No hay plantillas guardadas.</p>
                  <Link href="/dashboard/censos/plantillas" className="text-primary text-sm underline mt-1 block">
                    Crear una plantilla →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map(t => (
                    <button key={t.id} type="button" onClick={() => handleTemplateSelect(t)}
                      className={`flex items-center gap-3 w-full p-3 rounded-lg border text-left transition-colors ${selectedTemplate?.id === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                      <BookTemplate className={`h-5 w-5 flex-shrink-0 ${selectedTemplate?.id === t.id ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.campos?.length || 0} campos · {t.category || "Sin categoría"}</p>
                      </div>
                      {selectedTemplate?.id === t.id && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
            {selectedTemplate && (
              <CardFooter className="border-t bg-muted/30 p-4">
                <Button onClick={() => setStep("preview")} className="w-full">
                  Continuar con "{selectedTemplate.name}" →
                </Button>
              </CardFooter>
            )}
          </Card>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Preview detected data + field editor
  // ─────────────────────────────────────────────────────────────────────────
  if (step === "preview") {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setStep("file")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Revisar datos detectados</h1>
            <p className="text-muted-foreground">
              {importFile?.name && <span className="font-medium">{importFile.name} · </span>}
              {includedFields.length} campos · {sheetRows.length > 0 ? `${sheetRows.length} registros` : "Sin registros (solo esquema)"}
            </p>
          </div>
        </div>

        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

        {/* SQL table switcher */}
        {mode === "sql" && Object.keys(sqlTables).length > 1 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Seleccionar tabla</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.keys(sqlTables).map(t => (
                  <button key={t} type="button" onClick={() => handleSqlTableSwitch(t)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${selectedSqlTable === t ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:border-primary/40"}`}>
                    <Table2 className="h-3.5 w-3.5" />{t}
                    <span className="text-xs opacity-60">({sqlTables[t].length})</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data preview table */}
        {sheetRows.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vista previa de datos</CardTitle>
              <CardDescription>Mostrando las primeras {Math.min(sheetRows.length, 5)} filas de {sheetRows.length} total</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto rounded-b-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10 text-center text-xs font-mono text-muted-foreground">#</TableHead>
                      {detectedFields.filter(f => f.included).map(f => (
                        <TableHead key={f.colKey} className="text-xs font-semibold whitespace-nowrap">
                          {f.label}
                          <div className="text-[10px] font-normal text-muted-foreground font-mono">{f.field_type}</div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sheetRows.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-center text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                        {detectedFields.filter(f => f.included).map(f => (
                          <TableCell key={f.colKey} className="text-sm max-w-[180px] truncate">
                            {String(row[f.colKey] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fields editor */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Campos detectados</CardTitle>
                <CardDescription>
                  Activa/desactiva columnas, edita etiquetas y ajusta el tipo de dato.
                  Los campos marcados se crearán en el censo.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addManualField}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Agregar campo
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-[24px_1fr_160px_32px] items-center gap-3 px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span></span>
                <span>Etiqueta del campo</span>
                <span>Tipo de dato</span>
                <span></span>
              </div>

              {detectedFields.map((field, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-[24px_1fr_160px_32px] items-center gap-3 p-3 rounded-lg border transition-colors ${field.included ? "bg-card" : "bg-muted/30 opacity-60"}`}
                >
                  {/* Toggle checkbox */}
                  <Checkbox
                    checked={field.included}
                    onCheckedChange={() => toggleField(idx)}
                    aria-label="Incluir campo"
                  />

                  {/* Label editor */}
                  <div className="min-w-0">
                    <Input
                      value={field.label}
                      onChange={e => {
                        updateField(idx, "label", e.target.value)
                        if (!field.name || field.name === toSlug(field.label)) {
                          updateField(idx, "name", toSlug(e.target.value))
                        }
                      }}
                      className="h-8 text-sm"
                      placeholder="Nombre del campo"
                      disabled={!field.included}
                    />
                    {field.sample_values.length > 0 && (
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                        Ej: {field.sample_values.join(" · ")}
                      </p>
                    )}
                  </div>

                  {/* Type selector */}
                  <Select
                    value={field.field_type}
                    onValueChange={v => updateField(idx, "field_type", v)}
                    disabled={!field.included}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(ft => (
                        <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Delete */}
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeField(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Census name / meta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información del censo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="census-name-p">Nombre *</Label>
              <Input id="census-name-p" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Censo de vivienda 2025" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="census-desc-p">Descripción</Label>
                <Textarea id="census-desc-p" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Propósito del censo..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="census-cat-p">Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="census-cat-p"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary + CTA */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={handleCreate}
            disabled={loading || !name.trim() || includedFields.length === 0}
            size="lg"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {sheetRows.length > 0
              ? `Crear censo e importar ${sheetRows.length} registro${sheetRows.length !== 1 ? "s" : ""}`
              : `Crear censo con ${includedFields.length} campo${includedFields.length !== 1 ? "s" : ""}`}
          </Button>
          <Button variant="outline" size="lg" onClick={() => setStep("file")}>
            ← Cambiar archivo
          </Button>
          <p className="text-sm text-muted-foreground ml-auto">
            {includedFields.length} de {detectedFields.length} campos seleccionados
          </p>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: Import progress screen
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-10 pb-10 space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            {progress < 100
              ? <Loader2 className="h-8 w-8 text-primary animate-spin" />
              : <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            }
          </div>
          <div>
            <h2 className="text-lg font-semibold">{progressLabel || "Procesando..."}</h2>
            <p className="text-sm text-muted-foreground mt-1">{progress}% completado</p>
          </div>
          <Progress value={progress} className="h-2.5" />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
