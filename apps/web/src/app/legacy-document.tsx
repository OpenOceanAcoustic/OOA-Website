import { useEffect, type ReactNode } from "react";

function bodyMarkup(documentSource: string): string {
  const body = documentSource.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (body === undefined) throw new Error("Legacy document is missing a body element");
  return body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

export function LegacyDocument({
  documentSource,
  page,
  title,
  after,
}: {
  readonly documentSource: string;
  readonly page: "ray" | "normal" | "pe";
  readonly title: string;
  readonly after?: ReactNode;
}) {
  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <div data-ooa-page={page}>
      <div dangerouslySetInnerHTML={{ __html: bodyMarkup(documentSource) }} />
      {after}
    </div>
  );
}
