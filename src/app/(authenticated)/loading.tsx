export default function Loading() {
  return (
    <div aria-live="polite" className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-12 max-w-md rounded-md bg-muted" />
      <div className="space-y-3 rounded-lg border p-4">
        <div className="h-10 rounded bg-muted" />
        <div className="h-10 rounded bg-muted" />
        <div className="h-10 rounded bg-muted" />
      </div>
      <span className="sr-only">Carregando página...</span>
    </div>
  )
}
