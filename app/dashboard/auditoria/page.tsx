import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, ShieldAlert } from "lucide-react"

export default async function AuditoriaPage() {
  const supabase = await createClient()

  // Fetch auditoria logs
  const { data: logs, error } = await supabase
    .from("auditoria")
    .select("*, profiles(first_name, last_name, role)")
    .order("created_at", { ascending: false })
    .limit(100)

  // Handle case where table is missing or query fails
  const isTableMissing = error?.code === "42P01"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditoría del Sistema</h1>
        <p className="text-muted-foreground">
          Registro de acciones y cambios realizados en la organización
        </p>
      </div>

      {isTableMissing ? (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-12 text-center space-y-3">
            <ShieldAlert className="h-12 w-12 text-yellow-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="font-semibold text-lg text-yellow-800">Tabla de Auditoría No Inicializada</h3>
              <p className="text-sm text-yellow-700 max-w-md mx-auto">
                La tabla de auditoría no existe en tu base de datos de Supabase. Ve a la pestaña **Configuración** en el menú de la izquierda e inicializa el esquema de base de datos para habilitar el registro de auditoría.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : !logs || logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Sin registros de auditoría</p>
            <p className="text-sm text-muted-foreground">
              Las acciones realizadas por los miembros del equipo aparecerán aquí
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Historial de Actividad</CardTitle>
            <CardDescription>
              Últimas 100 acciones registradas en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Referencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("es-ES")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.profiles ? (
                        <div>
                          <span>
                            {log.profiles.first_name} {log.profiles.last_name}
                          </span>
                          <span className="block text-[10px] text-muted-foreground capitalize">
                            {log.profiles.role}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">Sistema / Desconocido</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.action}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.table_name ? (
                        <span>
                          {log.table_name} ({log.record_id?.slice(0, 8)}…)
                        </span>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
