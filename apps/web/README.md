# InvoiceFlow — Frontend (`apps/web`)

Next.js 15 App Router frontend for InvoiceFlow.

## Development Commands

> **Important**: This package uses **pnpm** workspaces. Do not run `npm run dev` from the
> repo root — there is no root-level `dev` script.

### From the repo root (recommended)

```powershell
pnpm dev:web          # Start the Next.js dev server
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
```

### From `apps/web/` directly

```powershell
pnpm dev              # Next.js dev server  (http://localhost:3000)
pnpm build            # Production build
pnpm typecheck        # TypeScript check (tsc --noEmit)
pnpm test             # Unit + component tests (vitest run)
pnpm lint             # ESLint
```

### Workspace-level validation (from repo root)

```powershell
pnpm format:check     # Prettier check
pnpm lint             # All packages
pnpm build            # All packages
```

## Stack

| Tool         | Version                                   |
| ------------ | ----------------------------------------- |
| Next.js      | 15.4.3 (App Router)                       |
| React        | 19                                        |
| TypeScript   | 5 (strict)                                |
| Tailwind CSS | 4.x                                       |
| shadcn/ui    | Manual components in `src/components/ui/` |
| Vitest       | 3.x                                       |

## Structure

```
src/
├── app/              # Next.js App Router pages and layouts
│   ├── globals.css   # Design tokens (Tailwind v4 @theme)
│   └── layout.tsx    # Root layout (Inter font, metadata)
├── components/
│   ├── layout/       # Page-level structural components (Server Components)
│   │   ├── page-container.tsx
│   │   └── page-header.tsx
│   └── ui/           # shadcn/ui core components
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── empty-state.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── loading-spinner.tsx
│       ├── separator.tsx
│       ├── skeleton.tsx
│       └── sonner.tsx
├── lib/
│   └── utils.ts      # cn() utility (clsx + tailwind-merge)
├── tests/
│   ├── utils.test.ts      # Utility function tests (node environment)
│   └── components.test.tsx # Component smoke tests (jsdom environment)
└── types/
    └── ui.ts         # Shared UI prop types
```

## Adding shadcn/ui Components

Components are managed manually (not via `npx shadcn`) to avoid interactive prompts in this monorepo.
Follow the existing pattern in `src/components/ui/` and reference [shadcn/ui source](https://github.com/shadcn-ui/ui).
