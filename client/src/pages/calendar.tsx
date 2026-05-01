import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { FeatureGate } from "@/components/upgrade-prompt";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Clock,
  Pill,
  CalendarClock,
  Stethoscope,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface CalendarEvent {
  id: string;
  type: "visit" | "followup" | "medicine_end";
  title: string;
  date: string;
  status: string;
  visitId: string;
  patientName: string;
  notes?: string;
}

const EVENT_COLORS: Record<string, { dot: string; bg: string; text: string; border: string; badge: string }> = {
  visit: {
    dot: "bg-blue-500",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  followup: {
    dot: "bg-orange-500",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
  },
  medicine_end: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
};

const EVENT_ICONS: Record<string, typeof CalendarIcon> = {
  visit: Stethoscope,
  followup: CalendarClock,
  medicine_end: Pill,
};

const EVENT_LABELS: Record<string, string> = {
  visit: "Visit",
  followup: "Follow-up",
  medicine_end: "Medicine Ends",
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function isToday(date: Date) {
  return isSameDay(date, new Date());
}

export default function CalendarPage() {
  const [, setLocation] = useLocation();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events"],
  });

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
      const d = new Date(event.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(event);
    }
    return map;
  }, [events]);

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const prevMonthDays = getDaysInMonth(currentYear, currentMonth - 1);

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(currentYear, currentMonth - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(currentYear, currentMonth, i),
        isCurrentMonth: true,
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(currentYear, currentMonth + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
    return (eventsByDate[key] || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedDate, eventsByDate]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  }, [events]);

  function goToPrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }

  function goToNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }

  function goToToday() {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-[500px] w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <FeatureGate feature="calendarFeatures">
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        subtitle="View appointments, follow-ups, and medication schedules"
        icon={CalendarIcon}
        iconBg="bg-gradient-to-br from-blue-500 to-violet-600"
        testId="text-calendar-title"
        actions={
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" /> Visit</span>
            <span className="flex items-center gap-1 ml-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-500 inline-block" /> Follow-up</span>
            <span className="flex items-center gap-1 ml-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" /> Medicine</span>
          </div>
        }
      />

      <div className="flex flex-col lg:flex-row gap-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
        <div className="glass-card-strong rounded-xl flex-1 overflow-hidden" data-testid="card-calendar-grid">
          <div className="p-6 pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" data-testid="text-current-month">
                {MONTHS[currentMonth]} {currentYear}
              </h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  data-testid="button-today"
                  className="text-xs mr-1"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goToPrevMonth}
                  data-testid="button-prev-month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goToNextMonth}
                  data-testid="button-next-month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="px-6 pb-6">
            <div className="grid grid-cols-7 gap-px">
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-semibold text-muted-foreground py-2 uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}

              {calendarDays.map(({ date, isCurrentMonth }, index) => {
                const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                const dayEvents = eventsByDate[key] || [];
                const todayHighlight = isToday(date);
                const isSelected = selectedDate && isSameDay(date, selectedDate);

                return (
                  <div
                    key={index}
                    data-testid={`cell-day-${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`}
                    className={`
                      min-h-[80px] p-1.5 border border-white/30 rounded-lg transition-colors cursor-pointer
                      ${isCurrentMonth ? "bg-white/40 backdrop-blur-sm" : "bg-white/10 text-muted-foreground/50"}
                      ${todayHighlight ? "ring-2 ring-blue-500/50 bg-blue-50/50" : ""}
                      ${isSelected ? "ring-2 ring-primary bg-primary/10" : ""}
                      ${dayEvents.length > 0 ? "hover:bg-white/60" : "hover:bg-white/30"}
                    `}
                    onClick={() => {
                      if (dayEvents.length > 0) {
                        setSelectedDate(date);
                      }
                    }}
                  >
                    <div className={`text-xs font-medium mb-1 ${todayHighlight ? "text-blue-600 font-bold" : ""}`}>
                      {date.getDate()}
                    </div>
                    <div className="flex flex-wrap gap-0.5">
                      {dayEvents.slice(0, 3).map((event) => {
                        const colors = EVENT_COLORS[event.type];
                        return (
                          <button
                            key={event.id}
                            data-testid={`event-dot-${event.id}`}
                            className={`h-2 w-2 rounded-full ${colors.dot} hover:scale-150 transition-transform`}
                            title={event.title}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(date);
                            }}
                          />
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className="text-[9px] text-muted-foreground font-medium leading-none flex items-center">
                          +{dayEvents.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {selectedDate && selectedDateEvents.length > 0 && (
          <div className="glass-card-strong rounded-xl lg:w-96 shrink-0 overflow-hidden animate-fade-up" data-testid="card-event-detail">
            <div className="p-6 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold">Events</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSelectedDate(null)}
                  data-testid="button-close-detail"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="px-6 pb-6 space-y-3 max-h-[500px] overflow-y-auto">
              {selectedDateEvents.map((event) => {
                const colors = EVENT_COLORS[event.type];
                const Icon = EVENT_ICONS[event.type];
                return (
                  <div
                    key={event.id}
                    data-testid={`card-day-event-${event.id}`}
                    className={`p-3 rounded-lg border ${colors.border} ${colors.bg} space-y-2`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg ${colors.dot} flex items-center justify-center shrink-0`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge className={`${colors.badge} text-[10px]`}>
                            {EVENT_LABELS[event.type]}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {event.status}
                          </Badge>
                        </div>
                        <p className={`text-sm font-semibold mt-1 ${colors.text} truncate`}>
                          {event.title}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(event.date).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Stethoscope className="h-3 w-3" />
                        {event.patientName}
                      </span>
                    </div>
                    {event.notes && (
                      <p className="text-xs text-muted-foreground bg-white/40 p-2 rounded-md line-clamp-2">
                        {event.notes}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-7"
                      onClick={() => setLocation(`/visit/${event.visitId}`)}
                      data-testid={`button-view-visit-${event.id}`}
                    >
                      View Visit Details
                      <ArrowRight className="ml-1.5 h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="glass-card-strong rounded-xl overflow-hidden animate-fade-up" style={{ animationDelay: "200ms" }} data-testid="card-upcoming-events">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="icon-container h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Upcoming Events</h2>
              <p className="text-sm text-muted-foreground">Next scheduled appointments and follow-ups</p>
            </div>
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-12" data-testid="text-no-events">
              <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <CalendarIcon className="h-8 w-8 text-blue-400" />
              </div>
              <p className="text-lg font-semibold text-foreground">No upcoming events</p>
              <p className="text-sm text-muted-foreground mt-1">
                Events will appear here when visits are scheduled.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((event) => {
                const colors = EVENT_COLORS[event.type];
                const Icon = EVENT_ICONS[event.type];
                const eventDate = new Date(event.date);
                return (
                  <div
                    key={event.id}
                    data-testid={`card-upcoming-event-${event.id}`}
                    className={`flex items-center justify-between p-3 rounded-lg border ${colors.border} ${colors.bg} cursor-pointer hover:shadow-sm transition-all`}
                    onClick={() => {
                      setSelectedDate(eventDate);
                      setCurrentMonth(eventDate.getMonth());
                      setCurrentYear(eventDate.getFullYear());
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg ${colors.dot} flex items-center justify-center`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${colors.text}`}>{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {eventDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {" · "}
                          {eventDate.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${colors.badge} text-xs`}>
                        {EVENT_LABELS[event.type]}
                      </Badge>
                      <button
                        data-testid={`button-goto-visit-${event.id}`}
                        className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/60 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/visit/${event.visitId}`);
                        }}
                      >
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
    </FeatureGate>
  );
}
