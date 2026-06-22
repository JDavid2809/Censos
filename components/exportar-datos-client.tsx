"use client"

import { useState } from "react"
import { sileo } from "sileo"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import * as XLSX from "xlsx"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import type { CampoCenso, Registro, ValorRegistro } from "@/lib/types"

interface ExportarDatosClientProps {
  censoId: string
  censoName: string
  campos: CampoCenso[]
}

export function ExportarDatosClient({ censoId, censoName, campos }: ExportarDatosClientProps) {
  const [format, setFormat] = useState<"xlsx" | "csv" | "pdf">("xlsx")
  const [selectedCampos, setSelectedCampos] = useState<string[]>(campos.map(c => c.id))
  const [exporting, setExporting] = useState(false)
  const supabase = createClient()

  function toggleCampo(campoId: string) {
    if (selectedCampos.includes(campoId)) {
      setSelectedCampos(selectedCampos.filter(id => id !== campoId))
    } else {
      setSelectedCampos([...selectedCampos, campoId])
    }
  }

  function selectAll() {
    setSelectedCampos(campos.map(c => c.id))
  }

  function selectNone() {
    setSelectedCampos([])
  }

  async function handleExport() {
    if (selectedCampos.length === 0) {
      sileo.error({ title: "Falta selección", description: "Por favor, selecciona al menos un campo de la lista de campos disponibles para poder exportar los datos del censo." })
      return
    }

    setExporting(true)

    try {
      // Fetch registros with valores
      const { data: registros, error: fetchError } = await supabase
         .from("registros")
         .select("*, valores_registro(*)")
         .eq("censo_id", censoId)

      if (fetchError) throw fetchError

      if (!registros || registros.length === 0) {
        sileo.error({ title: "Sin datos", description: "No se encontraron registros de datos guardados en este censo para exportar. Asegúrate de capturar o importar información primero." })
        setExporting(false)
        return
      }

      // Prepare data
      const selectedCamposData = campos.filter(c => selectedCampos.includes(c.id))
      const headers = selectedCamposData.map(c => c.label)
      
      const rows = registros.map((registro: Registro & { valores_registro: ValorRegistro[] }) => {
        const valoresMap = new Map(
          registro.valores_registro.map(v => [v.campo_id, v.value])
        )
        return selectedCamposData.map(campo => valoresMap.get(campo.id) || "")
      })

      // Export based on format
      if (format === "xlsx" || format === "csv") {
        const wsData = [headers, ...rows]
        const ws = XLSX.utils.aoa_to_sheet(wsData)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Datos")

        const filename = `${censoName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}`
        
        if (format === "xlsx") {
          XLSX.writeFile(wb, `${filename}.xlsx`)
        } else {
          XLSX.writeFile(wb, `${filename}.csv`, { bookType: "csv" })
        }
      } else if (format === "pdf") {
        const doc = new jsPDF()
        
        doc.setFontSize(16)
        doc.text(censoName, 14, 22)
        
        doc.setFontSize(10)
        doc.text(`Exportado: ${new Date().toLocaleString("es-ES")}`, 14, 30)
        doc.text(`Total registros: ${registros.length}`, 14, 36)

        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: 42,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [59, 130, 246] },
        })

        doc.save(`${censoName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`)
      }

      sileo.success({
        title: "Exportación exitosa",
        description: `Se han exportado y descargado exitosamente ${registros.length} registros en formato ${format.toUpperCase()}.`
      })
      setExporting(false)
    } catch (err) {
      sileo.error({ title: "Error al exportar", description: "Ocurrió un error inesperado al procesar y generar el archivo de exportación. Por favor, verifica tu conexión y vuelve a intentarlo." })
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/dashboard/censos/${censoId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Exportar datos</h1>
          <p className="text-muted-foreground">{censoName}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Format Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Formato de exportación</CardTitle>
            <CardDescription>
              Selecciona el formato del archivo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as "xlsx" | "csv" | "pdf")}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                <RadioGroupItem value="xlsx" id="xlsx" />
                <Label htmlFor="xlsx" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Excel (.xlsx)</p>
                    <p className="text-sm text-muted-foreground">
                      Compatible con Microsoft Excel y Google Sheets
                    </p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">CSV (.csv)</p>
                    <p className="text-sm text-muted-foreground">
                      Formato universal de texto separado por comas
                    </p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileText className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium">PDF (.pdf)</p>
                    <p className="text-sm text-muted-foreground">
                      Documento listo para imprimir
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Field Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Campos a exportar</CardTitle>
                <CardDescription>
                  Selecciona los campos que deseas incluir
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Todos
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>
                  Ninguno
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {campos.map((campo) => (
                <div key={campo.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={campo.id}
                    checked={selectedCampos.includes(campo.id)}
                    onCheckedChange={() => toggleCampo(campo.id)}
                  />
                  <Label htmlFor={campo.id} className="cursor-pointer">
                    {campo.label}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedCampos.length} de {campos.length} campos seleccionados
            </p>
            <div className="flex gap-4">
              <Button variant="outline" asChild>
                <Link href={`/dashboard/censos/${censoId}`}>Cancelar</Link>
              </Button>
              <Button onClick={handleExport} disabled={exporting || selectedCampos.length === 0}>
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exportar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
