import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'expenses:v1';
const ExpensesContext = createContext(null);

export function ExpensesProvider({ children }) {
  const [expenses, setExpenses] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setExpenses(JSON.parse(raw)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(expenses)).catch(() => {});
  }, [expenses, loaded]);

  const addExpense = useCallback(({ amount, description, category, date }) => {
    const entry = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      amount,
      description,
      category,
      date,
      createdAt: Date.now(),
    };
    setExpenses((prev) => [entry, ...prev]);
  }, []);

  const removeExpense = useCallback((id) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Expenses grouped by "YYYY-MM-DD", newest first within each day.
  const byDate = useMemo(() => {
    const map = {};
    for (const e of expenses) (map[e.date] ||= []).push(e);
    for (const k in map) map[k].sort((a, b) => b.createdAt - a.createdAt);
    return map;
  }, [expenses]);

  const value = useMemo(
    () => ({ expenses, byDate, loaded, addExpense, removeExpense }),
    [expenses, byDate, loaded, addExpense, removeExpense]
  );

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>;
}

export const useExpenses = () => useContext(ExpensesContext);

export const sumAmounts = (list = []) => list.reduce((t, e) => t + e.amount, 0);
