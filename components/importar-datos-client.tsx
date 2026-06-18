"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Database,
  FileCode2,
  FileJson,
  Info,
  Table2,
} from "lucide-react"
import type { CampoCenso } from "@/lib/types"

interface ImportarDatosClientProps {
  censoId: string
  censoName: string
  campos: CampoCenso[]
}

type SheetRow = Record<string, string | number | boolean | null>

// ─── Utility: parse PostgreSQL CREATE TABLE statement ────────────────────────
function parseSqlSchema(sql: string): { tables: Record<string, string[]> } {
  const tables: Record<string, string[]> = {}
  // Match CREATE TABLE statements
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[\w.]+"?\.)?"?([\w]+)"?\s*\(([\s\S]+?)\)(?:\s*;|\s*$)/gi
  let match
  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1]
    const columnBlock = match[2]
    // Extract column names from lines that aren't constraints
    const columnLines = columnBlock.split("\n")
    const columns: string[] = []
    for (const line of columnLines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("--")) continue
      // Skip constraint definitions
      if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|INDEX)/i.test(trimmed)) continue
      // Extract column name (first word)
      const colMatch = trimmed.match(/^"?([\w]+)"?\s+/i)
      if (colMatch) {
        columns.push(colMatch[1])
      }
    }
    if (columns.length > 0) {
      tables[tableName] = columns
    }
  }
  return { tables }
}

// ─── Utility: parse XML and extract row data ─────────────────────────────────
function parseXmlData(xmlText: string): { rows: SheetRow[]; columns: string[] } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, "text/xml")
  
  const parseError = doc.querySelector("parsererror")
  if (parseError) throw new Error("XML inválido: " + parseError.textContent?.slice(0, 100))

  const root = doc.documentElement

  // Try common patterns: root > row elements, or spreadsheet-like structure
  let records: Element[] = []

  // Pattern 1: root > children of same type (e.g., <registros><registro>...)
  const children = Array.from(root.children)
  if (children.length > 0) {
    const firstTag = children[0].tagName
    const sameTag = children.filter((c) => c.tagName === firstTag)
    if (sameTag.length > 0) {
      records = sameTag
    } else {
      // Pattern 2: root > wrapper > children
      for (const child of children) {
        const grandchildren = Array.from(child.children)
        if (grandchildren.length > 0) {
          records = grandchildren
          break
        }
      }
    }
  }

  if (records.length === 0) {
    throw new Error("No se encontraron registros en el XML. Verifica la estructura del archivo.")
  }

  // Build column list from all tags found
  const colSet = new Set<string>()
  records.forEach((rec) => {
    Array.from(rec.children).forEach((el) => colSet.add(el.tagName))
    // Also check attributes
    Array.from(rec.attributes).forEach((attr) => colSet.add(`@${attr.name}`))
  })
  const columns = Array.from(colSet)

  // Build rows
  const rows: SheetRow[] = records.map((rec) => {
    const row: SheetRow = {}
    columns.forEach((col) => {
      if (col.startsWith("@")) {
        row[col] = rec.getAttribute(col.slice(1)) ?? ""
      } else {
        const el = rec.querySelector(col)
        row[col] = el ? el.textContent?.trim() ?? "" : ""
      }
    })
    return row
  })

  return { rows, columns }
}

