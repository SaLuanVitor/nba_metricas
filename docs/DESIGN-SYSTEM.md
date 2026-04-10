# NBA Métricas - Design System

## Cores

### Cores Primárias (Times NBA)

```css
:root {
  /* Times Principais */
  --lakers-purple: #552583;
  --lakers-gold: #FDB927;
  --celtics-green: #007A33;
  --celtics-gold: #BA9653;
  --warriors-blue: #1D428A;
  --warriors-gold: #FFC72C;
  --heat-red: #98002E;
  --heat-orange: #F9A01B;
  
  /* Cores Neutras */
  --background: #09090b;
  --foreground: #fafafa;
  --card: #18181b;
  --card-foreground: #fafafa;
  --popover: #18181b;
  --popover-foreground: #fafafa;
  --primary: #552583;
  --primary-foreground: #fafafa;
  --secondary: #27272a;
  --secondary-foreground: #fafafa;
  --muted: #27272a;
  --muted-foreground: #a1a1aa;
  --accent: #27272a;
  --accent-foreground: #fafafa;
  
  /* Estados */
  --success: #22c55e;
  --success-foreground: #fafafa;
  --warning: #f59e0b;
  --warning-foreground: #18181b;
  --error: #ef4444;
  --error-foreground: #fafafa;
  --info: #3b82f6;
  --info-foreground: #fafafa;
  
  /* Border & Input */
  --border: #27272a;
  --input: #27272a;
  --ring: #552583;
  
  /* Radius */
  --radius: 0.5rem;
}
```

### Cores para Projeções e Probabilidades

```css
/* Probabilidade Over */
--over-high: #22c55e;      /* 70%+ */
--over-medium: #84cc16;    /* 55-69% */
--over-low: #eab308;       /* 45-54% */

/* Probabilidade Under */
--under-high: #ef4444;     /* 70%+ */
--under-medium: #f97316;   /* 55-69% */
--under-low: #eab308;      /* 45-54% */

/* Confiança */
--confidence-very-high: #22c55e;
--confidence-high: #84cc16;
--confidence-medium: #eab308;
--confidence-low: #f97316;
--confidence-very-low: #ef4444;

/* Tendências */
--trend-up: #22c55e;
--trend-down: #ef4444;
--trend-stable: #a1a1aa;
```

## Tipografia

```css
/* Fontes */
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
--font-display: 'Space Grotesk', system-ui, sans-serif;

/* Tamanhos */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;    /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
--text-5xl: 3rem;      /* 48px */

/* Pesos */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
```

## Espaçamento

```css
/* Scale */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

## Componentes

### StatCard

```tsx
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}
```

**Estados:**
- Default: Fundo neutro
- Success: Verde (projeções positivas)
- Warning: Amarelo (cuidado)
- Error: Vermelho (alertas, lesões)

**Exemplo de uso:**
```tsx
<StatCard
  title="Pontos Projetados"
  value="26.5"
  trend="up"
  trendValue="+2.3"
  variant="success"
