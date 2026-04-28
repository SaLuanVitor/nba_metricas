"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Activity, Users, GitCompare, TrendingUp, Shield, Bot, Target, CalendarDays } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const navigation = [
  { name: "Dashboard", href: "/", icon: Activity },
  { name: "Hoje", href: "/today", icon: CalendarDays },
  { name: "Times", href: "/teams", icon: Shield },
  { name: "Jogadores", href: "/players", icon: Users },
  { name: "IA Analysis", href: "/ai", icon: Bot },
  { name: "Predicoes", href: "/predictions", icon: Target },
  { name: "Comparar", href: "/compare", icon: GitCompare },
]

type SessionUser = {
  id: string
  name: string
  email: string
  role: "master" | "user"
  status: "pending" | "approved" | "rejected"
}

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState("")
  const [profileEmail, setProfileEmail] = useState("")
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const isAuthPage = pathname === "/login" || pathname === "/register"
  const isMaster = sessionUser?.role === "master"

  const welcomeName = useMemo(() => {
    const fullName = String(sessionUser?.name || "").trim()
    if (!fullName) return "Usuario"
    return fullName.split(" ")[0]
  }, [sessionUser?.name])

  const userInitial = useMemo(() => {
    const fullName = String(sessionUser?.name || "").trim()
    if (fullName) return fullName[0].toUpperCase()
    const email = String(sessionUser?.email || "").trim()
    if (email) return email[0].toUpperCase()
    return "U"
  }, [sessionUser?.name, sessionUser?.email])

  useEffect(() => {
    if (isAuthPage) return
    let active = true
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!active) return
        if (json?.authenticated && json?.data?.user) {
          setSessionUser(json.data.user as SessionUser)
        } else {
          setSessionUser(null)
        }
      })
      .catch(() => {
        if (active) setSessionUser(null)
      })
    return () => {
      active = false
    }
  }, [isAuthPage, pathname])

  useEffect(() => {
    if (!profileOpen || !sessionUser) return
    setProfileName(sessionUser.name || "")
    setProfileEmail(sessionUser.email || "")
    setProfileMessage(null)
  }, [profileOpen, sessionUser])

  async function logout() {
    setLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null)
    router.push("/login")
    router.refresh()
    setLoggingOut(false)
  }

  async function saveProfile() {
    if (!sessionUser) return
    setSavingProfile(true)
    setProfileMessage(null)
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.success) {
        setProfileMessage(json?.message || "Nao foi possivel salvar os dados")
        return
      }
      setSessionUser(json.data.user as SessionUser)
      setProfileMessage("Perfil atualizado com sucesso")
    } catch {
      setProfileMessage("Falha temporaria ao atualizar perfil")
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <>
    {!isAuthPage && (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">NBA Stats</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== "/" && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                )
              })}
              {isMaster && (
                <Link
                  href="/master/users"
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    pathname.startsWith("/master")
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  <Shield className="h-4 w-4" />
                  Aprovar Usuarios
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span>Ao vivo</span>
            </div>
            {sessionUser && (
              <div className="hidden md:flex items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setProfileOpen(true)}
                  className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold hover:bg-primary/30 transition-colors"
                  title="Editar perfil"
                >
                  {userInitial}
                </button>
                <span className="text-muted-foreground">
                  Bem-vindo, <span className="text-foreground font-medium">{welcomeName}</span>
                </span>
              </div>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="text-sm text-muted-foreground hover:text-foreground"
                  type="button"
                  disabled={loggingOut}
                >
                  {loggingOut ? "Saindo..." : "Sair"}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar saida</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deseja realmente sair da sua conta agora?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={logout}>
                    Sim, sair
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile navigation */}
        <nav className="flex md:hidden items-center gap-1 pb-3 overflow-x-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
          {isMaster && (
            <Link
              href="/master/users"
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                pathname.startsWith("/master")
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Shield className="h-4 w-4" />
              Aprovar Usuarios
            </Link>
          )}
        </nav>
      </div>
    </header>
    )}
    <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>
            Atualize seus dados. O nivel de perfil e somente leitura.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Nome</Label>
            <Input
              id="profile-name"
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              placeholder="Seu nome"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={profileEmail}
              onChange={(event) => setProfileEmail(event.target.value)}
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-role">Nivel de perfil</Label>
            <Input
              id="profile-role"
              value={sessionUser?.role === "master" ? "Master" : "Usuario"}
              readOnly
              disabled
            />
          </div>
          {profileMessage && (
            <p className="text-sm text-muted-foreground">{profileMessage}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setProfileOpen(false)}
          >
            Fechar
          </Button>
          <Button
            type="button"
            onClick={saveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
