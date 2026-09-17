export default function PageHeader({ icon: Icon, title, actions, children }) {
  return (
    <header className="flex shrink-0 flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 font-display text-xl text-ink sm:text-2xl">
          {Icon ? <Icon className="size-6 shrink-0" aria-hidden="true" /> : null}
          {title}
        </h1>
        {children}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
