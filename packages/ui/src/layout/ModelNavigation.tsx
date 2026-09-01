export interface ModelNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly active: boolean;
}

export function ModelNavigation({
  items,
  className = "mode-nav",
  ariaLabel,
}: {
  readonly items: readonly ModelNavigationItem[];
  readonly className?: string;
  readonly ariaLabel?: string;
}) {
  return (
    <nav className={className} aria-label={ariaLabel}>
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className={item.active ? "active" : undefined}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
