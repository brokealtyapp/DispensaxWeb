import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";
import { formatDate, formatWeekday } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  MapPin,
  MoreHorizontal,
  Trash2,
  Edit,
  Wrench,
  Package,
  Truck,
  ClipboardList,
  ListTodo,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

const eventFormSchema = z.object({
  title: z.string().min(1, "Título requerido"),
  description: z.string().optional(),
  eventType: z.string().min(1, "Tipo requerido"),
  startDate: z.date({ required_error: "Fecha de inicio requerida" }),
  endDate: z.date().optional(),
  allDay: z.boolean().default(false),
  color: z.string().optional(),
  userId: z.string().optional(),
});

type EventFormData = z.infer<typeof eventFormSchema>;

const eventTypeConfig: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  tarea: { label: "Tarea", icon: ListTodo, color: "bg-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  mantenimiento: { label: "Mantenimiento", icon: Wrench, color: "bg-orange-500", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  abastecimiento: { label: "Abastecimiento", icon: Package, color: "bg-green-500", bgColor: "bg-green-100 dark:bg-green-900/30" },
  recoleccion: { label: "Recolección", icon: Truck, color: "bg-purple-500", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  revision: { label: "Revisión", icon: ClipboardList, color: "bg-cyan-500", bgColor: "bg-cyan-100 dark:bg-cyan-900/30" },
  otro: { label: "Otro", color: "bg-gray-500", icon: CalendarIcon, bgColor: "bg-gray-100 dark:bg-gray-800" },
};

const colorOptions = [
  { value: "blue", label: "Azul", class: "bg-blue-500" },
  { value: "green", label: "Verde", class: "bg-green-500" },
  { value: "orange", label: "Naranja", class: "bg-orange-500" },
  { value: "purple", label: "Púrpura", class: "bg-purple-500" },
  { value: "red", label: "Rojo", class: "bg-red-500" },
  { value: "cyan", label: "Cian", class: "bg-cyan-500" },
  { value: "pink", label: "Rosa", class: "bg-pink-500" },
];

export function CalendarPage() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isNewEventOpen, setIsNewEventOpen] = useState(false);
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");

  const { canCreate, canEdit, canDelete } = usePermissions();

  const eventForm = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      eventType: "otro",
      allDay: false,
      color: "blue",
      userId: "",
    },
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const { data: events, isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: ["/api/calendar/events", format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("startDate", monthStart.toISOString());
      params.append("endDate", monthEnd.toISOString());
      const response = await fetch(`/api/calendar/events?${params.toString()}`);
      if (!response.ok) throw new Error("Error fetching events");
      return response.json();
    },
  });

  const { data: tasks } = useQuery<any[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      return apiRequest("POST", "/api/calendar/events", {
        ...data,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate?.toISOString(),
        userId: data.userId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({ title: "Evento creado", description: "El evento se ha agregado al calendario" });
      setIsNewEventOpen(false);
      eventForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear el evento", variant: "destructive" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EventFormData> }) => {
      return apiRequest("PATCH", `/api/calendar/events/${id}`, {
        ...data,
        startDate: data.startDate?.toISOString(),
        endDate: data.endDate?.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({ title: "Evento actualizado" });
      setIsEditEventOpen(false);
      setSelectedEvent(null);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el evento", variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/calendar/events/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({ title: "Evento eliminado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar el evento", variant: "destructive" });
    },
  });

  const calendarDays = useMemo(() => {
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const getEventsForDay = (day: Date) => {
    return events?.filter(event => {
      const eventDate = parseISO(event.startDate);
      return isSameDay(eventDate, day);
    }) || [];
  };

  const getTasksForDay = (day: Date) => {
    return tasks?.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = parseISO(task.dueDate);
      return isSameDay(taskDate, day);
    }) || [];
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
  };

  const handleAddEventOnDate = (date: Date) => {
    eventForm.reset({
      title: "",
      description: "",
      eventType: "otro",
      startDate: date,
      allDay: false,
      color: "blue",
    });
    setIsNewEventOpen(true);
    setSelectedDate(null);
  };

  const handleEditEvent = (event: any) => {
    setSelectedEvent(event);
    eventForm.reset({
      title: event.title,
      description: event.description || "",
      eventType: event.eventType || "otro",
      startDate: parseISO(event.startDate),
      endDate: event.endDate ? parseISO(event.endDate) : undefined,
      allDay: event.allDay || false,
      color: event.color || "blue",
      userId: event.userId || "",
    });
    setIsEditEventOpen(true);
    setSelectedDate(null);
  };

  const onEventSubmit = (data: EventFormData) => {
    createEventMutation.mutate(data);
  };

  const onEditSubmit = (data: EventFormData) => {
    if (selectedEvent) {
      updateEventMutation.mutate({ id: selectedEvent.id, data });
    }
  };

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
              <CalendarIcon className="h-8 w-8 text-primary" />
              Calendario
            </h1>
            <p className="text-muted-foreground">
              Visualiza y gestiona eventos y tareas programadas
            </p>
          </div>
          {canCreate("tasks") && (
            <Button
              onClick={() => {
                eventForm.reset({ startDate: new Date() });
                setIsNewEventOpen(true);
              }}
              className="gap-2"
              data-testid="button-new-event"
            >
              <Plus className="h-4 w-4" />
              Nuevo Evento
            </Button>
          )}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePrevMonth} data-testid="button-prev-month">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleNextMonth} data-testid="button-next-month">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleToday} data-testid="button-today">
                  Hoy
                </Button>
              </div>
              <h2 className="text-xl font-bold capitalize" data-testid="text-current-month">
                {format(currentDate, "MMMM yyyy", { locale: es })}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  data-testid="button-view-month"
                >
                  Mes
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  data-testid="button-view-week"
                >
                  Semana
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <Skeleton className="h-[600px] w-full" />
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-7 bg-muted">
                  {weekDays.map((day) => (
                    <div key={day} className="py-3 text-center text-sm font-medium border-b">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {calendarDays.map((day, idx) => {
                    const dayEvents = getEventsForDay(day);
                    const dayTasks = getTasksForDay(day);
                    const allItems = [...dayEvents, ...dayTasks.map(t => ({ ...t, isTask: true }))];
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);

                    return (
                      <div
                        key={idx}
                        className={`min-h-[100px] sm:min-h-[120px] p-1 sm:p-2 border-b border-r cursor-pointer transition-colors hover:bg-muted/50 ${
                          !isCurrentMonth ? "bg-muted/30 text-muted-foreground" : ""
                        } ${isToday(day) ? "bg-primary/5" : ""} ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}
                        onClick={() => handleDayClick(day)}
                        data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                      >
                        <div className={`text-sm font-medium mb-1 ${
                          isToday(day) 
                            ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center" 
                            : ""
                        }`}>
                          {format(day, "d")}
                        </div>
                        <div className="space-y-1">
                          {allItems.slice(0, 3).map((item, i) => {
                            const type = eventTypeConfig[(item as any).isTask ? "tarea" : (item.eventType || "otro")];
                            return (
                              <div
                                key={i}
                                className={`text-xs px-1 py-0.5 rounded truncate ${type.color} text-white`}
                                title={item.title}
                              >
                                {item.title}
                              </div>
                            );
                          })}
                          {allItems.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{allItems.length - 3} más
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={selectedDate !== null} onOpenChange={() => setSelectedDate(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>
                  {selectedDate && formatDate(selectedDate)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDate(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedDate && (
                <>
                  <div className="space-y-2">
                    {[...getEventsForDay(selectedDate), ...getTasksForDay(selectedDate).map(t => ({ ...t, isTask: true }))].map((item, i) => {
                      const type = eventTypeConfig[(item as any).isTask ? "tarea" : (item.eventType || "otro")];
                      const TypeIcon = type.icon;
                      return (
                        <div
                          key={i}
                          className={`p-3 rounded-lg ${type.bgColor} flex items-start justify-between gap-2`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${type.color} text-white`}>
                              <TypeIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium">{item.title}</p>
                              {item.description && (
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                              )}
                              {!(item as any).isTask && item.allDay && (
                                <Badge variant="outline" className="mt-1">Todo el día</Badge>
                              )}
                            </div>
                          </div>
                          {!(item as any).isTask && (canEdit("tasks") || canDelete("tasks")) && (
                            <div className="flex items-center gap-1">
                              {canEdit("tasks") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditEvent(item)}
                                  data-testid={`button-edit-event-${item.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete("tasks") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteEventMutation.mutate(item.id)}
                                  data-testid={`button-delete-event-${item.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {getEventsForDay(selectedDate).length === 0 && getTasksForDay(selectedDate).length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No hay eventos ni tareas este día</p>
                    </div>
                  )}

                  {canCreate("tasks") && (
                    <Button
                      className="w-full gap-2"
                      onClick={() => handleAddEventOnDate(selectedDate)}
                      data-testid="button-add-event-day"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar Evento
                    </Button>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isNewEventOpen} onOpenChange={setIsNewEventOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nuevo Evento</DialogTitle>
              <DialogDescription>
                Agrega un nuevo evento al calendario
              </DialogDescription>
            </DialogHeader>
            <Form {...eventForm}>
              <form onSubmit={eventForm.handleSubmit(onEventSubmit)} className="space-y-4">
                <FormField
                  control={eventForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Título del evento" {...field} data-testid="input-event-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descripción opcional..." {...field} data-testid="input-event-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={eventForm.control}
                    name="eventType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-event-type">
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(eventTypeConfig).map(([key, config]) => (
                              <SelectItem key={key} value={key}>{config.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={eventForm.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-event-color">
                              <SelectValue placeholder="Seleccionar color" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {colorOptions.map((color) => (
                              <SelectItem key={color.value} value={color.value}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded-full ${color.class}`} />
                                  {color.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={eventForm.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha de Inicio</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="justify-start text-left font-normal"
                                data-testid="button-event-start-date"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? formatDate(field.value) : "Seleccionar"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={eventForm.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha de Fin (opcional)</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="justify-start text-left font-normal"
                                data-testid="button-event-end-date"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? formatDate(field.value) : "Seleccionar"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={eventForm.control}
                  name="allDay"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-all-day"
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Evento de todo el día
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventForm.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asignar a (opcional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-event-user">
                            <SelectValue placeholder="Seleccionar usuario" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {users?.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName || user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsNewEventOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createEventMutation.isPending} data-testid="button-submit-event">
                    {createEventMutation.isPending ? "Creando..." : "Crear Evento"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditEventOpen} onOpenChange={setIsEditEventOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Editar Evento</DialogTitle>
              <DialogDescription>
                Modifica los detalles del evento
              </DialogDescription>
            </DialogHeader>
            <Form {...eventForm}>
              <form onSubmit={eventForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={eventForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Título del evento" {...field} data-testid="input-edit-event-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descripción opcional..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={eventForm.control}
                    name="eventType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(eventTypeConfig).map(([key, config]) => (
                              <SelectItem key={key} value={key}>{config.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={eventForm.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar color" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {colorOptions.map((color) => (
                              <SelectItem key={color.value} value={color.value}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded-full ${color.class}`} />
                                  {color.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditEventOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={updateEventMutation.isPending} data-testid="button-update-event">
                    {updateEventMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}

export default CalendarPage;
