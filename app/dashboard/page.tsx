import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, FileSpreadsheet, Users, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react"
import type { Profile } from "@/lib/types"

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", user?.id)
    .single<Profile & { organizations: { id: string; name: string } }>()

  // Get census count
  const { count: censosCount } = await supabase
    .from("censos")
    .select("*", { count: "exact", head: true })

  // Get registros count
  const { count: registrosCount } = await supabase
    .from("registros")
    .select("*", { count: "exact", head: true })

  // Get registros with errors
  const { count: errorsCount } = await supabase
    .from("registros")
    .select("*", { count: "exact", head: true })
    .eq("status", "error")

  // Get complete registros
  const { count: completosCount } = await supabase
    .from("registros")
    .select("*", { count: "exact", head: true })
    .eq("status", "completo")

  const stats = [
    {
      title: "Censos activos",
      value: censosCount || 0,
      description: "Total de censos creados",
      icon: Database,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Total registros",
      value: registrosCount || 0,
      description: "Registros capturados",
      icon: FileSpreadsheet,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Registros completos",
      value: completosCount || 0,
      description: "Sin errores de validación",
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Con errores",
      value: errorsCount || 0,
      description: "Requieren atención",
      icon: AlertCircle,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bienvenido, {profile?.first_name || "Usuario"}
        </h1>
        <p className="text-muted-foreground">
          Resumen de tu actividad en {profile?.organizations?.name || "tu organización"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Censos recientes</CardTitle>
            <CardDescription>
              Últimos censos creados en tu organización
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentCensos />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>
              Últimas acciones realizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentActivity />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

async function RecentCensos() {
  const supabase = await createClient()

  const { data: censos } = await supabase
    .from("censos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5)

  if (!censos || censos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Database className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No hay censos creados aún</p>
        <p className="text-xs text-muted-foreground">
          Crea tu primer censo para comenzar
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {censos.map((censo) => (
        <div key={censo.id} className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
            <Database className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{censo.name}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(censo.created_at).toLocaleDateString("es-ES")}
            </p>
          </div>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              censo.status === "activo"
                ? "bg-green-500/10 text-green-500"
                : censo.status === "pausado"
                ? "bg-amber-500/10 text-amber-500"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {censo.status}
          </span>
        </div>
      ))}
    </div>
  )
}

async function RecentActivity() {
  const supabase = await createClient()

  const { data: activity } = await supabase
    .from("auditoria")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5)

  if (!activity || activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <TrendingUp className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">Sin actividad reciente</p>
        <p className="text-xs text-muted-foreground">
          Las acciones aparecerán aquí
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {activity.map((item) => (
        <div key={item.id} className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.action}</p>
            <p className="text-xs text-muted-foreground">
              {item.table_name} - {new Date(item.created_at).toLocaleString("es-ES")}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
