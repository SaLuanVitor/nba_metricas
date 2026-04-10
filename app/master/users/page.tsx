"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type PendingUser = {
  id: string;
  email: string;
  name: string;
  provider: 'credentials' | 'google';
  status: string;
  createdAt: string;
};

export default function MasterUsersPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadPendingUsers() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/master/users?status=pending', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setMessage({ type: 'error', text: json?.message || 'Falha ao carregar pendentes' });
        setUsers([]);
      } else {
        setUsers(json.data || []);
      }
    } catch {
      setMessage({ type: 'error', text: 'Falha ao carregar pendentes' });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPendingUsers();
  }, []);

  async function moderateUser(userId: string, action: 'approve' | 'reject') {
    const actionLabel = action === 'approve' ? 'aprovar' : 'rejeitar';
    const confirmed = window.confirm(`Tem certeza que deseja ${actionLabel} este usuario?`);
    if (!confirmed) return;

    setMessage(null);
    try {
      const res = await fetch(`/api/master/users/${userId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setMessage({ type: 'error', text: json?.message || 'Falha ao atualizar usuario' });
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setMessage({
        type: 'success',
        text: action === 'approve' ? 'Usuario aprovado com sucesso.' : 'Usuario rejeitado com sucesso.',
      });
    } catch {
      setMessage({ type: 'error', text: 'Falha ao atualizar usuario' });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Aprovacao de Usuarios</h1>
        <p className="text-muted-foreground">Rota oculta de moderacao (master).</p>
      </div>

      {message && (
        <div
          className={
            message.type === 'success'
              ? 'text-sm rounded border border-green-500/40 bg-green-500/10 px-3 py-2'
              : 'text-sm rounded border border-yellow-500/40 bg-yellow-500/10 px-3 py-2'
          }
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pendentes ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">Carregando...</div>}
          {!loading && users.length === 0 && <div className="text-sm text-muted-foreground">Sem usuarios pendentes.</div>}

          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="border rounded p-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                  <div className="text-xs text-muted-foreground">provider: {user.provider} • {new Date(user.createdAt).toLocaleString('pt-BR')}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => moderateUser(user.id, 'approve')}>Aprovar</Button>
                  <Button size="sm" variant="destructive" onClick={() => moderateUser(user.id, 'reject')}>Rejeitar</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
