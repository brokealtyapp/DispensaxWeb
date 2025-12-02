import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Command } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SearchResult {
  id: string;
  type: "machine" | "product" | "employee" | "task";
  title: string;
  subtitle: string;
}

interface SearchBarProps {
  onSearch?: (query: string) => void;
  results?: SearchResult[];
  onResultClick?: (result: SearchResult) => void;
}

export function SearchBar({ onSearch, results = [], onResultClick }: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch?.(value);
  };

  const handleResultClick = (result: SearchResult) => {
    onResultClick?.(result);
    setIsOpen(false);
    setQuery("");
  };

  const typeLabels: Record<SearchResult["type"], string> = {
    machine: "Máquina",
    product: "Producto",
    employee: "Empleado",
    task: "Tarea",
  };

  return (
    <>
      <Button
        variant="outline"
        className="w-full max-w-sm justify-start text-muted-foreground gap-2"
        onClick={() => setIsOpen(true)}
        data-testid="button-search"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          <Command className="h-3 w-3" />K
        </kbd>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl p-0">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle className="sr-only">Buscar</DialogTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="Buscar máquinas, productos, empleados..."
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 pr-10 border-0 border-b rounded-none focus-visible:ring-0"
                data-testid="input-search-modal"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => handleSearch("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto p-2">
            {query && results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No se encontraron resultados para "{query}"
              </p>
            ) : query ? (
              <div className="space-y-1">
                {results.map((result) => (
                  <button
                    key={result.id}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent text-left"
                    onClick={() => handleResultClick(result)}
                    data-testid={`search-result-${result.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      {typeLabels[result.type]}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Escribe para buscar...
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
