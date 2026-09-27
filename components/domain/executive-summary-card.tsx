import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatKobo } from "@/lib/format";

export function ExecutiveSummaryCard({
  borrower,
  product,
  requestedKobo,
  recommendedKobo,
  decision,
  rateLine,
  reasons,
  conditions,
}: {
  borrower: string;
  product: string;
  requestedKobo: number;
  recommendedKobo: number;
  decision: string;
  rateLine: string;
  reasons: string;
  conditions: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Executive summary</CardTitle>
        <CardDescription>Decision-maker view — recommendation first, detail on demand.</CardDescription>
      </CardHeader>
      <CardContent className="num space-y-1.5 text-sm">
        <p><span className="font-semibold text-ink">Borrower: </span>{borrower}</p>
        <p><span className="font-semibold text-ink">Product: </span>{product}</p>
        <p><span className="font-semibold text-ink">Requested: </span>{formatKobo(requestedKobo)}</p>
        <p><span className="font-semibold text-ink">Recommended: </span>{formatKobo(recommendedKobo)}</p>
        <p><span className="font-semibold text-ink">Decision: </span>{decision}</p>
        <p><span className="font-semibold text-ink">Rate: </span>{rateLine}</p>
        <p><span className="font-semibold text-ink">Key reasons: </span>{reasons}</p>
        <p><span className="font-semibold text-ink">Conditions: </span>{conditions}</p>
      </CardContent>
    </Card>
  );
}
