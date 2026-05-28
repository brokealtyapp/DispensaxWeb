import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { NOMBRES_BANCOS } from "@/lib/bancos-por-pais";

const bankAccountFormSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  bankName: z.string().optional(),
  accountType: z.enum(["banco", "tarjeta_credito", "efectivo"]),
  accountSubtype: z.enum(["corriente", "ahorros", "credito", "caja"]).optional(),
  currency: z.enum(["DOP", "USD"]).default("DOP"),
  accountNumber: z.string().optional(),
  balance: z.string().optional(),
  creditLimit: z.string().optional(),
  statementClosingDay: z.coerce.number().min(1).max(31).optional().nullable(),
  paymentDueDay: z.coerce.number().min(1).max(31).optional().nullable(),
  alertThreshold: z.string().optional(),
  notes: z.string().optional(),
});

type BankAccountFormValues = z.infer<typeof bankAccountFormSchema>;

interface BankFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAccount?: any;
}

export function BankForm({ open, onOpenChange, editingAccount }: BankFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: editingAccount
      ? {
          name: editingAccount.name ?? "",
          bankName: editingAccount.bankName ?? "",
          accountType: editingAccount.accountType ?? "banco",
          accountSubtype: editingAccount.accountSubtype ?? "corriente",
          currency: editingAccount.currency ?? "DOP",
          accountNumber: editingAccount.accountNumber ?? "",
          balance: editingAccount.balance ?? "0",
          creditLimit: editingAccount.creditLimit ?? "",
          statementClosingDay: editingAccount.statementClosingDay ?? null,
          paymentDueDay: editingAccount.paymentDueDay ?? null,
          alertThreshold: editingAccount.alertThreshold ?? "",
          notes: editingAccount.notes ?? "",
        }
      : {
          name: "",
          bankName: "",
          accountType: "banco",
          accountSubtype: "corriente",
          currency: "DOP",
          accountNumber: "",
          balance: "0",
          creditLimit: "",
          statementClosingDay: null,
          paymentDueDay: null,
          alertThreshold: "",
          notes: "",
        },
  });

  const accountType = form.watch("accountType");

  const createMutation = useMutation({
    mutationFn: (data: BankAccountFormValues) =>
      apiRequest("POST", "/api/bank-accounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts/summary"] });
      toast({ title: "Cuenta creada correctamente" });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({ title: "Error al crear cuenta", description: e.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: BankAccountFormValues) =>
      apiRequest("PUT", `/api/bank-accounts/${editingAccount?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts/summary"] });
      toast({ title: "Cuenta actualizada correctamente" });
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Error al actualizar cuenta", description: e.message, variant: "destructive" });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit(values: BankAccountFormValues) {
    if (editingAccount) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingAccount ? "Editar cuenta bancaria" : "Nueva cuenta bancaria"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la cuenta</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Cuenta corriente BHD" data-testid="input-account-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de cuenta</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-account-type">
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="banco">Cuenta bancaria</SelectItem>
                      <SelectItem value="tarjeta_credito">Tarjeta de crédito</SelectItem>
                      <SelectItem value="efectivo">Caja de efectivo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {accountType === "banco" && (
              <FormField
                control={form.control}
                name="accountSubtype"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subtipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-account-subtype">
                          <SelectValue placeholder="Seleccionar subtipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="corriente">Corriente</SelectItem>
                        <SelectItem value="ahorros">Ahorros</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {accountType !== "efectivo" && (
              <FormField
                control={form.control}
                name="bankName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banco</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-bank-name">
                          <SelectValue placeholder="Seleccionar banco" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NOMBRES_BANCOS.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-currency">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DOP">DOP (RD$)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {accountType !== "efectivo" && (
                <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de cuenta</FormLabel>
                      <FormControl>
                        <Input placeholder="••••••••1234" data-testid="input-account-number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {!editingAccount && (
              <FormField
                control={form.control}
                name="balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Saldo inicial</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" data-testid="input-balance" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {accountType === "tarjeta_credito" && (
              <>
                <FormField
                  control={form.control}
                  name="creditLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Límite de crédito</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" data-testid="input-credit-limit" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="statementClosingDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Día de corte</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            placeholder="Ej: 15"
                            data-testid="input-closing-day"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentDueDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Día de pago</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            placeholder="Ej: 5"
                            data-testid="input-payment-day"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <FormField
              control={form.control}
              name="alertThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Umbral de alerta de saldo bajo (opcional)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="Ej: 5000.00" data-testid="input-alert-threshold" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observaciones..." data-testid="textarea-notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit-bank-account">
                {isPending ? "Guardando..." : editingAccount ? "Actualizar" : "Crear cuenta"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
