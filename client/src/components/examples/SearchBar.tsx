import { SearchBar } from "../SearchBar";
import { useState } from "react";

export default function SearchBarExample() {
  // todo: remove mock functionality
  const [results, setResults] = useState<any[]>([]);

  const mockSearch = (query: string) => {
    if (!query) {
      setResults([]);
      return;
    }
    setResults([
      { id: "1", type: "machine", title: "Plaza Central", subtitle: "Centro Comercial Norte" },
      { id: "2", type: "product", title: "Coca-Cola 600ml", subtitle: "Bebidas carbonatadas" },
      { id: "3", type: "employee", title: "Carlos Rodríguez", subtitle: "Abastecedor" },
    ]);
  };

  return (
    <SearchBar
      onSearch={mockSearch}
      results={results}
      onResultClick={(result) => console.log("Clicked:", result)}
    />
  );
}
