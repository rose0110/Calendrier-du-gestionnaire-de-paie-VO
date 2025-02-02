import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  MousePointerClick,
  Settings,
  MenuIcon,
  Clock,
  Calculator,
  CalendarDays,
  Timer,
  UserMinus,
  GraduationCap
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";


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

// Fonction pour normaliser une date (ignorer l'heure)
const normalizeDate = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

// Mise à jour du schéma du formulaire pour inclure les horaires par jour
const formSchema = z.object({
  horairesSemaine: z.object({
    1: z.number().min(0, "L'horaire doit être positif").optional(), // Lundi
    2: z.number().min(0, "L'horaire doit être positif").optional(), // Mardi
    3: z.number().min(0, "L'horaire doit être positif").optional(), // Mercredi
    4: z.number().min(0, "L'horaire doit être positif").optional(), // Jeudi
    5: z.number().min(0, "L'horaire doit être positif").optional(), // Vendredi
    6: z.number().min(0, "L'horaire doit être positif").optional(), // Samedi
    0: z.number().min(0, "L'horaire doit être positif").optional(), // Dimanche
  }),
  absences: z.array(z.object({
    date: z.date(),
    heures: z.number().min(0)
  })).default([]),
  feriesTravailles: z.record(z.object({
    travaille: z.boolean(),
    heures: z.number().min(0).optional()
  })).default({}),
  days: z.number().min(1, "Le nombre de jours doit être supérieur à 0"),
  type: z.enum(['calendaire', 'ouvré', 'ouvrable'], {
    required_error: "Veuillez sélectionner un type de délai"
  }),
  delayType: z.enum(['retractation', 'subrogation'], {
    required_error: "Veuillez sélectionner le type de calcul"
  }),
  carenceDays: z.number().min(0).optional(),
  customRestDays: z.array(z.number()).optional(),
  nonWorkingDay: z.number().optional(),
});


type DayOfWeek = {
  value: number;
  label: string;
};

const DAYS_OF_WEEK: DayOfWeek[] = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 0, label: 'Dimanche' },
];

type HeuresCalcul = {
  horaireNormal: number;
  feriesTravailles: { [key: string]: boolean };
  absences: { date: Date; heures: number }[];
  heuresReelles: number;
  heuresPayees: number;
};

type SelectedFeature = 'plafond' | 'cp' | 'sup' | 'absences' | 'stagiaire' | null;

