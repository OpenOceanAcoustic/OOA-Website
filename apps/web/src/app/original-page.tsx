import {
  Fragment,
  createElement,
  useEffect,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";

const attributeNames: Readonly<Record<string, string>> = Object.freeze({
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  colspan: "colSpan",
  rowspan: "rowSpan",
  maxlength: "maxLength",
  readonly: "readOnly",
  "stop-color": "stopColor",
  "stop-opacity": "stopOpacity",
  "marker-start": "markerStart",
  "marker-end": "markerEnd",
  "stroke-width": "strokeWidth",
  "fill-rule": "fillRule",
});

const booleanAttributes = new Set([
  "autofocus", "checked", "disabled", "hidden", "multiple", "readonly",
  "required", "selected",
]);

function styleProperties(value: string): CSSProperties {
  const result: Record<string, string> = {};
  for (const declaration of value.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 0) continue;
    const property = declaration.slice(0, separator).trim();
    const propertyValue = declaration.slice(separator + 1).trim();
    if (!property || !propertyValue) continue;
    const reactProperty = property.startsWith("--")
      ? property
      : property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    result[reactProperty] = propertyValue;
  }
  return result as CSSProperties;
}

function elementProperties(element: Element, key: string): Record<string, unknown> {
  const result: Record<string, unknown> = { key };
  const tag = element.localName;
  for (const attribute of element.attributes) {
    const name = attribute.name.toLowerCase();
    if (name === "style") {
      result.style = styleProperties(attribute.value);
      continue;
    }
    if (name === "selected" && tag === "option") continue;
    if (name === "checked" && tag === "input") {
      result.defaultChecked = true;
      continue;
    }
    if (name === "value" && (tag === "input" || tag === "textarea")) {
      result.defaultValue = attribute.value;
      continue;
    }
    const reactName = attributeNames[name] ?? attribute.name;
    result[reactName] = booleanAttributes.has(name) ? true : attribute.value;
  }
  if (tag === "select") {
    const selected = element.querySelector("option[selected]");
    if (selected !== null) result.defaultValue = selected.getAttribute("value") ?? selected.textContent ?? "";
  }
  return result;
}

function reactNode(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element = node as Element;
  if (element.localName === "script") return null;
  const children = Array.from(element.childNodes, (child, index) => reactNode(child, `${key}.${index}`));
  return createElement(element.localName, elementProperties(element, key), ...children);
}

function documentBody(documentSource: string): ReactNode {
  const parsed = new DOMParser().parseFromString(documentSource, "text/html");
  if (parsed.querySelector("parsererror") !== null) throw new Error("Original page document is invalid HTML");
  return Array.from(parsed.body.childNodes, (node, index) => reactNode(node, String(index)));
}

/** Mechanical React rendering of the accepted original document structure. */
export function OriginalPage({
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
  const body = useMemo(() => documentBody(documentSource), [documentSource]);

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <div data-ooa-page={page}>
      <Fragment>{body}</Fragment>
      {after}
    </div>
  );
}
