import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { GestionUsuariosClient } from "@/components/gestion-usuarios-client"

export default async function UsuariosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  // Check if user is admin
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (currentProfile?.role !== "administrador") {
    redirect("/dashboard")
  }

  // Get all users in the same organization
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("organization_id", currentProfile.organization_id)
    .order("created_at", { ascending: false })

  return (
    <GestionUsuariosClient
      initialProfiles={profiles || []}
      currentUserId={user.id}
    />
  )
}