const CalendrierPaie = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('year');
  const calculatedDayRef = useRef<HTMLDivElement>(null);
  const [showHelpAlert, setShowHelpAlert] = useState(true);
  const [calculatedDate, setCalculatedDate] = useState<{
    date: Date;
    startDate: Date;
    days: number;
    type: 'calendaire' | 'ouvré' | 'ouvrable';
    delayType: 'retractation' | 'subrogation';
    carenceDays: number;
    customRestDays?: number[];
    nonWorkingDay?: number;
  } | null>(null);
  const [isDelayDialogOpen, setIsDelayDialogOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [showCustomDaysDialog, setShowCustomDaysDialog] = useState(false);
  const [customRestDays, setCustomRestDays] = useState<number[]>([]);
  const [customNonWorkingDay, setCustomNonWorkingDay] = useState<number | null>(null);
  const [heuresCalcul, setHeuresCalcul] = useState<HeuresCalcul | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      days: 1,
      carenceDays: 0,
      horairesSemaine: {
        0: 0, // Dimanche
        1: 0, // Lundi
        2: 0, // Mardi
        3: 0, // Mercredi
        4: 0, // Jeudi
        5: 0, // Vendredi
        6: 0  // Samedi
      },
      absences: [],
      feriesTravailles: Object.fromEntries(
        Object.keys(joursFeries2025)
          .filter(date => date.startsWith(`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`))
          .map(date => [date, { travaille: false, heures: 0 }])
      ),
    },
  });

  useEffect(() => {
    if (calculatedDate && calculatedDayRef.current) {
      calculatedDayRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [calculatedDate]);


  const getNextWorkingDay = (date: Date, restDays: number[] = [6, 0], nonWorkingDay: number = 0) => {
    const nextDay = new Date(date);
    do {
      nextDay.setDate(nextDay.getDate() + 1);
      const dateString = normalizeDate(nextDay);
      const dayOfWeek = nextDay.getDay();
      if (!restDays.includes(dayOfWeek) && !joursFeries2025[dateString] && dayOfWeek !== nonWorkingDay) {
        return nextDay;
      }
    } while (true);
  };

  const calculateDSNDate = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    const dateString = normalizeDate(date);
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
      const dateString = normalizeDate(date);

      if (dayOfWeek !== 0) {
        workableDays++;
      }
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !joursFeries2025[dateString]) {
        workDays++;
      }
    }

    return { workDays, workableDays };
  };

    const calculerHeuresReelles = (
        horairesSemaine: { [key: string]: number },
        feriesTravailles: { [key: string]: { travaille: boolean, heures?: number } },
        absences: { date: Date; heures: number }[]
    ) => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const joursDansMois = new Date(year, month + 1, 0).getDate();
        let heuresReelles = 0;
        let heuresPayees = 0;

        for (let jour = 1; jour <= joursDansMois; jour++) {
            const date = new Date(year, month, jour);
            const dateString = normalizeDate(date);
            const jourSemaine = date.getDay();
            const horaireHabituel = horairesSemaine[jourSemaine] || 0;

            if (horaireHabituel > 0) { // Si des heures sont prévues ce jour
                const estFerie = joursFeries2025[dateString];
                const absence = absences.find(a => normalizeDate(a.date) === dateString);

                if (absence) {
                    // Jour avec absence
                    const heuresTravaillees = Math.max(0, horaireHabituel - absence.heures);
                    heuresReelles += heuresTravaillees;
                    heuresPayees += heuresTravaillees;
                } else if (estFerie) {
                    // Jour férié
                    const ferieTravaille = feriesTravailles[dateString];
                    if (ferieTravaille?.travaille) {
                        const heuresTravaillees = ferieTravaille.heures || horaireHabituel;
                        heuresReelles += heuresTravaillees;
                        heuresPayees += heuresTravaillees * 2; // Double paiement pour jour férié travaillé
                    } else {
                        heuresPayees += horaireHabituel; // Payé mais pas travaillé
                    }
                } else {
                    // Jour normal
                    heuresReelles += horaireHabituel;
                    heuresPayees += horaireHabituel;
                }
            }
        }

        return { heuresReelles, heuresPayees };
    };

  const handleHeuresSubmit = (horaireNormal: number, feriesTravailles: { [key: string]: boolean }) => {
      const { heuresReelles, heuresPayees } = calculerHeuresReelles(
          { 1: horaireNormal, 2: horaireNormal, 3: horaireNormal, 4: horaireNormal, 5: horaireNormal },
          feriesTravailles,
          []
          );
    setHeuresCalcul({
      horaireNormal,
      feriesTravailles,
      absences: [],
      heuresReelles,
      heuresPayees
    });
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
    delayType: 'retractation' | 'subrogation',
    carenceDays: number = 0,
    restDays: number[] = [6, 0],
    nonWorkingDay: number = 0
  ) => {
    let result = new Date(startDate);

    if (delayType === 'subrogation' && carenceDays > 0) {
      let carenceRemaining = carenceDays;
      while (carenceRemaining > 0) {
        result.setDate(result.getDate() + 1);
        carenceRemaining--;
      }
    }

    let remainingDays = days;

    if (type === 'calendaire') {
      result.setDate(result.getDate() + days);
      if (delayType === 'retractation') {
        const dateString = normalizeDate(result);
        const dayOfWeek = result.getDay();
        if (dayOfWeek === nonWorkingDay || joursFeries2025[dateString]) {
          return getNextWorkingDay(result, restDays, nonWorkingDay);
        }
      }
      return result;
    }

    while (remainingDays > 0) {
      result.setDate(result.getDate() + 1);
      const dateString = normalizeDate(result);
      const dayOfWeek = result.getDay();

      if (type === 'ouvré') {
        if (!restDays.includes(dayOfWeek) && !joursFeries2025[dateString]) {
          remainingDays--;
        }
      } else if (type === 'ouvrable') {
        if (dayOfWeek !== nonWorkingDay) {
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
      values.delayType,
      values.carenceDays,
      values.type === 'ouvré' ? customRestDays : [6, 0],
      values.type === 'ouvrable' ? customNonWorkingDay || 0 : 0
    );

    setCalculatedDate({
      date: result,
      startDate: currentDate,
      days: values.days,
      type: values.type,
      delayType: values.delayType,
      carenceDays: values.carenceDays || 0,
      customRestDays: values.type === 'ouvré' ? customRestDays : undefined,
      nonWorkingDay: values.type === 'ouvrable' ? customNonWorkingDay : undefined
    });
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
  
      return (
        <div className="space-y-6">
          {/* Section du calculateur d'heures */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Calculateur d'heures</h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => {
                const { heuresReelles, heuresPayees } = calculerHeuresReelles(
                  data.horairesSemaine,
                  data.feriesTravailles || {},
                  data.absences || []
                );
                setHeuresCalcul({
                  horaireNormal: 0,
                  feriesTravailles: data.feriesTravailles || {},
                  absences: data.absences || [],
                  heuresReelles,
                  heuresPayees
                });
              })} className="space-y-4">
                {/* Horaires habituels */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Horaires habituels par jour</label>
                  <div className="grid grid-cols-7 gap-2">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((jour, index) => {
                      const jourIndex = (index + 1) % 7;
                      return (
                        <FormField
                          key={jour}
                          control={form.control}
                          name={`horairesSemaine.${jourIndex}`}
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-xs text-center block">{jour}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.5"
                                  placeholder="0"
                                  className="text-center h-8 px-1"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
  
                {/* Absences */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Absences du mois</label>
                  <div className="space-y-2">
                    {form.watch("absences", []).map((absence, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={absence.date.toISOString().split('T')[0]}
                          min={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-01`}
                          max={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()).padStart(2, '0')}`}
                          onChange={(e) => {
                            const newDate = new Date(e.target.value);
                            const newAbsences = [...form.watch("absences")];
                            newAbsences[index].date = newDate;
                            const jourSemaine = newDate.getDay();
                            const heuresHabituelles = form.watch(`horairesSemaine.${jourSemaine}`) || 0;
                            newAbsences[index].heures = heuresHabituelles;
                            form.setValue("absences", newAbsences);
                          }}
                        />
                        <Input
                          type="number"
                          step="0.5"
                          placeholder="Heures"
                          value={absence.heures}
                          onChange={(e) => {
                            const newAbsences = [...form.watch("absences")];
                            newAbsences[index].heures = parseFloat(e.target.value) || 0;
                            form.setValue("absences", newAbsences);
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newAbsences = form.watch("absences").filter((_, i) => i !== index);
                            form.setValue("absences", newAbsences);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const newAbsences = [...form.watch("absences", [])];
                        const today = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                        newAbsences.push({ date: today, heures: 0 });
                        form.setValue("absences", newAbsences);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter une absence
                    </Button>
                  </div>
                </div>
  
                {/* Jours fériés */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jours fériés du mois</label>
                  {Object.entries(joursFeries2025)
                    .filter(([date]) => date.startsWith(`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`))
                    .map(([date, label]) => {
                      const jourFerie = new Date(date);
                      const jourSemaine = jourFerie.getDay();
                      const heuresHabituelles = form.watch(`horairesSemaine.${jourSemaine}`) || 0;
  
                      return (
                        <div key={date} className="space-y-2 p-2 bg-gray-50 rounded-lg">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="flex items-center gap-4">
                            <FormField
                              control={form.control}
                              name={`feriesTravailles.${date}.travaille`}
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={(checked) => {
                                        field.onChange(checked);
                                        if (checked) {
                                          form.setValue(`feriesTravailles.${date}.heures`, heuresHabituelles);
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm">Travaillé</FormLabel>
                                </FormItem>
                              )}
                            />
                            {form.watch(`feriesTravailles.${date}.travaille`) && (
                              <FormField
                                control={form.control}
                                name={`feriesTravailles.${date}.heures`}
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2">
                                    <FormControl>
                                      <Input
                                        type="number"
                                        step="0.5"
                                        placeholder={heuresHabituelles.toString()}
                                        className="w-20"
                                        {...field}
                                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm">heures</FormLabel>
                                  </FormItem>
                                )}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
  
                <Button type="submit" className="w-full">
                  Calculer les heures
                </Button>
              </form>
            </Form>
  
            {/* Résultats */}
            {heuresCalcul && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="text-sm font-medium">Résultats du mois :</div>
                <div className="text-sm space-y-1">
                  <div>Heures réelles travaillées : {heuresCalcul.heuresReelles.toFixed(2)}h</div>
                  <div>Heures payées : {heuresCalcul.heuresPayees.toFixed(2)}h</div>
                  {heuresCalcul.absences.length > 0 && (
                    <div>
                      <div className="font-medium mt-2">Absences :</div>
                      {heuresCalcul.absences.map((absence, index) => (
                        <div key={index}>
                          {absence.date.toLocaleDateString('fr-FR')} : {absence.heures}h
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
  
          {/* Calendrier */}
          <div className="grid grid-cols-7 gap-1">
            {/* En-têtes des jours */}
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((jour) => (
              <div key={jour} className="text-center p-2 font-medium">
                {jour}
              </div>
            ))}
  
            {/* Cellules vides pour le début du mois */}
            {Array.from({ length: firstDayOfMonth }, (_, i) => (
              <div key={`empty-${i}`} className="p-2 border-0"></div>
            ))}
  
            {/* Jours du mois */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const date = new Date(year, month, i + 1);
              const dateString = normalizeDate(date);
              const isFerie = joursFeries2025[dateString];
  
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: i * 0.01 }}
                  className={cn(
                    "p-2 border rounded-lg",
                    isFerie ? "bg-orange-50" : "bg-white",
                    calculatedDate?.date.getTime() === date.getTime() && "ring-2 ring-[#42D80F]"
                  )}
                >
                  <div className="text-sm font-medium">{i + 1}</div>
                  {isFerie && (
                    <div className="text-xs text-orange-600">{joursFeries2025[dateString]}</div>
                  )}
                  {echeances.find(e => e.date === i + 1) && (
                    <div className={cn(
                      "text-xs mt-1 p-1 rounded",
                      "bg-[#42D80F]/10 text-[#42D80F]"
                    )}>
                      {echeances.find(e => e.date === i + 1)?.description}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      );
    };
  
    // Render principal
    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Calendrier de paie {selectedDate.getFullYear()}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date(selectedDate.getFullYear() - 1, selectedDate.getMonth()))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date(selectedDate.getFullYear() + 1, selectedDate.getMonth()))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'year' ? 'month' : 'year')}
            >
              {viewMode === 'year' ? <Calendar className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
            </Button>
          </div>
        </div>
  
        {viewMode === 'year' ? renderAnnualView() : renderMonthView()}
      </div>
    );
  };
  
  export default CalendrierPaie;