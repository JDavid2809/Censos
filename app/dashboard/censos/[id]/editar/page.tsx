import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { EditarCensoClient } from "@/components/editar-censo-client"
import type { Censo } from "@/lib/types"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarCensoPage({ params }: Props) {
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

  return <EditarCensoClient censo={censo} />
}
