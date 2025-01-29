import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

type JoursFeries = {
  [key: string]: string;
};

const joursFeries2025: JoursFeries = {
  '2025-01-01': 'Jour de l\'An',
  '2025-04-21': 'Lundi de Pâques',
  '2025-05-01': 'Fête du Travail',
  '2025-05-08': 'Victoire 1945',
  '2025-05-29': 'Ascension',
  '2025-06-09': 'Lundi de Pentecôte',
  '2025-07-14': 'Fête Nationale',
  '2025-08-15': 'Assomption',
  '2025-11-01': 'Toussaint',
  '2025-11-11': 'Armistice',
  '2025-12-25': 'Noël'
};

type TypeEcheance = 'dsn' | 'declaration' | 'csa' | 'handicap' | 'soltea';

type Echeance = {
  date: number;
  description: string;
  type: TypeEcheance;
  importance: 'high' | 'normal';
};

const echeancesAnnuelles2025 = [
  {
    date: new Date(2025, 2, 1), // 1er mars 2025
    description: 'Contributions formation et dialogue social (OPCO)',
    type: 'declaration',
    importance: 'high'
  },
  {
    date: new Date(2025, 4, 5), // 5 mai 2025
    description: 'DOETH',
    type: 'handicap',
    importance: 'high'
  },
  {
    date: new Date(2025, 4, 27), // 27 mai 2025 (provisoire)
    description: 'Ouverture plateforme SOLTéA',
    type: 'soltea',
    importance: 'high'
  }
];

const DELAI_OPTIONS = [
  { value: 30, label: '30 jours' },
  { value: 60, label: '60 jours' },
  { value: 90, label: '90 jours' },
  { value: 180, label: '180 jours' }
];

const formSchema = z.object({
  days: z.number().min(1, "Le nombre de jours doit être supérieur à 0"),
  type: z.enum(['calendaire', 'ouvré', 'ouvrable']),
  isRetractation: z.boolean().default(false),
});

