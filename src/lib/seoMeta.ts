export function setMetaContent(selector: string, content: string, attr: "name" | "property" = "name") {
  let meta = document.querySelector<HTMLMetaElement>(selector);

  if (!meta) {
    meta = document.createElement("meta");
    const match = selector.match(/\[(?:name|property)="([^"]+)"\]/);
    meta.setAttribute(attr, match?.[1] ?? "");
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", content);
}
