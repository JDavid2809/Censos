import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify the requesting user is an admin
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("id", caller.id)
      .single()

    if (callerProfile?.role !== "administrador") {
      return NextResponse.json({ error: "Solo los administradores pueden crear usuarios" }, { status: 403 })
    }

    const body = await request.json()
    console.log("API /usuarios/crear - BODY:", body)
    const { email, password, first_name, last_name, role } = body

    if (!email || !password || !first_name) {
      return NextResponse.json({ error: "Email, contraseña y nombre son requeridos" }, { status: 400 })
    }

    const validRoles = ["administrador", "capturista", "analista", "consulta"]
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 })
    }

    // Use Supabase Admin client to create user without needing email confirmation
    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    if (supabaseUrl.endsWith('/rest/v1/')) supabaseUrl = supabaseUrl.slice(0, -'/rest/v1/'.length)
    if (supabaseUrl.endsWith('/rest/v1')) supabaseUrl = supabaseUrl.slice(0, -'/rest/v1'.length)
    supabaseUrl = supabaseUrl.replace(/\/+$/, '')

    const supabaseAdmin = createAdminClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name: last_name || "",
        role,
        organization_id: callerProfile.organization_id,
      },
    })

    if (createError) {
      console.error("API /usuarios/crear - SUPABASE CREATE ERROR:", createError)
      return NextResponse.json({ error: createError.message, details: createError }, { status: 400 })
    }

    if (!newUser.user) {
      return NextResponse.json({ error: "No se pudo crear el usuario" }, { status: 500 })
    }

    // Upsert profile for the new user, assigning them to the same organization
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newUser.user.id,
        first_name,
        last_name: last_name || null,
        role,
        organization_id: callerProfile.organization_id,
      })

    if (profileError) {
      console.error("API /usuarios/crear - PROFILE UPSERT ERROR:", profileError)
      // Rollback user creation if profile fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json({ error: profileError.message, details: profileError }, { status: 500 })
    }

    // Log audit
    await supabaseAdmin.from("auditoria").insert({
      organization_id: callerProfile.organization_id,
      user_id: caller.id,
      action: `Creó el usuario "${first_name} ${last_name}" con rol "${role}"`,
      table_name: "profiles",
      record_id: newUser.user.id,
    })

    return NextResponse.json({
      success: true,
      user: { id: newUser.user.id, email, first_name, last_name, role },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error interno del servidor" }, { status: 500 })
  }
}
