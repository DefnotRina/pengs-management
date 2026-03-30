import * as React from "react";
import { format, parseISO, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  date?: Date | string;
  onChange?: (date: Date | undefined) => void;
  onStringChange?: (date: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function DatePicker({
  date,
  onChange,
  onStringChange,
  className,
  placeholder = "Pick a date",
  disabled = false,
}: DatePickerProps) {
  // Normalize the date to a Date object for the Calendar component
  const selectedDate = React.useMemo(() => {
    if (!date) return undefined;
    if (date instanceof Date) return date;
    const parsed = parseISO(date);
    return isValid(parsed) ? parsed : undefined;
  }, [date]);

  const handleSelect = (newDate: Date | undefined) => {
    if (onChange) {
      onChange(newDate);
    }
    if (onStringChange && newDate) {
      // Return YYYY-MM-DD format commonly used in Supabase/Forms
      onStringChange(format(newDate, "yyyy-MM-dd"));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10 px-3 py-2 text-sm bg-background border-input",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
          {selectedDate ? format(selectedDate, "MM/dd/yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
