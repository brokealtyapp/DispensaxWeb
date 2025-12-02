import { ProductCard } from "../ProductCard";

export default function ProductCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
      <ProductCard
        id="1"
        name="Coca-Cola 600ml"
        quantity={45}
        maxQuantity={50}
        price={18.50}
        expiryDate="2025-03-15"
        onClick={() => console.log("Product clicked")}
      />
      <ProductCard
        id="2"
        name="Agua Mineral 500ml"
        quantity={12}
        maxQuantity={50}
        price={12.00}
        expiryDate="2025-01-10"
        isLowStock
      />
      <ProductCard
        id="3"
        name="Sprite 355ml"
        quantity={8}
        maxQuantity={40}
        price={15.00}
        isLowStock
      />
      <ProductCard
        id="4"
        name="Jugo de Naranja 350ml"
        quantity={30}
        maxQuantity={35}
        price={22.50}
        expiryDate="2025-02-28"
      />
    </div>
  );
}
