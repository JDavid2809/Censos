import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Database } from "lucide-react"

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary text-primary-foreground">
              <Database className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Error de autenticación</CardTitle>
          <CardDescription>
            Hubo un problema al procesar tu solicitud
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            El enlace puede haber expirado o ya fue utilizado. 
            Por favor, intenta nuevamente o contacta a soporte si el problema persiste.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link href="/auth/login">Volver al inicio de sesión</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/auth/sign-up">Crear nueva cuenta</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