/>
```

### PlayerCard

```tsx
interface PlayerCardProps {
  player: Player;
  showProjection?: boolean;
  showProbabilities?: boolean;
  onRefreshAgent?: () => void;
}
```

**Elementos:**
- Foto do jogador (ou placeholder)
- Nome e número
- Posição e equipe
- Estatísticas principais
- Projeção de pontos
- Probabilidade over/under
- Status de lesão (se aplicável)
- Botão de atualização do agente

### ProbabilityBadge

```tsx
interface ProbabilityBadgeProps {
  type: 'over' | 'under';
  probability: number;
  line: number;
  metric: 'points' | 'assists' | 'rebounds';
}
```

**Visualização:**
- Cor baseada na probabilidade
- Tamanho do badge proporcional à confiança
- Tooltip com detalhes dos fatores

### TrendIndicator

```tsx
interface TrendIndicatorProps {
  direction: 'strong-up' | 'up' | 'stable' | 'down' | 'strong-down';
  value?: number;
  label?: string;
}
```

**Ícones:**
- strong-up: ↑
- up: ↑
- stable: →
- down: ↓
- strong-down: ↓↓

### InjuryBadge

```tsx
interface InjuryBadgeProps {
  status: 'Out' | 'Questionable' | 'Probable' | 'Day-to-Day' | 'None';
  description?: string;
}
```

**Cores por status:**
- Out: Vermelho (#ef4444)
- Questionable: Amarelo (#f59e0b)
- Probable: Verde (#22c55e)
- Day-to-Day: Laranja (#f97316)

### TeamLogo

```tsx
interface TeamLogoProps {
  team: Team;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
}
```

### GameCard

```tsx
interface GameCardProps {
  game: Game;
  showOdds?: boolean;
  showProjections?: boolean;
  isLive?: boolean;
}
```

**Estados:**
- Scheduled: Cinza
- Live: Verde pulsante
- Final: Azul

### RadarChart

```tsx
interface RadarChartProps {
  player1: PlayerStats;
  player2?: PlayerStats;
  metrics: StatCategory[];
  size?: number;
}
```

### ComparisonTable

```tsx
interface ComparisonTableProps {
  players: Player[];
  metrics: StatCategory[];
  showProjections?: boolean;
  sortBy?: string;
}
```

## Layout

### Dashboard Grid

```tsx
// Grid responsivo para dashboard
const dashboardGrid = {
  mobile: 'grid-cols-1',
  tablet: 'grid-cols-2',
  desktop: 'grid-cols-4',
  wide: 'grid-cols-6',
};
```

### Sidebar

```tsx
// Navegação lateral
const sidebar = {
  width: '280px',
  collapsed: '64px',
  items: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: Users, label: 'Jogadores', href: '/players' },
    { icon: Trophy, label: 'Times', href: '/teams' },
    { icon: Calendar, label: 'Jogos', href: '/games' },
    { icon: Brain, label: 'IA', href: '/ai' },
    { icon: Settings, label: 'Configurações', href: '/settings' },
  ],
};
```

### Player Detail Page

```tsx
// Layout da página de detalhes do jogador
const playerDetailLayout = {
  header: {
    left: 'player-photo',
    center: 'player-info (name, team, position)',
    right: 'quick-stats',
  },
  tabs: ['Overview', 'Estatísticas', 'Projeções', 'Probabilidades', 'Agentes'],
  content: 'grid with stats, charts, projections',
};
```

## Animações

```css
/* Transições */
--transition-fast: 150ms ease;
--transition-normal: 200ms ease;
--transition-slow: 300ms ease;

/* Animações específicas */
@keyframes pulse-live {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes slide-up {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Classes de utilidade */
.animate-pulse-live { animation: pulse-live 2s infinite; }
.animate-slide-up { animation: slide-up 0.3s ease-out; }
.animate-fade-in { animation: fade-in 0.2s ease-out; }
```

## Responsividade

```css
/* Breakpoints */
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;

/* Mobile-first */
@media (min-width: 640px) { ... }
@media (min-width: 768px) { ... }
@media (min-width: 1024px) { ... }
@media (min-width: 1280px) { ... }
```

## Acessibilidade

### Cores e Contraste
- Todos os textos devem ter contraste mínimo de 4.5:1
- Estados de foco claramente visíveis
- Indicadores de cores acompanhados de texto/ícones

### Navegação por Teclado
- Todos os elementos interativos acessíveis por tab
- Atalhos de teclado documentados
- Focus states visíveis

### Screen Readers
- Labels semanticamente corretos
- ARIA labels onde necessário
- Estrutura de heading lógica

## Iconografia

### Ícones Utilizados (Lucide React)

```typescript
const icons = {
  // Navegação
  LayoutDashboard,
  Users,
  Trophy,
  Calendar,
  Brain,
  Settings,
  
  // Ações
  RefreshCw,
  Search,
  Filter,
  Download,
  Share,
  Bookmark,
  
  // Estados
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  AlertCircle,
  XCircle,
  
  // Esportes
  Basketball,
  PersonStanding,
  Medal,
  
  // UI
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
};
```

## Dark/Light Mode

```css
/* O sistema suporta ambos os modos */
[data-theme="dark"] {
  --background: #09090b;
  --foreground: #fafafa;
  --card: #18181b;
}

[data-theme="light"] {
  --background: #fafafa;
  --foreground: #18181b;
  --card: #ffffff;
}
```

## Testing

### Componentes testados
- [ ] StatCard
- [ ] PlayerCard
- [ ] ProbabilityBadge
- [ ] TrendIndicator
- [ ] InjuryBadge
- [ ] TeamLogo
- [ ] GameCard
- [ ] RadarChart
- [ ] ComparisonTable

### Critérios
- Snapshot tests para cada estado
- Testes de interação (click, hover)
- Testes de acessibilidade
- Testes de responsividade