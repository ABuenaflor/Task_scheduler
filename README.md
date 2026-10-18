# Task Scheduler — Expense Tracker

A simple mobile expense tracker built with Expo (React Native). No login; data is saved on the device.

## Run

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app (Android/iOS), or press `a` for an Android emulator.

## Features

- **Home**: today's expenses and total. Long-press an expense to delete it.
- **+ button** (bottom right): add an amount, a description and a label (Food, Transportation, Rent, Bills, Shopping, Health, Entertainment, Other).
- **Calendar** (top right): month view. Tap a date to see that day's expenses and total. Dots mark days with expenses.
- **Menu** (top left): a side nav with insights. It shows stat tiles, spending by label (donut), the last 7 days (bars), this month's daily trend (line with average), and monthly totals (6 months).

## Structure

```
App.js                 providers + home screen
src/theme.js           colors, categories, money formatting
src/store.js           expense state + AsyncStorage persistence
src/dates.js           date helpers
src/usePresence.js     enter/exit animation helper
src/HomeScreen.js
src/components/        AddExpenseSheet, CalendarView, SideNav, Charts, ExpenseItem, IconButton
```
