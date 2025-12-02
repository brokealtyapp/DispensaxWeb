import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle } from "lucide-react";

interface ProductCardProps {
  id: string;
  name: string;
  quantity: number;
  maxQuantity: number;
  price: number;
  expiryDate?: string;
  isLowStock?: boolean;
  onClick?: () => void;
}

export function ProductCard({
  id,
  name,
  quantity,
  maxQuantity,
  price,
  expiryDate,
  isLowStock,
  onClick,
}: ProductCardProps) {
  const stockPercentage = (quantity / maxQuantity) * 100;
  const isExpiringSoon = expiryDate && new Date(expiryDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return (
    <Card
      className={`hover-elevate cursor-pointer ${isLowStock ? "border-amber-500/50" : ""}`}
      onClick={onClick}
      data-testid={`card-product-${id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-3 rounded-lg ${isLowStock ? "bg-amber-500/10 text-amber-500" : "bg-muted"}`}>
            <Package className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm truncate">{name}</h4>
              {isLowStock && (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 text-xs shrink-0">
                  Bajo Stock
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cantidad:</span>
              <span className={`font-medium ${isLowStock ? "text-amber-500" : ""}`}>
                {quantity} / {maxQuantity}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  stockPercentage < 25
                    ? "bg-destructive"
                    : stockPercentage < 50
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${stockPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Precio: ${price.toFixed(2)}</span>
              {expiryDate && (
                <span className={`flex items-center gap-1 ${isExpiringSoon ? "text-amber-500" : ""}`}>
                  {isExpiringSoon && <AlertTriangle className="h-3 w-3" />}
                  Vence: {expiryDate}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
