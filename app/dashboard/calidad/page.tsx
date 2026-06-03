import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertCircle, CheckCircle2, AlertTriangle, Copy, FileX } from "lucide-react"
import Link from "next/link"

export default async function CalidadDatosPage() {
  const supabase = await createClient()

  // Get all active censos with their registros and field values
  const { data: censos } = await supabase
    .from("censos")
    .select("id, name, registros(id, status, valores_registro(campo_id, value))")
    .eq("status", "activo")

  // Calculate quality metrics and detect duplicates
  const qualityData = censos?.map((censo) => {
    const registros = censo.registros || []
    const total = registros.length
    const completos = registros.filter((r: { status: string }) => r.status === "completo").length
    const incompletos = registros.filter((r: { status: string }) => r.status === "incompleto").length
    const errores = registros.filter((r: { status: string }) => r.status === "error").length

    // Detect duplicates: registros that have identical values across all campos
    const signatures = registros.map((r: { id: string; valores_registro: { campo_id: string; value: string }[] }) => {
      const sorted = [...(r.valores_registro || [])]
        .sort((a, b) => a.campo_id.localeCompare(b.campo_id))
        .map((v) => `${v.campo_id}:${v.value}`)
        .join("|")
      return { id: r.id, sig: sorted }
    })

    const sigMap = new Map<string, number>()
    signatures.forEach(({ sig }) => {
      if (sig) sigMap.set(sig, (sigMap.get(sig) || 0) + 1)
    })
    const duplicates = signatures.filter(({ sig }) => (sigMap.get(sig) || 0) > 1).length

    return {
      id: censo.id,
      name: censo.name,
      total,
      completos,
      incompletos,
      errores,
      duplicates,
      qualityScore: total > 0 ? Math.round((completos / total) * 100) : 100,
    }
  }) || []

  const totalRegistros = qualityData.reduce((sum, c) => sum + c.total, 0)
  const totalCompletos = qualityData.reduce((sum, c) => sum + c.completos, 0)
  const totalIncompletos = qualityData.reduce((sum, c) => sum + c.incompletos, 0)
  const totalErrores = qualityData.reduce((sum, c) => sum + c.errores, 0)
  const totalDuplicates = qualityData.reduce((sum, c) => sum + c.duplicates, 0)
  const overallScore = totalRegistros > 0 ? Math.round((totalCompletos / totalRegistros) * 100) : 100

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calidad de datos</h1>
        <p className="text-muted-foreground">
          Monitorea y mejora la calidad de tus datos censales
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Puntuación global</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`text-3xl font-bold ${overallScore >= 90 ? "text-green-600" : overallScore >= 70 ? "text-amber-600" : "text-red-600"}`}>
                {overallScore}%
              </div>
              <Progress value={overallScore} className="flex-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalCompletos}</div>
            <p className="text-xs text-muted-foreground">
              {totalRegistros > 0 ? Math.round((totalCompletos / totalRegistros) * 100) : 0}% del total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incompletos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{totalIncompletos}</div>
            <p className="text-xs text-muted-foreground">Requieren atención</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con errores</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalErrores}</div>
            <p className="text-xs text-muted-foreground">Necesitan corrección</p>
          </CardContent>
        </Card>
      </div>

      {/* Quality by Census */}
      <Card>
        <CardHeader>
          <CardTitle>Calidad por censo</CardTitle>
          <CardDescription>Estado de calidad de datos por cada censo activo</CardDescription>
        </CardHeader>
        <CardContent>
          {qualityData.length === 0 ? (
            <div className="text-center py-12">
              <FileX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay censos activos con datos</p>
              <Button asChild className="mt-4">
                <Link href="/dashboard/censos">Ver censos</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Censo</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Completos</TableHead>
                  <TableHead>Incompletos</TableHead>
                  <TableHead>Errores</TableHead>
                  <TableHead>Duplicados</TableHead>
                  <TableHead>Calidad</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qualityData.map((censo) => (
                  <TableRow key={censo.id}>
                    <TableCell className="font-medium">{censo.name}</TableCell>
                    <TableCell>{censo.total}</TableCell>
                    <TableCell>
                      <span className="text-green-600">{censo.completos}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-amber-600">{censo.incompletos}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-red-600">{censo.errores}</span>
                    </TableCell>
                    <TableCell>
                      <span className={censo.duplicates > 0 ? "text-orange-600 font-medium" : "text-muted-foreground"}>
                        {censo.duplicates}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={censo.qualityScore} className="w-20" />
                        <Badge
                          variant={
                            censo.qualityScore >= 90
                              ? "default"
                              : censo.qualityScore >= 70
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {censo.qualityScore}%
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/censos/${censo.id}`}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Common Issues */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Problemas detectados</CardTitle>
            <CardDescription>Tipos de errores más frecuentes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <IssueItem
                icon={<Copy className="h-4 w-4" />}
                title="Posibles duplicados"
                count={totalDuplicates}
                description="Registros con datos idénticos detectados"
              />
              <IssueItem
                icon={<FileX className="h-4 w-4" />}
                title="Campos vacíos"
                count={totalIncompletos}
                description="Registros con campos requeridos vacíos"
              />
              <IssueItem
                icon={<AlertCircle className="h-4 w-4" />}
                title="Errores de validación"
                count={totalErrores}
                description="Datos que no cumplen el formato"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones recomendadas</CardTitle>
            <CardDescription>Pasos sugeridos para mejorar la calidad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {totalDuplicates > 0 && (
                <ActionItem
                  title="Revisar posibles duplicados"
                  description={`Se detectaron ${totalDuplicates} registros con datos idénticos`}
                />
              )}
              {totalIncompletos > 0 && (
                <ActionItem
                  title="Completar registros incompletos"
                  description={`Hay ${totalIncompletos} registros que necesitan datos`}
                />
              )}
              {totalErrores > 0 && (
                <ActionItem
                  title="Corregir errores de validación"
                  description={`Hay ${totalErrores} registros con errores`}
                />
              )}
              {totalRegistros === 0 && (
                <ActionItem
                  title="Comenzar a capturar datos"
                  description="Aún no hay registros en los censos activos"
                />
              )}
              {overallScore === 100 && totalRegistros > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-700">Excelente calidad</p>
                    <p className="text-sm text-green-600">Todos los registros están completos</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function IssueItem({
  icon,
  title,
  count,
  description,
}: {
  icon: React.ReactNode
  title: string
  count: number
  description: string
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Badge variant={count > 0 ? "destructive" : "secondary"}>{count}</Badge>
    </div>
  )
}

function ActionItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
