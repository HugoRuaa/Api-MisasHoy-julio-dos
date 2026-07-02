import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { updateAllChannels } from '@/lib/youtube';
import { Server, CheckCircle2 } from 'lucide-react';

// This page is not publicly linked. It's an endpoint for manual or cron-job updates.
export const revalidate = 0; // Ensure this page is always dynamically rendered

export default async function UpdatePage() {
  const message = await updateAllChannels();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto bg-green-100 rounded-full p-3 w-fit dark:bg-green-900/50">
             <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="mt-4 text-2xl">Proceso de Actualización</CardTitle>
          <CardDescription>
            La base de datos se ha sincronizado con YouTube.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm p-4 bg-muted rounded-md">{message}</p>
          <Button asChild className="mt-6">
            <Link href="/">Volver a la página principal</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