const CalendrierPaie = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('year');
  const [calculatedDate, setCalculatedDate] = useState<{
    date: Date;
    startDate: Date;
    days: number;
    type: 'calendaire' | 'ouvré' | 'ouvrable';
    isRetractation: boolean;
  } | null>(null);
  const [isDelayDialogOpen, setIsDelayDialogOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      days: 1,
      type: 'calendaire',
      isRetractation: false,
    },
  });

  const getNextWorkingDay = (date: Date) => {
    const nextDay = new Date(date);
    do {
      nextDay.setDate(nextDay.getDate() + 1);
      const dateString = nextDay.toISOString().split('T')[0];
      const dayOfWeek = nextDay.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !joursFeries2025[dateString]) {
        return nextDay;
      }
    } while (true);
  };

  const calculateDSNDate = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    const dateString = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6 || joursFeries2025[dateString]) {
      return getNextWorkingDay(date);
    }
    return date;
  };

  const calculateWorkDays = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let workDays = 0;
    let workableDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      const dateString = date.toISOString().split('T')[0];

      if (dayOfWeek !== 0) {
        workableDays++;
      }
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !joursFeries2025[dateString]) {
        workDays++;
      }
    }

    return { workDays, workableDays };
  };

  const getEcheancesPaie = (year: number, month: number): Echeance[] => {
    const dsn50Plus = calculateDSNDate(year, month, 5);
    const dsnMoins50 = calculateDSNDate(year, month, 15);

    const echeances: Echeance[] = [
      {
        date: dsn50Plus.getDate(),
        description: 'DSN entreprises +50 salariés',
        type: 'dsn',
        importance: 'high'
      },
      {
        date: dsnMoins50.getDate(),
        description: 'DSN entreprises -50 salariés',
        type: 'dsn',
        importance: 'high'
      }
    ];

    echeancesAnnuelles2025
      .filter(ea => ea.date.getMonth() === month && ea.date.getFullYear() === year)
      .forEach(ea => {
        echeances.push({
          date: ea.date.getDate(),
          description: ea.description,
          type: ea.type,
          importance: ea.importance
        });
      });

    return echeances;
  };

  const calculateFutureDate = (
    startDate: Date,
    days: number,
    type: 'calendaire' | 'ouvré' | 'ouvrable',
    isRetractation: boolean = false
  ) => {
    let remainingDays = days;
    const result = new Date(startDate);

    if (type === 'calendaire') {
      result.setDate(result.getDate() + days);
      if (isRetractation) {
        const dateString = result.toISOString().split('T')[0];
        const dayOfWeek = result.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6 || joursFeries2025[dateString]) {
          return getNextWorkingDay(result);
        }
      }
      return result;
    }

    while (remainingDays > 0) {
      result.setDate(result.getDate() + 1);
      const dateString = result.toISOString().split('T')[0];
      const dayOfWeek = result.getDay();

      if (type === 'ouvré') {
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !joursFeries2025[dateString]) {
          remainingDays--;
        }
      } else if (type === 'ouvrable') {
        if (dayOfWeek !== 0) {
          remainingDays--;
        }
      }
    }

    return result;
  };

  const onSubmitDelay = (values: z.infer<typeof formSchema>) => {
    if (!currentDate) return;

    const result = calculateFutureDate(
      currentDate,
      values.days,
      values.type,
      values.isRetractation
    );

    setCalculatedDate({
      date: result,
      startDate: currentDate,
      days: values.days,
      type: values.type,
      isRetractation: values.isRetractation
    });

    // Ne pas fermer la modal tout de suite
    // setIsDelayDialogOpen(false);
  };

  const renderAnnualView = () => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(selectedDate.getFullYear(), i, 1);
      const { workDays, workableDays } = calculateWorkDays(selectedDate.getFullYear(), i);

      const feriesDuMois = Object.entries(joursFeries2025)
        .filter(([date]) => date.startsWith(`${selectedDate.getFullYear()}-${String(i + 1).padStart(2, '0')}`))
        .map(([date, label]) => {
          const jourFerie = new Date(date);
          return {
            date: jourFerie,
            label,
            jour: jourFerie.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })
          };
        });

      const dsn50Plus = calculateDSNDate(date.getFullYear(), i, 5);
      const dsnMoins50 = calculateDSNDate(date.getFullYear(), i, 15);

      const echeancesDuMois = getEcheancesPaie(selectedDate.getFullYear(), i);

      return (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
        >
          <Card
            className={cn(
              "cursor-pointer transition-all duration-300",
              "hover:shadow-lg hover:scale-[1.02]",
              "bg-gradient-to-br from-white via-white to-gray-50",
              "border border-[#42D80F]/20 hover:border-[#42D80F]/40"
            )}
            onClick={() => {
              setSelectedDate(date);
              setViewMode('month');
            }}
          >
            <CardContent className="p-6">
              <div className="bg-[#42D80F]/5 -m-6 mb-4 p-6">
                <h3 className="font-bold text-xl text-gray-800 font-figtree">
                  {date.toLocaleDateString('fr-FR', { month: 'long' })}
                </h3>
              </div>
              <div className="space-y-4 font-figtree">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-gray-50 to-white p-3 rounded-lg border border-gray-100">
                    <div className="text-sm font-medium text-gray-600">Jours ouvrés</div>
                    <div className="text-xl font-bold text-[#42D80F]">{workDays}</div>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-white p-3 rounded-lg border border-gray-100">
                    <div className="text-sm font-medium text-gray-600">Jours ouvrables</div>
                    <div className="text-xl font-bold text-[#42D80F]">{workableDays}</div>
                  </div>
                </div>

                {feriesDuMois.length > 0 && (
                  <div className="space-y-1">
                    <div className="font-medium text-gray-700">Jours fériés :</div>
                    {feriesDuMois.map(({ jour, label }) => (
                      <div
                        key={jour}
                        className="text-gray-600 text-sm px-2 py-1 rounded-md bg-gradient-to-r from-orange-50 to-orange-100/50"
                      >
                        {jour} - {label}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="font-medium text-[#42D80F]">Échéances :</div>
                  {echeancesDuMois.map((ea, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "text-gray-500 text-sm px-2 py-1 rounded-md",
                        ea.type === 'dsn' && "bg-[#42D80F]/10 text-[#42D80F]",
                        ea.type === 'csa' && "bg-amber-100 text-amber-700",
                        ea.type === 'handicap' && "bg-purple-100 text-purple-700",
                        ea.type === 'soltea' && "bg-blue-100 text-blue-700",
                        ea.type === 'declaration' && "bg-purple-100 text-purple-700"
                      )}
                    >
                      {ea.date} - {ea.description}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      );
    });

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {months}
      </div>
    );
  };

  const renderMonthView = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const firstDayOfMonth = firstDay === 0 ? 6 : firstDay - 1;
    const { workDays, workableDays } = calculateWorkDays(year, month);
    const echeances = getEcheancesPaie(year, month);

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1);
      const renderDayComponent = renderDay(date);
      return (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: i * 0.01 }}
        >
          {renderDayComponent}
        </motion.div>
      );
    });

    const emptyCells = Array.from({ length: firstDayOfMonth }, (_, i) => (
      <div key={`empty-${i}`} className="p-2 border-0"></div>
    ));

    return (
      <Card className="border-[#42D80F]/10">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-lg border border-gray-100">
              <div className="text-sm font-medium text-gray-600 font-figtree">Jours ouvrés</div>
              <div className="text-2xl font-bold text-[#42D80F] font-figtree">{workDays}</div>
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-lg border border-gray-100">
              <div className="text-sm font-medium text-gray-600 font-figtree">Jours ouvrables</div>
              <div className="text-2xl font-bold text-[#42D80F] font-figtree">{workableDays}</div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
              <div key={day} className="font-medium text-center p-2 text-gray-500 font-figtree">
                {day}
              </div>
            ))}
            {emptyCells.concat(days)}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderDay = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
    const isFerie = joursFeries2025[dateString];
    const isCalculatedDate = calculatedDate &&
      calculatedDate.date.toDateString() === date.toDateString();
    const isStartDate = calculatedDate &&
      calculatedDate.startDate.toDateString() === date.toDateString();

    // Récupérer les échéances pour ce jour
    const echeancesDuJour = getEcheancesPaie(date.getFullYear(), date.getMonth())
      .filter(e => e.date === date.getDate());

    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={cn(
              "p-3 rounded-lg min-h-24",
              "border border-gray-100",
              "transition-all duration-200",
              isWeekend && "bg-[#42D80F]/20", // Fond vert plus visible pour les weekends
              isFerie && "bg-gradient-to-br from-blue-50/80 to-white",
              isCalculatedDate && "ring-2 ring-purple-500 ring-offset-2",
              isStartDate && "ring-2 ring-green-500 ring-offset-2",
              !isWeekend && !isFerie && "bg-white hover:shadow-md"
            )}
          >
            <div className="flex justify-between items-center mb-1">
              <span className={cn(
                "font-medium font-figtree",
                isWeekend ? "text-[#42D80F]/80" :
                  isFerie ? "text-blue-600" :
                    "text-gray-700"
              )}>
                {date.getDate()}
              </span>
            </div>
            {isFerie && (
              <div className="text-xs text-blue-500 font-figtree mb-1">
                {joursFeries2025[dateString]}
              </div>
            )}
            {echeancesDuJour.map((echeance, idx) => (
              <div 
                key={idx}
                className={cn(
                  "text-xs p-1.5 rounded mt-1",
                  echeance.type === 'dsn' && "bg-[#42D80F]/10 text-[#42D80F]",
                  echeance.type === 'csa' && "bg-amber-100 text-amber-700",
                  echeance.type === 'handicap' && "bg-purple-100 text-purple-700",
                  echeance.type === 'soltea' && "bg-blue-100 text-blue-700",
                  echeance.type === 'declaration' && "bg-purple-100 text-purple-700"
                )}
              >
                {echeance.description}
              </div>
            ))}
            {isCalculatedDate && (
              <div className="text-xs p-1.5 rounded mt-1 bg-purple-100 text-purple-700 font-medium">
                Date calculée ({calculatedDate.days} jours {calculatedDate.type})
                {calculatedDate.isRetractation && " (Rétractation)"}
              </div>
            )}
            {isStartDate && (
              <div className="text-xs p-1.5 rounded mt-1 bg-green-100 text-green-700 font-medium">
                Date de départ
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => {
              setCurrentDate(date);
              setIsDelayDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Calculer un délai
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <>
      <Dialog open={isDelayDialogOpen} onOpenChange={setIsDelayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calculer un délai</DialogTitle>
            <DialogDescription>
              À partir du {currentDate?.toLocaleDateString('fr-FR', { dateStyle: 'long' })}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitDelay)} className="space-y-4">
              <FormField
                control={form.control}
                name="days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de jours</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de délai</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="calendaire">Calendaire</SelectItem>
                        <SelectItem value="ouvré">Ouvré</SelectItem>
                        <SelectItem value="ouvrable">Ouvrable</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isRetractation"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Délai de rétractation
                      </FormLabel>
                      <FormDescription>
                        La date d'échéance ne peut pas tomber un weekend ou un jour férié
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full">
                Calculer
              </Button>

              {calculatedDate && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 rounded-lg bg-gray-50 space-y-2">
                    <div className="font-medium text-gray-700">Résultat du calcul :</div>
                    <div className="space-y-1">
                      <div className="text-sm text-gray-600">
                        Date de départ : {calculatedDate.startDate.toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                      </div>
                      <div className="text-sm text-gray-600">
                        Délai : {calculatedDate.days} jour{calculatedDate.days > 1 ? 's' : ''} {calculatedDate.type}
                        {calculatedDate.isRetractation ? ' (délai de rétractation)' : ''}
                      </div>
                      <div className="font-medium text-gray-900">
                        Date d'échéance : {calculatedDate.date.toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsDelayDialogOpen(false)}
                    >
                      Fermer
                    </Button>
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={() => {
                        setIsDelayDialogOpen(false);
                        setSelectedDate(calculatedDate.date);
                        setViewMode('month');
                      }}
                    >
                      Voir dans le calendrier
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="max-w-6xl mx-auto p-6 font-figtree">
        <div className="flex justify-between items-center mb-8">
          {viewMode === 'month' && (
            <button
              className="flex items-center p-2 hover:bg-[#42D80F]/10 rounded-lg transition-colors"
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setMonth(selectedDate.getMonth() - 1);
                setSelectedDate(newDate);
              }}
            >
              <ChevronLeft className="h-6 w-6 text-gray-600" />
            </button>
          )}

          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800">
              {viewMode === 'year'
                ? "2025"
                : `${selectedDate.toLocaleDateString('fr-FR', { month: 'long' })} 2025`
              }
            </h2>
            {viewMode === 'month' && (
              <button
                className="flex items-center gap-2 text-gray-600 hover:bg-[#42D80F]/10 p-2 rounded-lg transition-colors"
                onClick={() => setViewMode('year')}
              >
                <Calendar className="h-5 w-5" />
                Vue annuelle
              </button>
            )}
          </div>

          {viewMode === 'month' && (
            <button
              className="flex items-center p-2 hover:bg-[#42D80F]/10 rounded-lg transition-colors"
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setMonth(selectedDate.getMonth() + 1);
                setSelectedDate(newDate);
              }}
            >
              <ChevronRight className="h-6 w-6 text-gray-600" />
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {viewMode === 'year' ? renderAnnualView() : renderMonthView()}
        </AnimatePresence>
      </div>
    </>
  );
};

export default CalendrierPaie;