// ─── Column mapper component ─────────────────────────────────────────────────
function ColumnMapper({
  campos,
  columns,
  mapping,
  setMapping,
}: {
  campos: CampoCenso[]
  columns: string[]
  mapping: Record<string, string>
  setMapping: (m: Record<string, string>) => void
}) {
  return (
    <div className="space-y-3">
      {campos.map((campo) => (
        <div key={campo.id} className="flex items-center gap-4">
          <div className="w-1/3">
            <p className="font-medium text-sm">{campo.label}</p>
            <p className="text-xs text-muted-foreground">
              {campo.required ? "Requerido" : "Opcional"} · {campo.field_type}
            </p>
          </div>
          <div className="w-2/3">
            <Select
              value={mapping[campo.id] || ""}
              onValueChange={(value) => setMapping({ ...mapping, [campo.id]: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una columna" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin mapear</SelectItem>
                {columns.map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Import executor ─────────────────────────────────────────────────────────
async function executeImport(
  supabase: ReturnType<typeof createClient>,
  censoId: string,
  userId: string | undefined,
  sheetData: SheetRow[],
  campos: CampoCenso[],
  mapping: Record<string, string>,
  onProgress: (p: number) => void
): Promise<{ success: number; errors: number }> {
  const registrosData = sheetData.map(() => ({
    censo_id: censoId,
    status: "completo" as const,
    created_by: userId,
  }))

  onProgress(20)

  const { data: registrosInserted, error: registrosError } = await supabase
    .from("registros")
    .insert(registrosData)
    .select("id")

  if (registrosError) throw registrosError
  onProgress(50)

  const allValoresData: { registro_id: string; campo_id: string; value: string }[] = []
  registrosInserted.forEach((registro, i) => {
    const row = sheetData[i]
    campos
      .filter((campo) => mapping[campo.id])
      .forEach((campo) => {
        const val = String(row[mapping[campo.id]] ?? "").trim()
        if (val !== "") {
          allValoresData.push({ registro_id: registro.id, campo_id: campo.id, value: val })
        }
      })
  })

  onProgress(70)

  const CHUNK_SIZE = 1000
  for (let i = 0; i < allValoresData.length; i += CHUNK_SIZE) {
    const chunk = allValoresData.slice(i, i + CHUNK_SIZE)
    const { error: valoresError } = await supabase.from("valores_registro").insert(chunk)
    if (valoresError) throw valoresError
    onProgress(70 + Math.round(((i + CHUNK_SIZE) / allValoresData.length) * 30))
  }

  return { success: registrosInserted.length, errors: 0 }
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ImportarDatosClient({ censoId, censoName, campos }: ImportarDatosClientProps) {
  const router = useRouter()
  const supabase = createClient()

  // Shared state
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null)

  // Excel/CSV tab state
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelData, setExcelData] = useState<SheetRow[]>([])
  const [excelColumns, setExcelColumns] = useState<string[]>([])

  // XML tab state
  const [xmlFile, setXmlFile] = useState<File | null>(null)
  const [xmlData, setXmlData] = useState<SheetRow[]>([])
  const [xmlColumns, setXmlColumns] = useState<string[]>([])

  // PostgreSQL SQL tab state
  const [sqlFile, setSqlFile] = useState<File | null>(null)
  const [sqlTables, setSqlTables] = useState<Record<string, string[]>>({})
  const [selectedTable, setSelectedTable] = useState<string>("")
  const [activeTab, setActiveTab] = useState("excel")

  // Auto-map columns by name
  function autoMap(columns: string[]): Record<string, string> {
    const m: Record<string, string> = {}
    campos.forEach((campo) => {
      const match = columns.find(
        (col) =>
          col.toLowerCase() === campo.label.toLowerCase() ||
          col.toLowerCase() === campo.name.toLowerCase() ||
          col.toLowerCase().includes(campo.label.toLowerCase()) ||
          campo.label.toLowerCase().includes(col.toLowerCase())
      )
      if (match) m[campo.id] = match
    })
    return m
  }

  // ─── Excel/CSV handler
  const handleExcelChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setExcelFile(f)
    setError(null)
    setResult(null)
    try {
      const data = await f.arrayBuffer()
      const workbook = XLSX.read(data)
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json<SheetRow>(firstSheet, { defval: "" })
      if (jsonData.length === 0) { setError("El archivo no contiene datos"); return }
      const cols = Object.keys(jsonData[0])
      setExcelColumns(cols)
      setExcelData(jsonData)
      setMapping(autoMap(cols))
    } catch {
      setError("Error al leer el archivo Excel/CSV.")
    }
  }, [campos])

  // ─── XML handler
  const handleXmlChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setXmlFile(f)
    setError(null)
    setResult(null)
    try {
      const text = await f.text()
      const { rows, columns } = parseXmlData(text)
      setXmlData(rows)
      setXmlColumns(columns)
      setMapping(autoMap(columns))
    } catch (err: any) {
      setError(err.message || "Error al leer el archivo XML.")
    }
  }, [campos])

  // ─── SQL schema handler
  const handleSqlChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setSqlFile(f)
    setSelectedTable("")
    setMapping({})
    setError(null)
    setResult(null)
    try {
      const text = await f.text()
      const { tables } = parseSqlSchema(text)
      if (Object.keys(tables).length === 0) {
        setError("No se encontraron tablas en el archivo SQL. Asegúrate de que contenga sentencias CREATE TABLE.")
        return
      }
      setSqlTables(tables)
      // Auto-select first table
      const first = Object.keys(tables)[0]
      setSelectedTable(first)
      setMapping(autoMap(tables[first]))
    } catch (err: any) {
      setError(err.message || "Error al leer el archivo SQL.")
    }
  }, [campos])

  function handleSqlTableSelect(tableName: string) {
    setSelectedTable(tableName)
    setMapping(autoMap(sqlTables[tableName] || []))
  }

  async function handleImport(data: SheetRow[]) {
    if (data.length === 0) { setError("No hay datos para importar"); return }
    setImporting(true)
    setProgress(0)
    setError(null)

    let userId = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id
    } catch (e) {
      console.warn("Error getting user with getUser in import:", e)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        userId = session?.user?.id
      } catch (sessionErr) {
        console.error("Failed to get session fallback in import:", sessionErr)
      }
    }

    try {
      const res = await executeImport(supabase, censoId, userId, data, campos, mapping, setProgress)
      setResult(res)
      if (res.success > 0) router.refresh()
    } catch (err: any) {
      setError(err.message || "Error durante la importación")
      setResult({ success: 0, errors: data.length })
    } finally {
      setImporting(false)
      setProgress(100)
    }
  }

  if (campos.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/dashboard/censos/${censoId}`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Importar datos</h1>
            <p className="text-muted-foreground">{censoName}</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Info className="h-10 w-10 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Debes configurar los campos del censo antes de importar datos
            </p>
            <Button asChild>
              <Link href={`/dashboard/censos/${censoId}/configurar`}>Configurar campos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/dashboard/censos/${censoId}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar datos</h1>
          <p className="text-muted-foreground">{censoName}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setError(null); setResult(null); setMapping({}) }}>
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="excel" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Excel / CSV
          </TabsTrigger>
          <TabsTrigger value="xml" className="gap-2">
            <FileCode2 className="h-4 w-4" />
            XML
          </TabsTrigger>
          <TabsTrigger value="sql" className="gap-2">
            <Database className="h-4 w-4" />
            PostgreSQL
          </TabsTrigger>
        </TabsList>

        {/* ─── Excel / CSV ─── */}
        <TabsContent value="excel" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Seleccionar archivo</CardTitle>
              <CardDescription>Sube un archivo Excel (.xlsx, .xls) o CSV</CardDescription>
            </CardHeader>
            <CardContent>
              <label htmlFor="excel-upload" className="cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-10 text-center hover:border-primary/50 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  {excelFile ? (
                    <div className="flex items-center justify-center gap-2 text-sm font-medium">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                      {excelFile.name}
                      <Badge variant="secondary">{excelData.length} filas</Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Haz clic para seleccionar o arrastra un archivo aquí</p>
                  )}
                </div>
                <input id="excel-upload" type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelChange} className="hidden" />
              </label>
            </CardContent>
          </Card>

          {excelColumns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>2. Mapear columnas</CardTitle>
                <CardDescription>Asocia columnas del archivo con campos del censo</CardDescription>
              </CardHeader>
              <CardContent>
                <ColumnMapper campos={campos} columns={excelColumns} mapping={mapping} setMapping={setMapping} />
              </CardContent>
            </Card>
          )}

          {excelColumns.length > 0 && (
            <ImportActions
              data={excelData}
              onImport={() => handleImport(excelData)}
              importing={importing}
              progress={progress}
              error={error}
              result={result}
              censoId={censoId}
            />
          )}
        </TabsContent>

        {/* ─── XML ─── */}
        <TabsContent value="xml" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Seleccionar archivo XML</CardTitle>
              <CardDescription>
                El sistema analizará la estructura automáticamente y generará los campos para mapear
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label htmlFor="xml-upload" className="cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-10 text-center hover:border-primary/50 transition-colors">
                  <FileCode2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  {xmlFile ? (
                    <div className="flex items-center justify-center gap-2 text-sm font-medium">
                      <FileCode2 className="h-4 w-4 text-blue-500" />
                      {xmlFile.name}
                      <Badge variant="secondary">{xmlData.length} registros</Badge>
                      <Badge variant="outline">{xmlColumns.length} campos detectados</Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Haz clic para seleccionar un archivo .xml</p>
                  )}
                </div>
                <input id="xml-upload" type="file" accept=".xml" onChange={handleXmlChange} className="hidden" />
              </label>
            </CardContent>
          </Card>

          {xmlColumns.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>2. Campos detectados</CardTitle>
                  <CardDescription>Se encontraron {xmlColumns.length} etiquetas/atributos en el XML</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {xmlColumns.map((col) => (
                      <Badge key={col} variant="secondary" className="font-mono text-xs">{col}</Badge>
                    ))}
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-3">Mapear con campos del censo:</p>
                    <ColumnMapper campos={campos} columns={xmlColumns} mapping={mapping} setMapping={setMapping} />
                  </div>
                </CardContent>
              </Card>

              <ImportActions
                data={xmlData}
                onImport={() => handleImport(xmlData)}
                importing={importing}
                progress={progress}
                error={error}
                result={result}
                censoId={censoId}
              />
            </>
          )}

          {error && xmlColumns.length === 0 && (
            <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
          )}
        </TabsContent>

        {/* ─── PostgreSQL SQL ─── */}
        <TabsContent value="sql" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Importar esquema de PostgreSQL</CardTitle>
              <CardDescription>
                Sube un archivo <code className="text-xs bg-muted px-1 rounded">.sql</code> con sentencias{" "}
                <code className="text-xs bg-muted px-1 rounded">CREATE TABLE</code>. Se extraerán las columnas
                de cada tabla para usarlas como referencia de campos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label htmlFor="sql-upload" className="cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-10 text-center hover:border-primary/50 transition-colors">
                  <Database className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  {sqlFile ? (
                    <div className="flex items-center justify-center gap-2 text-sm font-medium">
                      <Database className="h-4 w-4 text-indigo-500" />
                      {sqlFile.name}
                      <Badge variant="secondary">{Object.keys(sqlTables).length} tablas</Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Haz clic para seleccionar un archivo <strong>.sql</strong> (dump de PostgreSQL)
                    </p>
                  )}
                </div>
                <input id="sql-upload" type="file" accept=".sql,.txt" onChange={handleSqlChange} className="hidden" />
              </label>
            </CardContent>
          </Card>

          {Object.keys(sqlTables).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>2. Seleccionar tabla</CardTitle>
                <CardDescription>
                  Elige la tabla cuyas columnas usarás como referencia para los campos del censo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Object.keys(sqlTables).map((tableName) => (
                    <button
                      key={tableName}
                      type="button"
                      onClick={() => handleSqlTableSelect(tableName)}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-sm text-left transition-colors ${
                        selectedTable === tableName
                          ? "border-primary bg-primary/5 text-primary font-medium"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Table2 className="h-4 w-4 flex-shrink-0" />
                      <div className="overflow-hidden">
                        <p className="truncate font-mono">{tableName}</p>
                        <p className="text-xs text-muted-foreground">{sqlTables[tableName].length} cols</p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedTable && sqlTables[selectedTable] && (
            <Card>
              <CardHeader>
                <CardTitle>3. Columnas de <code className="text-base font-mono">{selectedTable}</code></CardTitle>
                <CardDescription>Mapea las columnas SQL con los campos del censo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-6">
                  {sqlTables[selectedTable].map((col) => (
                    <Badge key={col} variant="secondary" className="font-mono text-xs">{col}</Badge>
                  ))}
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-4">
                    Mapear columnas SQL → campos del censo:
                  </p>
                  <ColumnMapper
                    campos={campos}
                    columns={sqlTables[selectedTable]}
                    mapping={mapping}
                    setMapping={setMapping}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {selectedTable && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Nota:</strong> Este módulo importa el <em>esquema</em> (estructura) de tu base de datos para definir campos de referencia.
                Para importar los registros reales, usa el módulo de importación Excel/CSV con los datos exportados de tu base de datos.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Import action card ───────────────────────────────────────────────────────
function ImportActions({
  data,
  onImport,
  importing,
  progress,
  error,
  result,
  censoId,
}: {
  data: SheetRow[]
  onImport: () => void
  importing: boolean
  progress: number
  error: string | null
  result: { success: number; errors: number } | null
  censoId: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar</CardTitle>
        <CardDescription>Revisa el mapeo y comienza la importación de datos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert variant={result.errors > 0 ? "destructive" : "default"}>
            <div className="flex items-center gap-2">
              {result.errors > 0 ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <AlertDescription>
                Importación completada: <strong>{result.success}</strong> registros exitosos
                {result.errors > 0 && `, ${result.errors} errores`}
              </AlertDescription>
            </div>
          </Alert>
        )}

        {importing && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">Importando... {progress}%</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={onImport} disabled={importing || data.length === 0}>
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar {data.length} registros
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/dashboard/censos/${censoId}`}>Cancelar</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
