import { useEffect, type ReactNode, type Ref } from "react";

export type ModelPageName = "ray" | "normal" | "pe";

/** Owns the document metadata and the CSS scope shared by every model page. */
export function PageDocument({
  page,
  title,
  children,
  rootRef,
}: {
  readonly page: ModelPageName;
  readonly title: string;
  readonly children: ReactNode;
  readonly rootRef?: Ref<HTMLDivElement>;
}) {
  useEffect(() => {
    document.title = title;
  }, [title]);

  return <div ref={rootRef} data-ooa-page={page}>{children}</div>;
}
