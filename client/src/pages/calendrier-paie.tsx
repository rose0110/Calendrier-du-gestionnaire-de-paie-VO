import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, X, MousePointerClick, Settings, Calculator } from 'lucide-react';
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

const formSchema = z.object({
  days: z.number().min(1, "Le nombre de jours doit être supérieur à 0"),
  type: z.enum(['calendaire', 'ouvré', 'ouvrable'], {
    required_error: "Veuillez sélectionner un type de délai"
  }),
  delayType: z.enum(['retractation', 'subrogation']).optional(),
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
    delayType?: 'retractation' | 'subrogation';
    carenceDays: number;
    customRestDays?: number[];
    nonWorkingDay?: number;
  } | null>(null);
  const [isDelayDialogOpen, setIsDelayDialogOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [showCustomDaysDialog, setShowCustomDaysDialog] = useState(false);
  const [customRestDays, setCustomRestDays] = useState<number[]>([6, 0]); // Samedi et Dimanche par défaut
  const [customNonWorkingDay, setCustomNonWorkingDay] = useState<number | null>(0); // Dimanche par défaut
  const [showRealDaysCalculator, setShowRealDaysCalculator] = useState(false);
  const [calculatorMode, setCalculatorMode] = useState<'days' | 'hours'>('days');
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState(22);
  const [dailyHoursSchedule, setDailyHoursSchedule] = useState<{[key: string]: number}>({});
  const [selectedAbsenceDates, setSelectedAbsenceDates] = useState<string[]>([]);
  const [calcMonth, setCalcMonth] = useState(selectedDate.getMonth());
  const [calcYear, setCalcYear] = useState(selectedDate.getFullYear());
  const [weeklyWorkingDays, setWeeklyWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]); // Lun-Ven par défaut
  const [weeklyHours, setWeeklyHours] = useState(35);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      days: 1,
      carenceDays: 0,
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

  const calculateWorkDays = useCallback((year: number, month: number) => {
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
  }, []);

  const getEcheancesPaie = useCallback((year: number, month: number): Echeance[] => {
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
          type: ea.type as TypeEcheance,
          importance: ea.importance as 'high' | 'normal'
        });
      });

    return echeances;
  }, []);

  const calculateFutureDate = (
    startDate: Date,
    days: number,
    type: 'calendaire' | 'ouvré' | 'ouvrable',
    delayType: 'retractation' | 'subrogation' | undefined,
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

    // Récupérer les jours de repos personnalisés
    const finalRestDays = values.type === 'ouvré' ? customRestDays : [6, 0];
    const finalNonWorkingDay = values.type === 'ouvrable' ? (customNonWorkingDay !== null ? customNonWorkingDay : 0) : 0;

    const result = calculateFutureDate(
      currentDate,
      values.days,
      values.type,
      values.delayType || 'retractation',
      values.carenceDays || 0,
      finalRestDays,
      finalNonWorkingDay
    );

    setCalculatedDate({
      date: result,
      startDate: currentDate,
      days: values.days,
      type: values.type,
      delayType: values.delayType,
      carenceDays: values.carenceDays || 0,
      customRestDays: values.type === 'ouvré' ? finalRestDays : undefined,
      nonWorkingDay: values.type === 'ouvrable' ? finalNonWorkingDay : undefined
    });

    // Ne pas fermer automatiquement le dialogue pour que l'utilisateur puisse voir le résultat
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
              <div className="flex justify-between items-center">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-600 font-figtree">Jours ouvrés</div>
                  <div className="text-2xl font-bold text-[#42D80F] font-figtree">{workDays}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-600 font-figtree">Jours ouvrables</div>
                  <div className="text-2xl font-bold text-[#42D80F] font-figtree">{workableDays}</div>
                </div>
              </div>
            </div>
            <div 
              className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-lg border border-blue-100 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setCalcMonth(selectedDate.getMonth());
                setCalcYear(selectedDate.getFullYear());
                setShowRealDaysCalculator(true);
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-blue-600 font-figtree">Calcul jours/heures réels</div>
                  <div className="text-xs text-blue-500 mt-1">Cliquez pour calculer</div>
                </div>
                <Calculator className="h-6 w-6 text-blue-500" />
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
        </CardContent>
      </Card>
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

  const renderRealDaysCalculator = () => {
    const getDaysInMonth = (year: number, month: number) => {
      return new Date(year, month + 1, 0).getDate();
    };

    const formatDateKey = (year: number, month: number, day: number) => {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const isAbsenceDate = (dateKey: string) => {
      return selectedAbsenceDates.includes(dateKey);
    };

    const toggleAbsenceDate = (dateKey: string) => {
      if (selectedAbsenceDates.includes(dateKey)) {
        setSelectedAbsenceDates(selectedAbsenceDates.filter(d => d !== dateKey));
      } else {
        setSelectedAbsenceDates([...selectedAbsenceDates, dateKey]);
      }
    };

    const setDailyHours = (dateKey: string, hours: number) => {
      setDailyHoursSchedule({
        ...dailyHoursSchedule,
        [dateKey]: hours
      });
    };

    const calculateResults = () => {
      if (calculatorMode === 'days') {
        // Calculer les jours théoriques basés sur les jours travaillés de la semaine
        const daysInMonth = getDaysInMonth(calcYear, calcMonth);
        let theoricalDays = 0;
        
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(calcYear, calcMonth, day);
          const dayOfWeek = date.getDay();
          const dateKey = formatDateKey(calcYear, calcMonth, day);
          
          if (weeklyWorkingDays.includes(dayOfWeek) && !joursFeries2025[dateKey]) {
            theoricalDays++;
          }
        }
        
        const realDays = theoricalDays - selectedAbsenceDates.length;
        return {
          totalDays: theoricalDays,
          realDays: realDays,
          absenceDays: selectedAbsenceDates.length
        };
      } else {
        // Calculer les heures basées sur les heures hebdomadaires
        const daysInMonth = getDaysInMonth(calcYear, calcMonth);
        let totalHours = 0;
        let absenceHours = 0;
        const dailyHours = weeklyHours / weeklyWorkingDays.length;

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(calcYear, calcMonth, day);
          const dayOfWeek = date.getDay();
          const dateKey = formatDateKey(calcYear, calcMonth, day);
          
          if (weeklyWorkingDays.includes(dayOfWeek) && !joursFeries2025[dateKey]) {
            const hours = dailyHoursSchedule[dateKey] || dailyHours;
            totalHours += hours;
            
            if (selectedAbsenceDates.includes(dateKey)) {
              absenceHours += hours;
            }
          }
        }

        return {
          totalHours: Math.round(totalHours * 10) / 10,
          realHours: Math.round((totalHours - absenceHours) * 10) / 10,
          absenceHours: Math.round(absenceHours * 10) / 10
        };
      }
    };

    const results = calculateResults();

    const renderCalendarGrid = () => {
      const daysInMonth = getDaysInMonth(calcYear, calcMonth);
      const firstDay = new Date(calcYear, calcMonth, 1).getDay();
      const startDay = firstDay === 0 ? 6 : firstDay - 1; // Lundi = 0

      const days = [];
      
      // Jours vides au début
      for (let i = 0; i < startDay; i++) {
        days.push(<div key={`empty-${i}`} className="p-2"></div>);
      }

      // Jours du mois
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = formatDateKey(calcYear, calcMonth, day);
        const isAbsence = isAbsenceDate(dateKey);
        const currentHours = dailyHoursSchedule[dateKey] || 0;

        days.push(
          <div
            key={day}
            className={cn(
              "p-2 border rounded cursor-pointer transition-colors",
              isAbsence ? "bg-red-100 border-red-300" : "bg-white border-gray-200 hover:border-blue-300"
            )}
            onClick={() => toggleAbsenceDate(dateKey)}
          >
            <div className="text-center">
              <div className="font-medium">{day}</div>
              {calculatorMode === 'hours' && (
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  value={currentHours}
                  onChange={(e) => setDailyHours(dateKey, parseFloat(e.target.value) || 0)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full mt-1 text-xs text-center border rounded"
                  placeholder="0h"
                />
              )}
            </div>
          </div>
        );
      }

      return (
        <div className="grid grid-cols-7 gap-1">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
            <div key={day} className="p-2 text-center font-medium text-gray-500 text-sm">
              {day}
            </div>
          ))}
          {days}
        </div>
      );
    };

    return (
      <Dialog open={showRealDaysCalculator} onOpenChange={setShowRealDaysCalculator}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Calcul des jours et heures réels</DialogTitle>
            <DialogDescription>
              Choisissez le type de calcul et configurez les paramètres
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Sélection du mode */}
            <div className="flex gap-4">
              <button
                onClick={() => setCalculatorMode('days')}
                className={cn(
                  "px-4 py-2 rounded-lg border transition-colors",
                  calculatorMode === 'days' 
                    ? "bg-blue-100 border-blue-300 text-blue-700" 
                    : "bg-gray-50 border-gray-200"
                )}
              >
                Calcul des jours réels
              </button>
              <button
                onClick={() => setCalculatorMode('hours')}
                className={cn(
                  "px-4 py-2 rounded-lg border transition-colors",
                  calculatorMode === 'hours' 
                    ? "bg-blue-100 border-blue-300 text-blue-700" 
                    : "bg-gray-50 border-gray-200"
                )}
              >
                Calcul des heures réelles
              </button>
            </div>

            {/* Bouton pour options avancées */}
            <div className="text-center">
              <button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                {showAdvancedOptions ? 'Masquer' : 'Changer de mois/année'}
              </button>
            </div>

            {/* Options avancées (cachées par défaut) */}
            {showAdvancedOptions && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Mois</label>
                  <select 
                    value={calcMonth}
                    onChange={(e) => setCalcMonth(parseInt(e.target.value))}
                    className="w-full p-2 border rounded-md"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>
                        {new Date(2025, i, 1).toLocaleDateString('fr-FR', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Année</label>
                  <input
                    type="number"
                    value={calcYear}
                    onChange={(e) => setCalcYear(parseInt(e.target.value))}
                    className="w-full p-2 border rounded-md"
                  />
                </div>
              </div>
            )}

            {/* Configuration spécifique au mode */}
            {calculatorMode === 'days' && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Jours travaillés habituels du salarié</label>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <div
                        key={day.value}
                        className={cn(
                          "p-2 text-center rounded border cursor-pointer transition-colors text-sm",
                          weeklyWorkingDays.includes(day.value)
                            ? "bg-blue-100 border-blue-300 text-blue-700"
                            : "bg-gray-50 border-gray-200"
                        )}
                        onClick={() => {
                          if (weeklyWorkingDays.includes(day.value)) {
                            setWeeklyWorkingDays(weeklyWorkingDays.filter(d => d !== day.value));
                          } else {
                            setWeeklyWorkingDays([...weeklyWorkingDays, day.value]);
                          }
                        }}
                      >
                        {day.label.slice(0, 3)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {calculatorMode === 'hours' && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Jours travaillés habituels du salarié</label>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <div
                        key={day.value}
                        className={cn(
                          "p-2 text-center rounded border cursor-pointer transition-colors text-sm",
                          weeklyWorkingDays.includes(day.value)
                            ? "bg-blue-100 border-blue-300 text-blue-700"
                            : "bg-gray-50 border-gray-200"
                        )}
                        onClick={() => {
                          if (weeklyWorkingDays.includes(day.value)) {
                            setWeeklyWorkingDays(weeklyWorkingDays.filter(d => d !== day.value));
                          } else {
                            setWeeklyWorkingDays([...weeklyWorkingDays, day.value]);
                          }
                        }}
                      >
                        {day.label.slice(0, 3)}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Nombre d'heures par semaine</label>
                  <input
                    type="number"
                    min="0"
                    max="70"
                    step="0.5"
                    value={weeklyHours}
                    onChange={(e) => setWeeklyHours(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border rounded-md mt-1"
                    placeholder="35"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Heures par jour : {weeklyWorkingDays.length > 0 ? (weeklyHours / weeklyWorkingDays.length).toFixed(1) : 0}h
                  </p>
                </div>
              </div>
            )}

            {/* Calendrier pour les absences */}
            <div>
              <h3 className="text-sm font-medium mb-2">
                {calculatorMode === 'days' 
                  ? "Sélectionnez les jours d'absence (clic sur les dates)" 
                  : "Saisissez les heures par jour et marquez les absences (clic sur les dates)"}
              </h3>
              {renderCalendarGrid()}
              <p className="text-xs text-gray-500 mt-2">
                Dates d'absence sélectionnées : {selectedAbsenceDates.length}
              </p>
            </div>

            {/* Résultats */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">Résultats</h3>
              {calculatorMode === 'days' ? (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-gray-600 text-sm">Jours théoriques</div>
                    <div className="text-2xl font-bold text-blue-600">{results.totalDays}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Jours réels</div>
                    <div className="text-2xl font-bold text-green-600">{results.realDays}</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Jours d'absence</div>
                    <div className="text-2xl font-bold text-red-600">{results.absenceDays}</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-gray-600 text-sm">Heures théoriques</div>
                    <div className="text-2xl font-bold text-blue-600">{results.totalHours}h</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Heures réelles</div>
                    <div className="text-2xl font-bold text-green-600">{results.realHours}h</div>
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Heures d'absence</div>
                    <div className="text-2xl font-bold text-red-600">{results.absenceHours}h</div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedAbsenceDates([]);
                  setDailyHoursSchedule({});
                }}
              >
                Réinitialiser
              </Button>
              <Button variant="outline" onClick={() => setShowRealDaysCalculator(false)}>
                Fermer
              </Button>
            </div>
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
                  onChange={e => field.onChange(parseInt(e.target.value) || 1)}
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

              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch("type") === "ouvré" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sélectionnez deux jours de repos</label>
              <div className="grid grid-cols-2 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div
                    key={day.value}
                    className={cn(
                      "flex items-center space-x-2 p-2 rounded cursor-pointer border",
                      customRestDays.includes(day.value)
                        ? "bg-orange-100 border-orange-300"
                        : "bg-gray-50 border-gray-200"
                    )}
                    onClick={() => {
                      if (customRestDays.includes(day.value)) {
                        setCustomRestDays(customRestDays.filter(d => d !== day.value));
                      } else if (customRestDays.length < 2) {
                        setCustomRestDays([...customRestDays, day.value]);
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={customRestDays.includes(day.value)}
                      readOnly
                      className="rounded"
                    />
                    <span className="text-sm">{day.label}</span>
                  </div>
                ))}
              </div>
              {customRestDays.length > 0 && (
                <p className="text-xs text-gray-500">
                  {customRestDays.length}/2 jours sélectionnés
                </p>
              )}
            </div>
          </div>
        )}

        {form.watch("type") === "ouvrable" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sélectionnez le jour non travaillé</label>
              <div className="grid grid-cols-2 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div
                    key={day.value}
                    className={cn(
                      "flex items-center space-x-2 p-2 rounded cursor-pointer border",
                      customNonWorkingDay === day.value
                        ? "bg-orange-100 border-orange-300"
                        : "bg-gray-50 border-gray-200"
                    )}
                    onClick={() => setCustomNonWorkingDay(day.value)}
                  >
                    <input
                      type="radio"
                      checked={customNonWorkingDay === day.value}
                      readOnly
                      className="rounded"
                    />
                    <span className="text-sm">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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
                        Date de fin de subrogation (maintien de salaire)
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

        {form.watch("delayType") === "subrogation" && form.watch("type") === "calendaire" && (
          <FormField
            control={form.control}
            name="carenceDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Délai de carence avant maintien de salaire</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    {...field}
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
                      DAYS_OF_WEEK.find(d => d.value === day)?.label || 'Inconnu'
                    ).join(', ')}
                  </div>
                )}
                {calculatedDate.nonWorkingDay !== undefined && (
                  <div className="text-sm text-gray-600">
                    Jour non travaillé : {DAYS_OF_WEEK.find(d => d.value === calculatedDate.nonWorkingDay)?.label || 'Inconnu'}
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
                className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors mr-4"
                onClick={() => setShowRealDaysCalculator(true)}
              >
                <Calculator className="h-5 w-5" />
                Calcul jours/heures réels
              </button>

              <button
                className="flex items-center gap-2 text-gray-600 hover:bg-[#42D80F]/10 p-2 rounded-lg transition-colors mr-4"
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

        {renderRealDaysCalculator()}
      </div>
    </>
  );
};

export default CalendrierPaie;