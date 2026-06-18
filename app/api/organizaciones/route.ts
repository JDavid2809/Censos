import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "administrador") {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 })
    }

    // Return all organizations
    const { data: orgs, error } = await supabase
      .from("organizations")
      .select("id, name, description, created_at")
      .order("name")

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ organizations: orgs, currentOrganizationId: profile.organization_id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "administrador") {
      return NextResponse.json({ error: "Solo los administradores pueden crear organizaciones" }, { status: 403 })
    }

    const body = await request.json()
    const { action, name, description, organizationId } = body

    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    if (supabaseUrl.endsWith('/rest/v1/')) supabaseUrl = supabaseUrl.slice(0, -'/rest/v1/'.length)
    if (supabaseUrl.endsWith('/rest/v1')) supabaseUrl = supabaseUrl.slice(0, -'/rest/v1'.length)
    supabaseUrl = supabaseUrl.replace(/\/+$/, '')

    const supabaseAdmin = createAdminClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    if (action === "create") {
      if (!name?.trim()) {
        return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
      }

      const { data: newOrg, error: orgError } = await supabaseAdmin
        .from("organizations")
        .insert({ name: name.trim(), description: description?.trim() || null })
        .select()
        .single()

      if (orgError) return NextResponse.json({ error: orgError.message }, { status: 400 })

      // Log audit
      await supabaseAdmin.from("auditoria").insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        action: `Creó la organización "${name}"`,
        table_name: "organizations",
        record_id: newOrg.id,
      })

      return NextResponse.json({ success: true, organization: newOrg })
    }

    if (action === "switch") {
      if (!organizationId) {
        return NextResponse.json({ error: "organizationId es requerido" }, { status: 400 })
      }

      // Verify organization exists
      const { data: org, error: orgError } = await supabaseAdmin
        .from("organizations")
        .select("id, name")
        .eq("id", organizationId)
        .single()

      if (orgError || !org) {
        return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 })
      }

      // Update user profile to new organization
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ organization_id: organizationId })
        .eq("id", user.id)

      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

      // Log audit
      await supabaseAdmin.from("auditoria").insert({
        organization_id: organizationId,
        user_id: user.id,
        action: `Cambió a la organización "${org.name}"`,
        table_name: "profiles",
        record_id: user.id,
      })

      return NextResponse.json({ success: true, organization: org })
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
