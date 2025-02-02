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

type SelectedFeature = 'heures' | 'plafond' | 'cp' | 'sup' | 'absences' | 'stagiaire' | null;

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
  const [showFeatureModal, setShowFeatureModal] = useState(false);


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
        6: 0, // Samedi
      },
      absences: [],
      feriesTravailles: {}
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

    const onSubmit = (data: z.infer<typeof formSchema>) => {
    const horairesSemaine = data.horairesSemaine || {};
    const feriesTravailles = data.feriesTravailles || {};
    const absences = data.absences || [];

    const { heuresReelles, heuresPayees } = calculerHeuresReelles(
      horairesSemaine,
      feriesTravailles,
      absences
    );

    setHeuresCalcul({
      horaireNormal: 0,
      feriesTravailles,
      absences,
      heuresReelles,
      heuresPayees
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

  const renderFeatureModal = () => {
    return (
      <Dialog open={showFeatureModal} onOpenChange={setShowFeatureModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedFeature === 'heures' && "Calcul des heures réelles"}
              {selectedFeature === 'plafond' && "Plafond sécurité sociale"}
              {selectedFeature === 'cp' && "Prorata CP"}
              {selectedFeature === 'sup' && "Heures sup./complémentaires"}
              {selectedFeature === 'absences' && "Calcul des absences"}
              {selectedFeature === 'stagiaire' && "Gratification stagiaire"}
            </DialogTitle>
            <DialogDescription>
              {selectedFeature === 'heures' && "Calculez les heures réelles travaillées en tenant compte des absences et jours fériés"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFeature === 'heures' && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {/* Horaires habituels */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Horaires habituels par jour</label>
                        <div className="grid grid-cols-7 gap-2">
                            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((jour, index) => {
                                const jourIndex = (index + 1) % 7; // Pour que dimanche soit 0
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
                                        // Pré-remplir les heures basées sur l'horaire habituel
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
            )}

            {/* Affichage des résultats */}
            {selectedFeature === 'heures' && heuresCalcul && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
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


            {selectedFeature === 'plafond' && (
              <div>Calcul du plafond de la sécurité sociale</div>
            )}
            {selectedFeature === 'cp' && (
              <div>Calcul du prorata CP</div>
            )}
            {selectedFeature === 'sup' && (
              <div>Calcul des heures supplémentaires/complémentaires</div>
            )}
            {selectedFeature === 'absences' && (
              <div>Calcul des absences</div>
            )}
            {selectedFeature === 'stagiaire' && (
              <div>Calcul de la gratification stagiaire</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
      <div className="flex gap-4">
        <div className="flex-1">
          <Card className="border-[#42D80F]/10">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-lg border border-gray-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-600 font-figtree">Jours ouvrés</div>
                      <div className="text-2xl font-bold text-[#42D80F] font-figtree">{workDays}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        form.setValue("type", "ouvré");
                        setShowCustomDaysDialog(true);
                      }}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Calcul personnalisé
                    </Button>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-lg border border-gray-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-600 font-figtree">Jours ouvrables</div>
                      <div className="text-2xl font-bold text-[#42D80F] font-figtree">{workableDays}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        form.setValue("type", "ouvrable");
                        setShowCustomDaysDialog(true);
                      }}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Calcul personnalisé
                    </Button>
                  </div>
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
              <div className="mt-4 text-xs text-gray-500 space-y-1">
                <div>Jours ouvrés du mois : {workDays}</div>
                <div>Jours ouvrables du mois : {workableDays}</div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10">
              <MenuIcon className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px]">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Fonctionnalités</h3>

              {/* Menu des fonctionnalités */}
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setSelectedFeature('heures');
                    setShowFeatureModal(true);
                  }}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Calcul des heures réelles
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                   onClick={() => {
                    setSelectedFeature('plafond');
                    setShowFeatureModal(true);
                  }}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Plafond sécurité sociale
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                   onClick={() => {
                    setSelectedFeature('cp');
                    setShowFeatureModal(true);
                  }}
                >
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Prorata CP
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                   onClick={() => {
                    setSelectedFeature('sup');
                    setShowFeatureModal(true);
                  }}
                >
                  <Timer className="h-4 w-4 mr-2" />
                  Heures sup./complémentaires
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setSelectedFeature('absences');
                    setShowFeatureModal(true);
                  }}
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Calcul des absences
                </Button>
                 <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setSelectedFeature('stagiaire');
                    setShowFeatureModal(true);
                  }}
                >
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Gratification stagiaire
                </Button>
              </div>

              {/* Le contenu existant pour le calcul des heures réelles peut être déplacé dans le modal */}
            </div>
          </SheetContent>
        </Sheet>
        {renderFeatureModal()}
      </div>
    );
  };

  const renderDay = (date: Date) => {
    const dateString = normalizeDate(date);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
    const isFerie = joursFeries2025[dateString];
    const isCalculatedDate = calculatedDate &&
      normalizeDate(calculatedDate.date) === dateString;
    const isStartDate = calculatedDate &&
      normalizeDate(calculatedDate.startDate) === dateString;

    const echeancesDuJour = getEcheancesPaie(date.getFullYear(), date.getMonth())
      .filter(e => e.date === date.getDate());

    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            ref={isCalculatedDate ? calculatedDayRef : undefined}
            className={cn(
              "p-3 rounded-lg min-h-24",
              "border border-gray-100",
              "transition-all duration-200",
              isWeekend && "bg-[#42D80F]/20",
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
                {calculatedDate.delayType === 'retractation' ? " (Rétractation)" : " (Subrogation)"}
                {calculatedDate.carenceDays > 0 && ` avec ${calculatedDate.carenceDays} jours de carence`}
              </div>
            )}{isStartDate && (
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
  const renderCustomDaysDialog = () => {
    const [calculatedCustomDays, setCalculatedCustomDays] = useState<{
      workDays?: number;
      workableDays?: number;
      type: 'ouvré' | 'ouvrable';
    } | null>(null);

    const calculateCustomDays = () => {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let workDays = 0;
      let workableDays = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        const dateString = normalizeDate(date);

        if (form.watch("type") === "ouvré") {
          if (!customRestDays.includes(dayOfWeek) && !joursFeries2025[dateString]) {
            workDays++;
          }
        } else if (form.watch("type") === "ouvrable") {
          if (dayOfWeek !== customNonWorkingDay && !joursFeries2025[dateString]) {
            workableDays++;
          }
        }
      }

      setCalculatedCustomDays({
        workDays: form.watch("type") === "ouvré" ? workDays : undefined,
        workableDays: form.watch("type") === "ouvrable" ? workableDays : undefined,
        type: form.watch("type")
      });
    };

    return (
      <Dialog open={showCustomDaysDialog} onOpenChange={setShowCustomDaysDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.watch("type") === "ouvré"
                ? "Personnaliser les jours de repos"
                : "Personnaliser le jour non travaillé"}
            </DialogTitle>
          </DialogHeader>

          {form.watch("type") === "ouvré" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sélectionnez deux jours de repos</label>
                <div className="grid grid-cols-2 gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div
                      key={day.value}
                      className={cn(
                        "p-2 rounded-md border cursor-pointer transition-colors",
                        customRestDays.includes(day.value)
                          ? "bg-orange-100 border-orange-500 text-orange-700"
                          : "border-gray-200 hover:border-orange-500/50"
                      )}
                      onClick={() => {
                        if (customRestDays.includes(day.value)) {
                          setCustomRestDays(customRestDays.filter(d => d !== day.value));
                        } else if (customRestDays.length < 2) {
                          setCustomRestDays([...customRestDays, day.value]);
                        }
                      }}
                    >
                      {day.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sélectionnez le jour non travaillé</label>
                <div className="grid grid-cols-2 gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div
                      key={day.value}
                      className={cn(
                        "p-2 rounded-md border cursor-pointer transition-colors",
                        customNonWorkingDay === day.value
                          ? "bg-orange-100 border-orange-500 text-orange-700"
                          : "border-gray-200 hover:border-orange-500/50"
                      )}
                      onClick={() => setCustomNonWorkingDay(day.value)}
                    >
                      {day.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {calculatedCustomDays && (
            <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm font-medium text-orange-800">
                Pour {selectedDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}:
              </p>
              <p className="text-sm text-orange-700">
                {calculatedCustomDays.type === 'ouvré'
                  ? `Jours ouvrés personnalisés : ${calculatedCustomDays.workDays} jours`
                  : `Jours ouvrables personnalisés : ${calculatedCustomDays.workableDays} jours`
                }
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setCalculatedCustomDays(null);
                setShowCustomDaysDialog(false);
              }}
            >
              Fermer
            </Button>
            <Button
              variant="default"
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={calculateCustomDays}
              disabled={
                (form.watch("type") === "ouvré" && customRestDays.length !== 2) ||
                (form.watch("type") === "ouvrable" && customNonWorkingDay === null)
              }
            >
              Calculer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const renderDelayForm = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmitDelay)} className="space-y-4">
        <FormField
          control={form.control}
          name="days"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {form.watch("delayType") === "subrogation"
                  ? "Nombre de jours jusqu'à fin de subrogation"
                  : "Nombre de jours"
                }
              </FormLabel>
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
              <div className="flex gap-2">
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Sélectionnez un type de délai" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="calendaire">Calendaire</SelectItem>
                    <SelectItem value="ouvré">Ouvré</SelectItem>
                    <SelectItem value="ouvrable">Ouvrable</SelectItem>
                  </SelectContent>
                </Select>
                {(field.value === 'ouvré' || field.value === 'ouvrable') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowCustomDaysDialog(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch("type") === "calendaire" && (
          <FormField
            control={form.control}
            name="delayType"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Type de calcul</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="flex flex-col space-y-1"
                  >
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="retractation" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Délai de rétractation
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="subrogation" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Date de fin de subrogation
                      </FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormDescription>
                  {field.value === "retractation"
                    ? "La date d'échéance sera automatiquement reportée au prochain jour ouvré si elle tombe un weekend ou un jour férié."
                    : "Calcul de la date de fin de subrogation à partir de la date de début d'arrêt."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {form.watch("delayType") === "subrogation" && (
          <FormField
            control={form.control}
            name="carenceDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Délai de carence avant maintien de salaire</FormLabel>                <FormControl>
                  <Input
                    type="number"
                    min="0"                    {...field}
                    onChange={e => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Nombre de jours de carence avant le début du maintien de salaire
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" className="w-full">
          Calculer
        </Button>

        {calculatedDate && (
          <div className="mt-6 space-y-4" id="calculation-results">
            <div className="p-4 rounded-lg bg-gray-50 space-y-2">
              <div className="font-medium text-gray-700">Résultat du calcul :</div>
              <div className="space-y-1">
                <div className="text-sm text-gray-600">
                  {calculatedDate.delayType === 'subrogation'
                    ? "Date de début d'arrêt : "
                    : "Date de départ : "
                  }
                  {calculatedDate.startDate.toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                </div>
                {calculatedDate.carenceDays > 0 && (
                  <div className="text-sm text-gray-600">
                    Délai de carence avant maintien de salaire : {calculatedDate.carenceDays} jours
                  </div>
                )}
                <div className="text-sm text-gray-600">
                  {calculatedDate.delayType === 'subrogation'
                    ? `Durée de subrogation : ${calculatedDate.days} jour${calculatedDate.days > 1 ? 's' : ''} ${calculatedDate.type}`
                    : `Délai : ${calculatedDate.days} jour${calculatedDate.days > 1 ? 's' : ''} ${calculatedDate.type}`
                  }
                </div>
                {calculatedDate.customRestDays && (
                  <div className="text-sm text-gray-600">
                    Jours de repos : {calculatedDate.customRestDays.map(day =>
                      DAYS_OF_WEEK[day].label
                    ).join(', ')}
                  </div>
                )}
                {calculatedDate.nonWorkingDay !== undefined && (
                  <div className="text-sm text-gray-600">
                    Jour non travaillé : {DAYS_OF_WEEK[calculatedDate.nonWorkingDay].label}
                  </div>
                )}
                <div className="font-medium text-gray-900">
                  {calculatedDate.delayType === 'subrogation'
                    ? "Date de fin de subrogation : "
                    : "Date d'échéance : "
                  }
                  {calculatedDate.date.toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const resultsElement = document.getElementById('calculation-results');
                  if (resultsElement) {
                    resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                Voir les résultats
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
  );

  return (
    <>
      <Dialog open={isDelayDialogOpen} onOpenChange={setIsDelayDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Calculer un délai</DialogTitle>
            <DialogDescription>
              {form.watch("delayType") === "subrogation"
                ? `Date de début d'arrêt : ${currentDate?.toLocaleDateString('fr-FR', { dateStyle: 'long' })}`
                : `À partir du ${currentDate?.toLocaleDateString('fr-FR', { dateStyle: 'long' })}`
              }
            </DialogDescription>
          </DialogHeader>
            {renderDelayForm()}
        </DialogContent>
      </Dialog>

      {renderCustomDaysDialog()}

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

          <div className="flex-1 text-center">
            <h2 className="text-2xl font-bold text-gray-800">
              {viewMode === 'year'
                ? "2025"
                : `${selectedDate.toLocaleDateString('fr-FR', { month: 'long' })} 2025`
              }
            </h2>
          </div>

          {viewMode === 'month' && (
            <>
              <button
                className="flex items-center gap-2 text-gray-600 hover:bg-[#42D80F]/10 p-2 rounded-lg transition-colors ml-auto mr-4"
                onClick={() => setViewMode('year')}
              >
                <Calendar className="h-5 w-5" />
                Vue annuelle
              </button>

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
            </>
          )}
        </div>

        {viewMode === 'month' && showHelpAlert && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-6 right-6 max-w-sm bg-white rounded-lg shadow-lg border border-orange-200 p-4"
          >
            <button
              onClick={() => setShowHelpAlert(false)}
              className="absolute top-2 right-2 text-orange-500 hover:text-orange-700"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <MousePointerClick className="h-5 w-5 text-orange-500 flex-shrink-0 mt-1" />
              <div>
                <p className="text-sm text-gray-600">
                  Pour calculer des délais, faites un clic droit sur une date dans le calendrier.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {viewMode === 'year' ? renderAnnualView() : renderMonthView()}
        </AnimatePresence>
      </div>
    </>
  );
};

export default CalendrierPaie;