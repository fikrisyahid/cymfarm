"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getTodayDateStr } from "@/lib/offline-db";

interface DateContextType {
  selectedDate: string; // 'YYYY-MM-DD'
  setSelectedDate: (date: string) => void;
  isToday: boolean;
  goToToday: () => void;
}

const DateContext = createContext<DateContextType>({
  selectedDate: getTodayDateStr(),
  setSelectedDate: () => {},
  isToday: true,
  goToToday: () => {},
});

export function DateProvider({ children }: { children: React.ReactNode }) {
  const [selectedDate, setSelectedDateState] = useState<string>(getTodayDateStr());
  const todayStr = getTodayDateStr();

  const isToday = selectedDate === todayStr;

  const setSelectedDate = (date: string) => {
    const today = getTodayDateStr();
    if (date > today) {
      setSelectedDateState(today);
    } else {
      setSelectedDateState(date);
    }
  };

  const goToToday = () => {
    setSelectedDateState(todayStr);
  };

  return (
    <DateContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        isToday,
        goToToday,
      }}
    >
      {children}
    </DateContext.Provider>
  );
}

export function useOperasionalDate() {
  return useContext(DateContext);
}
