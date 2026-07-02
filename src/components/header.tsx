import { Church, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface HeaderProps {
  todayCount: number;
  totalCount: number;
}

export default function Header({ todayCount, totalCount }: HeaderProps) {
  return (
    <header className="py-4 px-4 md:px-8 border-b sticky top-0 bg-background/80 backdrop-blur-sm z-10">
      <div className="container mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg shadow-md">
            <Church className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-headline font-bold text-foreground tracking-tight">
                Misa del Día
            </h1>
            <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-sm">
                {todayCount} misas hoy
                </Badge>
                <Badge variant="outline" className="font-mono text-sm">
                {totalCount} total
                </Badge>
            </div>
            </div>
        </div>
        <Button asChild variant="outline">
            <Link href="/update">
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
            </Link>
        </Button>
      </div>
    </header>
  );
}
