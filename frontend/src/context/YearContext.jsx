import { createContext, useContext, useState } from "react";

const YearContext = createContext(null);

export function YearProvider({ children }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear]     = useState(currentYear);
  const [availableYears, setAvailableYears] = useState([currentYear]);

  return (
    <YearContext.Provider value={{ selectedYear, setSelectedYear, availableYears, setAvailableYears }}>
      {children}
    </YearContext.Provider>
  );
}

export const useYear = () => useContext(YearContext);
