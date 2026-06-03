"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { 
  LogOut, 
  User, 
  Settings, 
  Bell, 
  Building2, 
  ChevronDown, 
  Plus, 
  Check,
  Loader2
} from "lucide-react"
import type { Profile, Organization } from "@/lib/types"

interface DashboardHeaderProps {
  profile: Profile | null
  organization: Organization | null
}

interface OrgOption {
  id: string
  name: string
}

export function DashboardHeader({ profile, organization }: DashboardHeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const isAdmin = profile?.role === "administrador"

  // Organizations list state
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [currentOrg, setCurrentOrg] = useState<OrgOption | null>(organization ? { id: organization.id, name: organization.name } : null)
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null)

  // Create org dialog
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false)
  const [newOrgName, setNewOrgName] = useState("")
  const [newOrgDesc, setNewOrgDesc] = useState("")
  const [createOrgError, setCreateOrgError] = useState<string | null>(null)
  const [creatingOrg, setCreatingOrg] = useState(false)

  async function fetchOrgs() {
    if (!isAdmin) return
    setLoadingOrgs(true)
    try {
      const res = await fetch("/api/organizaciones")
      if (res.ok) {
        const data = await res.json()
        setOrgs(data.organizations || [])
      }
    } finally {
      setLoadingOrgs(false)
    }
  }

  async function handleSwitchOrg(orgId: string) {
    if (orgId === currentOrg?.id) return
    setSwitchingOrgId(orgId)
    try {
      const res = await fetch("/api/organizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switch", organizationId: orgId }),
      })
      if (res.ok) {
        const data = await res.json()
        setCurrentOrg({ id: data.organization.id, name: data.organization.name })
        router.refresh()
      }
    } finally {
      setSwitchingOrgId(null)
    }
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!newOrgName.trim()) {
      setCreateOrgError("El nombre es requerido")
      return
    }
    setCreatingOrg(true)
    setCreateOrgError(null)
    try {
      const res = await fetch("/api/organizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: newOrgName, description: newOrgDesc }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateOrgError(data.error || "Error al crear organización")
        return
      }
      setOrgs((prev) => [...prev, { id: data.organization.id, name: data.organization.name }])
      setIsCreateOrgOpen(false)
      setNewOrgName("")
      setNewOrgDesc("")
    } finally {
      setCreatingOrg(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <>
      <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
        <SidebarTrigger />

        <div className="flex-1 flex items-center gap-2">
          {isAdmin ? (
            <DropdownMenu onOpenChange={(open) => { if (open) fetchOrgs() }}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto py-1 px-2 gap-1.5 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{currentOrg?.name || "Mi Organización"}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal uppercase tracking-wider pb-1">
                  Organizaciones
                </DropdownMenuLabel>
                {loadingOrgs ? (
                  <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Cargando...
                  </div>
                ) : (
                  orgs.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => handleSwitchOrg(org.id)}
                      className="flex items-center justify-between"
                    >
                      <span className="truncate">{org.name}</span>
                      {switchingOrgId === org.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin ml-2 flex-shrink-0" />
                      ) : currentOrg?.id === org.id ? (
                        <Check className="h-3.5 w-3.5 text-primary ml-2 flex-shrink-0" />
                      ) : null}
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsCreateOrgOpen(true)}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva organización
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{currentOrg?.name || "Mi Organización"}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            <span className="sr-only">Notificaciones</span>
          </Button>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">
                  <span className="text-sm font-medium">
                    {profile?.first_name?.[0] || "U"}
                    {profile?.last_name?.[0] || ""}
                  </span>
                </div>
                <span className="sr-only">Menú de usuario</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{profile?.first_name} {profile?.last_name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {profile?.role}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Mi perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuración</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Create Organization Dialog */}
      <Dialog open={isCreateOrgOpen} onOpenChange={(open) => { setIsCreateOrgOpen(open); if (!open) { setNewOrgName(""); setNewOrgDesc(""); setCreateOrgError(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear nueva organización</DialogTitle>
            <DialogDescription>
              Crea una organización adicional para separar tus proyectos de censo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateOrg} className="space-y-4 py-2">
            {createOrgError && (
              <Alert variant="destructive">
                <AlertDescription>{createOrgError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="org_name">Nombre *</Label>
              <Input
                id="org_name"
                placeholder="Ej: Municipio de Tetztoyocan"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                disabled={creatingOrg}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org_desc">Descripción (opcional)</Label>
              <Textarea
                id="org_desc"
                placeholder="Describe el propósito de esta organización..."
                value={newOrgDesc}
                onChange={(e) => setNewOrgDesc(e.target.value)}
                disabled={creatingOrg}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOrgOpen(false)} disabled={creatingOrg}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creatingOrg}>
                {creatingOrg && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear organización
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
