import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

export interface YearContextValue {
  selectedYear: number;
  setSelectedYear: Dispatch<SetStateAction<number>>;
  availableYears: number[];
  setAvailableYears: Dispatch<SetStateAction<number[]>>;
}

const YearContext = createContext<YearContextValue>(null as unknown as YearContextValue);

export function YearProvider({ children }: { children: ReactNode }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear]     = useState(currentYear);
  const [availableYears, setAvailableYears] = useState([currentYear]);

  return (
    <YearContext.Provider value={{ selectedYear, setSelectedYear, availableYears, setAvailableYears }}>
      {children}
    </YearContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useYear = () => useContext(YearContext);
