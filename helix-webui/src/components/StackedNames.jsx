export default function StackedNames({ items }) {
  if (!items?.length) {
    return <span className="text-sm text-muted">—</span>;
  }
  return (
    <span className="flex flex-col gap-0.5 text-sm leading-snug text-ink">
      {items.map((label, index) => (
        <span key={`${label}-${index}`}>{label}</span>
      ))}
    </span>
  );
}
