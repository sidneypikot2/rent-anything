import { type JsonLdNode, jsonLdText } from "@/lib/json-ld";

// schema.org JSON-LD for a page (RAA-241), server-rendered into its HTML. Escaped by
// jsonLdText, so text from the API can't close the script.
export function JsonLd({ nodes }: { nodes: JsonLdNode[] }) {
  return <script type="application/ld+json" data-testid="json-ld" dangerouslySetInnerHTML={{ __html: jsonLdText(nodes) }} />;
}
