"use client";

import { Suspense, FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(params.get('message'));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setMessage(json?.message || 'Falha no login');
        return;
      }
      const next = params.get('next') || '/';
      router.push(next);
      router.refresh();
    } catch {
      setMessage('Falha temporaria no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && <div className="text-sm rounded border border-yellow-500/40 bg-yellow-500/10 px-3 py-2">{message}</div>}
          <form onSubmit={onSubmit} className="space-y-3">
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <Button variant="outline" className="w-full" asChild>
            <a href="/api/auth/google">Entrar com Google</a>
          </Button>

          <div className="text-sm text-muted-foreground">
            Nao tem conta? <Link className="underline" href="/register">Cadastre-se</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto py-10">
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Carregando...</CardContent>
          </Card>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
