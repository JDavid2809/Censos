import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { CapturarRegistroClient } from "@/components/capturar-registro-client"
import type { Censo, CampoCenso } from "@/lib/types"

interface Props {
  params: Promise<{ id: string }>
}

export default async function CapturarRegistroPage({ params }: Props) {
  const { id } = await params

  // Validate UUID to avoid database errors
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    notFound()
  }

  const supabase = await createClient()

  const { data: censo, error } = await supabase
    .from("censos")
    .select("*")
    .eq("id", id)
    .single<Censo>()

  if (error || !censo) {
    notFound()
  }

  const { data: campos } = await supabase
    .from("campos_censo")
    .select("*")
    .eq("censo_id", id)
    .order("order_index", { ascending: true })

  return (
    <CapturarRegistroClient
      censoId={id}
      censoName={censo.name}
      campos={(campos as CampoCenso[]) || []}
    />
  )
}
