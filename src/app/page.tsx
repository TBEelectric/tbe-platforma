import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Temporary style check; replaced by the launcher in the next task.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Ukázka stylu TBE</h1>
      <Card>
        <CardHeader>
          <CardTitle>Intervaly dne</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="soft">Montáž</Badge>
            <Badge variant="info">Cesta</Badge>
            <Badge variant="neutral">Přestávka</Badge>
            <Badge variant="warning">Chybí</Badge>
            <Badge variant="success">OK</Badge>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="note">Poznámka</Label>
            <Input id="note" placeholder="Volitelné" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button>Přidat</Button>
            <Button variant="outline">Dnes</Button>
            <Button variant="outline" size="icon" aria-label="Čas">
              <Clock />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Sekundární text · příliš žluťoučký kůň
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
