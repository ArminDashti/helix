export default function IconButton({
  icon: Icon,
  children,
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={["inline-flex items-center justify-center gap-2", className].join(
        " ",
      )}
      {...props}
    >
      {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
