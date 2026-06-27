import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import type { Censo, CampoCenso, UserRole } from "@/lib/types"
import { CensoDetailClient } from "@/components/censo-detail-client"

interface Props {
  params: Promise<{ id: string }>
}

export default async function CensoDetailPage({ params }: Props) {
  const { id } = await params

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) notFound()

  const supabase = await createClient()

  // Current user role
  const { data: { user } } = await supabase.auth.getUser()
  let userRole: UserRole = "consulta"
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    if (profile?.role) userRole = profile.role as UserRole
  }

  const { data: censo, error } = await supabase
    .from("censos")
    .select("*")
    .eq("id", id)
    .single<Censo>()

  if (error || !censo) notFound()

  // Campos
  const { data: campos } = await supabase
    .from("campos_censo")
    .select("*")
    .eq("censo_id", id)
    .order("order_index", { ascending: true })

  // Total registros
  const { count: registrosCount } = await supabase
    .from("registros")
    .select("*", { count: "exact", head: true })
    .eq("censo_id", id)

  // Registros por estado
  const { data: registrosByStatus } = await supabase
    .from("registros")
    .select("status")
    .eq("censo_id", id)

  const statusCounts = (registrosByStatus || []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  // Actividad de capturistas: registros agrupados por created_by
  const { data: registrosPorUsuario } = await supabase
    .from("registros")
    .select("created_by")
    .eq("censo_id", id)
    .not("created_by", "is", null)

  // Count per user
  const countPerUser: Record<string, number> = {}
  for (const r of registrosPorUsuario || []) {
    if (r.created_by) countPerUser[r.created_by] = (countPerUser[r.created_by] || 0) + 1
  }

  // Fetch names for those user IDs
  const userIds = Object.keys(countPerUser)
  let capturistasActivity: { name: string; count: number }[] = []
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, role")
      .in("id", userIds)

    capturistasActivity = (profiles || [])
      .map(p => ({
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Usuario sin nombre",
        count: countPerUser[p.id] || 0,
      }))
      .sort((a, b) => b.count - a.count)
  }

  // For seleccion_unica/booleano fields: get value distribution (top 3 campos)
  const selectCampos = (campos || []).filter(c =>
    ["seleccion_unica", "booleano", "seleccion_multiple"].includes(c.field_type)
  ).slice(0, 3)

  // Get value distributions for those campos
  const distributions: Record<string, Record<string, number>> = {}
  for (const campo of selectCampos) {
    const { data: vals } = await supabase
      .from("valores_registro")
      .select("value")
      .eq("campo_id", campo.id)
      .limit(500)

    if (vals) {
      distributions[campo.id] = vals.reduce<Record<string, number>>((acc, v) => {
        if (v.value) acc[v.value] = (acc[v.value] || 0) + 1
        return acc
      }, {})
    }
  }

  return (
    <CensoDetailClient
      censo={censo}
      campos={(campos as CampoCenso[]) || []}
      registrosCount={registrosCount || 0}
      statusCounts={statusCounts}
      selectCampos={(selectCampos as CampoCenso[]) || []}
      distributions={distributions}
      userRole={userRole}
      capturistasActivity={capturistasActivity}
    />
  )
}
