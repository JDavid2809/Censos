import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { ImportarDatosClient } from "@/components/importar-datos-client"
import type { Censo, CampoCenso } from "@/lib/types"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ImportarDatosPage({ params }: Props) {
  const { id } = await params

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) notFound()

  const supabase = await createClient()

  // Block capturistas
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    if (profile?.role === "capturista") {
      redirect(`/dashboard/censos/${id}`)
    }
  }

  const { data: censo, error } = await supabase
    .from("censos")
    .select("*")
    .eq("id", id)
    .single<Censo>()

  if (error || !censo) notFound()

  const { data: campos } = await supabase
    .from("campos_censo")
    .select("*")
    .eq("censo_id", id)
    .order("order_index", { ascending: true })

  return (
    <ImportarDatosClient
      censoId={id}
      censoName={censo.name}
      campos={(campos as CampoCenso[]) || []}
    />
  )
}
