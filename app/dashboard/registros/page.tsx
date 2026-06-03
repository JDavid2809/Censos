import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { FileSpreadsheet, Database } from "lucide-react"

export default async function RegistrosPage() {
  const supabase = await createClient()

  const { data: censos } = await supabase
    .from("censos")
    .select("id, name, status, registros(count)")
    .order("created_at", { ascending: false })

  const totalRegistros = censos?.reduce((sum, c) => sum + (c.registros?.[0]?.count || 0), 0) || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Registros</h1>
        <p className="text-muted-foreground">
          Accede a los registros de todos tus censos
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de registros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalRegistros.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Censos con datos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {censos?.filter(c => (c.registros?.[0]?.count || 0) > 0).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registros por censo</CardTitle>
          <CardDescription>
            Selecciona un censo para ver sus registros
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!censos || censos.length === 0 ? (
            <div className="text-center py-12">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay censos creados</p>
              <Button asChild className="mt-4">
                <Link href="/dashboard/censos/nuevo">Crear censo</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Censo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Registros</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {censos.map((censo) => (
                  <TableRow key={censo.id}>
                    <TableCell className="font-medium">{censo.name}</TableCell>
                    <TableCell>
                      <Badge variant={censo.status === "activo" ? "default" : "secondary"}>
                        {censo.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                        {censo.registros?.[0]?.count || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/censos/${censo.id}`}>
                          Ver registros
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
