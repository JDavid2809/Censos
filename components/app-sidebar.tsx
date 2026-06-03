"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  FileSpreadsheet,
  Database,
  Users,
  Settings,
  Upload,
  BarChart3,
  Shield,
  FileText,
  ChevronRight,
  Sparkles,
  BookTemplate,
  ClipboardList,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import type { Profile } from "@/lib/types"

interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  subItems?: { title: string; url: string; icon?: React.ComponentType<{ className?: string }> }[]
}

const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Censos",
    url: "/dashboard/censos",
    icon: Database,
    subItems: [
      { title: "Todos los censos", url: "/dashboard/censos", icon: ClipboardList },
      { title: "Nuevo censo", url: "/dashboard/censos/nuevo", icon: Sparkles },
      { title: "Plantillas", url: "/dashboard/censos/plantillas", icon: BookTemplate },
    ],
  },
  {
    title: "Registros",
    url: "/dashboard/registros",
    icon: FileSpreadsheet,
  },
  {
    title: "Importar datos",
    url: "/dashboard/importar",
    icon: Upload,
  },
  {
    title: "Calidad de datos",
    url: "/dashboard/calidad",
    icon: Shield,
  },
  {
    title: "Reportes",
    url: "/dashboard/reportes",
    icon: BarChart3,
  },
]

const adminNavItems: NavItem[] = [
  { title: "Usuarios", url: "/dashboard/usuarios", icon: Users },
  { title: "Auditoría", url: "/dashboard/auditoria", icon: FileText },
  { title: "Configuración", url: "/dashboard/configuracion", icon: Settings },
]

const roleColors: Record<string, string> = {
  administrador: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  capturista: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  analista: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  consulta: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
}

const roleLabel: Record<string, string> = {
  administrador: "Administrador",
  capturista: "Capturista",
  analista: "Analista",
  consulta: "Consulta",
}

interface AppSidebarProps {
  profile: Profile | null
}

export function AppSidebar({ profile }: AppSidebarProps) {
  const pathname = usePathname()
  const isAdmin = profile?.role === "administrador"

  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]]
    .filter(Boolean).join("").toUpperCase() || "U"

  return (
    <Sidebar className="border-r border-sidebar-border/60">
      {/* ── Logo / Brand ── */}
      <SidebarHeader className="px-4 py-4 border-b border-sidebar-border/60">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm group-hover:shadow-md transition-shadow">
            <Database className="h-4.5 w-4.5" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-sidebar" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight leading-none">DeepMap</span>
            <p className="text-[10px] text-sidebar-foreground/50 mt-0.5 leading-none">Sistema de Censos</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {/* ── Main Navigation ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] tracking-widest font-semibold text-sidebar-foreground/40 uppercase px-2 mb-1">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {mainNavItems.map((item) => {
                const isActive = item.url === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.url)

                return (
                  <SidebarMenuItem key={item.title}>
                    {item.subItems ? (
                      <Collapsible defaultOpen={pathname.startsWith(item.url)}>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            className={`group/btn w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            }`}
                          >
                            <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                            <span className="flex-1">{item.title}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/40 transition-transform duration-200 group-data-[state=open]/btn:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border/60 pl-3">
                            {item.subItems.map((sub) => {
                              const SubIcon = sub.icon
                              const subActive = pathname === sub.url
                              return (
                                <SidebarMenuSubItem key={sub.title}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={subActive}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all ${
                                      subActive
                                        ? "text-primary font-medium bg-primary/8"
                                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                                    }`}
                                  >
                                    <Link href={sub.url} className="flex items-center gap-2">
                                      {SubIcon && <SubIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                                      {sub.title}
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              )
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <Link href={item.url} className="flex items-center gap-2.5">
                          <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                          <span>{item.title}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="ml-auto text-xs py-0 px-1.5 h-4">{item.badge}</Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Admin Navigation ── */}
        {isAdmin && (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-[10px] tracking-widest font-semibold text-sidebar-foreground/40 uppercase px-2 mb-1">
              Administración
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {adminNavItems.map((item) => {
                  const isActive = pathname.startsWith(item.url)
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <Link href={item.url} className="flex items-center gap-2.5">
                          <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* ── User Footer ── */}
      <SidebarFooter className="p-3 border-t border-sidebar-border/60">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors cursor-default">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
              {initials}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-sidebar-accent" />
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">
              {profile?.first_name} {profile?.last_name}
            </p>
            <span className={`inline-block text-[10px] font-medium px-1.5 py-0 rounded-full mt-0.5 ${roleColors[profile?.role || ""] || "bg-muted text-muted-foreground"}`}>
              {roleLabel[profile?.role || ""] || profile?.role || "Usuario"}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
