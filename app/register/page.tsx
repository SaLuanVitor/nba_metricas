"use client";

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const json = await res.json();
      if (!json.success) {
        setMessage(json?.message || 'Falha no cadastro');
        return;
      }
      setMessage(json?.message || 'Cadastro enviado para aprovacao do master.');
      setPassword('');
    } catch {
      setMessage('Falha temporaria no cadastro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Cadastrar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && <div className="text-sm rounded border border-blue-500/40 bg-blue-500/10 px-3 py-2">{message}</div>}
          <form onSubmit={onSubmit} className="space-y-3">
            <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Senha (minimo 8 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </form>

          <div className="text-sm text-muted-foreground">
            Ja tem conta? <Link className="underline" href="/login">Entrar</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
