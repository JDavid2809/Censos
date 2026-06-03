"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Loader2, 
  UserPlus, 
  Users, 
  ShieldCheck, 
  Eye, 
  BarChart2, 
  Edit3,
  Trash2,
  RefreshCcw
} from "lucide-react"
import type { Profile } from "@/lib/types"

interface GestionUsuariosClientProps {
  initialProfiles: Profile[]
  currentUserId: string
}

const roleLabels: Record<string, string> = {
  administrador: "Administrador",
  capturista: "Capturista",
  analista: "Analista",
  consulta: "Consulta",
}

const roleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  administrador: ShieldCheck,
  capturista: Edit3,
  analista: BarChart2,
  consulta: Eye,
}

const roleColors: Record<string, string> = {
  administrador: "bg-violet-500/10 text-violet-600 border-violet-200",
  capturista: "bg-blue-500/10 text-blue-600 border-blue-200",
  analista: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  consulta: "bg-amber-500/10 text-amber-600 border-amber-200",
}

export function GestionUsuariosClient({ initialProfiles, currentUserId }: GestionUsuariosClientProps) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("capturista")

  function resetForm() {
    setFirstName("")
    setLastName("")
    setEmail("")
    setPassword("")
    setRole("capturista")
    setError(null)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName || !email || !password) {
      setError("Nombre, email y contraseña son requeridos")
      return
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/usuarios/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName, role }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Error al crear el usuario")
        return
      }

      // Add new profile to list
      const newProfile: Profile = {
        id: data.user.id,
        organization_id: null,
        first_name: firstName,
        last_name: lastName,
        role: role as Profile["role"],
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setProfiles((prev) => [newProfile, ...prev])
      setSuccessMsg(`Usuario "${firstName} ${lastName}" creado exitosamente`)
      setIsDialogOpen(false)
      resetForm()

      setTimeout(() => setSuccessMsg(null), 4000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const roleCounts = Object.keys(roleLabels).reduce<Record<string, number>>((acc, r) => {
    acc[r] = profiles.filter((p) => p.role === r).length
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-muted-foreground">Gestiona los miembros de tu organización</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Nuevo usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Agregar nuevo usuario</DialogTitle>
              <DialogDescription>
                El usuario será creado en tu organización y podrá iniciar sesión de inmediato.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4 py-2">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Nombre *</Label>
                  <Input
                    id="first_name"
                    placeholder="Juan"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Apellido</Label>
                  <Input
                    id="last_name"
                    placeholder="García"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select value={role} onValueChange={setRole} disabled={isSubmitting}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="capturista">Capturista – Puede capturar registros</SelectItem>
                    <SelectItem value="analista">Analista – Puede ver y exportar datos</SelectItem>
                    <SelectItem value="consulta">Consulta – Solo lectura</SelectItem>
                    <SelectItem value="administrador">Administrador – Acceso total</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear usuario
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {successMsg && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Role summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(roleLabels).map(([r, label]) => {
          const IconComp = roleIcons[r] || Users
          return (
            <Card key={r}>
              <CardContent className="flex items-center gap-3 pt-5 pb-5">
                <div className={`p-2 rounded-lg ${roleColors[r]?.split(" ").slice(0, 1).join(" ") || "bg-muted"}`}>
                  <IconComp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{label}s</p>
                  <p className="text-2xl font-bold">{roleCounts[r] || 0}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle>Miembros del equipo</CardTitle>
          <CardDescription>
            {profiles.length} usuario{profiles.length !== 1 ? "s" : ""} en esta organización
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <div className="text-center py-16">
              <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="font-medium text-muted-foreground">No hay usuarios aún</p>
              <p className="text-sm text-muted-foreground mt-1">
                Haz clic en <strong>Nuevo usuario</strong> para agregar miembros a tu organización.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Registro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id} className={profile.id === currentUserId ? "bg-muted/30" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-primary">
                            {profile.first_name?.[0]?.toUpperCase() || "U"}
                            {profile.last_name?.[0]?.toUpperCase() || ""}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {profile.first_name} {profile.last_name}
                            {profile.id === currentUserId && (
                              <span className="ml-2 text-xs text-muted-foreground font-normal">(Tú)</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${roleColors[profile.role] || "bg-muted"}`}>
                        {roleLabels[profile.role] || profile.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(profile.created_at).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
