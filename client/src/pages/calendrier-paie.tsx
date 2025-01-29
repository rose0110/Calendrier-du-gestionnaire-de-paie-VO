import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const CalendrierPaie = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('year');

  const joursFeries2025 = {
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

  const getEcheancesPaie = (year: number, month: number) => {
    const dsn50Plus = calculateDSNDate(year, month, 5);
    const dsnMoins50 = calculateDSNDate(year, month, 15);
    
    return [
      { 
        date: dsn50Plus.getDate(), 
        description: 'DSN entreprises +50 salariés',
        importance: 'high'
      },
      { 
        date: dsnMoins50.getDate(), 
        description: 'DSN entreprises -50 salariés',
        importance: 'high'
      }
    ];
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
      
      return (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
        >
          <Card 
            className="cursor-pointer hover:shadow-lg transition-all duration-300 border-[#42D80F]/20 hover:border-[#42D80F]"
            onClick={() => {
              setSelectedDate(date);
              setViewMode('month');
            }}
          >
            <CardContent className="p-4">
              <h3 className="font-bold text-lg text-[#42D80F] mb-3 font-figtree">
                {date.toLocaleDateString('fr-FR', { month: 'long' })}
              </h3>
              <div className="space-y-3 text-sm font-figtree">
                <div className="space-y-1">
                  <div className="flex justify-between text-gray-700">
                    <span>Jours ouvrés</span>
                    <span className="font-semibold">{workDays}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Jours ouvrables</span>
                    <span className="font-semibold">{workableDays}</span>
                  </div>
                </div>
                
                {feriesDuMois.length > 0 && (
                  <div className="text-red-600 text-xs space-y-1">
                    <div className="font-semibold">Jours fériés :</div>
                    {feriesDuMois.map(({ jour, label }) => (
                      <div key={jour}>{jour} - {label}</div>
                    ))}
                  </div>
                )}
                
                <div className="text-[#42D80F] text-xs space-y-1">
                  <div className="font-semibold">Échéances DSN :</div>
                  <div>
                    +50 salariés : {dsn50Plus.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}
                  </div>
                  <div>
                    -50 salariés : {dsnMoins50.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}
                  </div>
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
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const { workDays, workableDays } = calculateWorkDays(year, month);
    const echeances = getEcheancesPaie(year, month);

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1);
      const dateString = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isFerie = joursFeries2025[dateString];
      const echeancesDuJour = echeances.filter(e => e.date === (i + 1));

      return (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: i * 0.01 }}
        >
          <div 
            className={cn(
              "p-2 border rounded-lg min-h-24",
              isWeekend ? "bg-gray-50/50" : 
              isFerie ? "bg-red-50/50" : 
              "bg-white",
              "hover:shadow-md transition-shadow duration-200"
            )}
          >
            <div className="flex justify-between items-center mb-1">
              <span className={cn(
                "font-bold font-figtree",
                isWeekend ? "text-gray-400" :
                isFerie ? "text-red-500" :
                "text-gray-700"
              )}>
                {i + 1}
              </span>
            </div>
            {isFerie && (
              <div className="text-xs text-red-600 font-medium mb-1 font-figtree">
                {joursFeries2025[dateString]}
              </div>
            )}
            {echeancesDuJour.map((echeance, idx) => (
              <div 
                key={idx}
                className="text-xs p-1.5 rounded mt-1 bg-[#42D80F]/10 text-[#42D80F] font-semibold font-figtree"
              >
                {echeance.description}
              </div>
            ))}
          </div>
        </motion.div>
      );
    });

    const emptyCells = Array.from({ length: firstDayOfMonth }, (_, i) => (
      <div key={`empty-${i}`} className="p-2 border-0"></div>
    ));

    return (
      <Card className="border-[#42D80F]/20">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[#42D80F]/10 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-700 font-figtree">Jours ouvrés</div>
              <div className="text-2xl font-bold text-[#42D80F] font-figtree">{workDays}</div>
            </div>
            <div className="bg-[#42D80F]/10 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-700 font-figtree">Jours ouvrables</div>
              <div className="text-2xl font-bold text-[#42D80F] font-figtree">{workableDays}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(day => (
              <div key={day} className="font-bold text-center p-2 text-gray-600 font-figtree">
                {day}
              </div>
            ))}
            {emptyCells.concat(days)}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 font-figtree">
      <div className="flex justify-between items-center mb-8">
        <button 
          className="flex items-center p-2 hover:bg-[#42D80F]/10 rounded-lg transition-colors"
          onClick={() => {
            if (viewMode === 'month') {
              const newDate = new Date(selectedDate);
              newDate.setMonth(selectedDate.getMonth() - 1);
              setSelectedDate(newDate);
            } else {
              const newDate = new Date(selectedDate);
              newDate.setFullYear(selectedDate.getFullYear() - 1);
              setSelectedDate(newDate);
            }
          }}
        >
          <ChevronLeft className="h-6 w-6 text-[#42D80F]" />
        </button>
        
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-[#42D80F]">
            {viewMode === 'year' 
              ? selectedDate.getFullYear()
              : `${selectedDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
            }
          </h2>
          {viewMode === 'month' && (
            <button 
              className="flex items-center gap-2 text-[#42D80F] hover:bg-[#42D80F]/10 p-2 rounded-lg transition-colors"
              onClick={() => setViewMode('year')}
            >
              <Calendar className="h-5 w-5" />
              Vue annuelle
            </button>
          )}
        </div>

        <button 
          className="flex items-center p-2 hover:bg-[#42D80F]/10 rounded-lg transition-colors"
          onClick={() => {
            if (viewMode === 'month') {
              const newDate = new Date(selectedDate);
              newDate.setMonth(selectedDate.getMonth() + 1);
              setSelectedDate(newDate);
            } else {
              const newDate = new Date(selectedDate);
              newDate.setFullYear(selectedDate.getFullYear() + 1);
              setSelectedDate(newDate);
            }
          }}
        >
          <ChevronRight className="h-6 w-6 text-[#42D80F]" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'year' ? renderAnnualView() : renderMonthView()}
      </AnimatePresence>
    </div>
  );
};

export default CalendrierPaie;
