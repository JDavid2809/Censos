import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CensosListClient } from "@/components/censos-list-client"

export default async function CensosPage() {
  const supabase = await createClient()

  const { data: censos } = await supabase
    .from("censos")
    .select("*, campos_censo(count), registros(count)")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Censos</h1>
        <p className="text-muted-foreground">
          Gestiona todos los censos de tu organización
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todos los censos</CardTitle>
          <CardDescription>
            {censos?.length || 0} censo{(censos?.length || 0) !== 1 ? "s" : ""} en tu organización
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CensosListClient initialCensos={(censos as any) || []} />
        </CardContent>
      </Card>
    </div>
  )
}
