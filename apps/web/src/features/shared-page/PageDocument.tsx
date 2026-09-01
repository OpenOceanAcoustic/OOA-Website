import { useEffect, type ReactNode } from "react";

export type ModelPageName = "ray" | "normal" | "pe";

/** Owns the document metadata and the CSS scope shared by every model page. */
export function PageDocument({
  page,
  title,
  children,
}: {
  readonly page: ModelPageName;
  readonly title: string;
  readonly children: ReactNode;
}) {
  useEffect(() => {
    document.title = title;
  }, [title]);

  return <div data-ooa-page={page}>{children}</div>;
}
