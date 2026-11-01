# Task Scheduler

A task scheduler for phone and laptop. React + TypeScript + Vite on the front end, Supabase (Postgres, Auth, Realtime) as the single database.

## Setup

You need a free [Supabase](https://supabase.com) project.

1. **Create the tables.** In the Supabase dashboard, open **SQL Editor**, paste the contents of [supabase/schema.sql](supabase/schema.sql), and run it.
2. **Add your keys.** Copy `.env.example` to `.env`, then fill in the values from **Project Settings > API**.
3. **Run it.**

   ```
   npm install
   npm run dev
   ```

4. **Create your account** in the app. Supabase emails a confirmation link by default. To skip that, turn off **Confirm email** under **Authentication > Sign In / Providers**.

**Updating an existing database:** run the whole of `schema.sql` again after pulling new features. It is safe to re-run and keeps your data.

## Features

- **Today:** today's tasks, plus overdue ones you can check off or move to today.
- **Add and edit:** title, date, optional time, reminder, repeat, label and urgency. Tap any task to edit or delete it.
- **Calendar:** task counts per day. Tap a day to see its tasks or add one. Accomplished tasks are listed below, by date.
- **Repeating tasks:** daily, weekly or monthly. Changes can apply to one task or to it and all future ones. Occurrences exist 90 days ahead for daily tasks, 180 for weekly and a year for monthly, and extend automatically.
- **Reminders:** appear as a banner on any device with the app open, and as a browser notification where the browser allows it. Dismissing one clears it on your other devices. Nothing can notify you while the app is closed; that would need the app to be installable, plus a server function.
- **Search:** by title, status, urgency and label.
- **Custom labels:** add them while creating a task, or manage them from the side menu. Deleting one moves its tasks to Other.
- **Insights:** in the side menu, charts of what you accomplished, per category and over time.
- **Installable:** add it to your home screen for a full-screen app that opens with no signal, showing your tasks from the last sync. Saving still needs a connection.

## Using it on your phone

Sign in with the same account on both devices. Everything reads and writes the one Supabase database, and changes appear on the other device live.

**To test over Wi-Fi:** run `npm run dev -- --host`, then open the `Network` address it prints on your phone.

**To use it anywhere:** deploy it. On [Vercel](https://vercel.com), import the project and add the two `VITE_SUPABASE_*` values as environment variables. `vercel.json` already handles page routing. Then add the deployed URL under **Authentication > URL Configuration** in Supabase, so confirmation emails link to it.

Once your account exists on a deployed app, you can turn off **Allow new users to sign up** in Supabase. Other accounts could never see your tasks, but this also stops strangers registering.

## Installing on your phone

The app must be deployed on HTTPS first; it won't install from a `http://192.168.x.x` address.

- **Android (Chrome):** open the side menu and tap **Install app**, or use the browser menu.
- **iPhone (Safari):** tap Share, then **Add to Home Screen**.
- **Laptop (Chrome or Edge):** open the side menu and click **Install app**.

Updates download by themselves, and the app asks before switching to a new version.

## How sync avoids duplicates

- **One database.** Tasks live only in Supabase. Devices don't keep their own copies that would need merging.
- **Safe retries.** Each task gets its ID when the form opens. If a save is retried, it updates the same row rather than creating another.
- **Merging by ID.** A change that reaches a device twice is applied once.
- **Catching up.** Besides the live connection, the app re-reads the database when it returns to the foreground, comes back online, and once a minute. A phone that was asleep still catches up.

The app needs a connection to save. If a save fails, it says so and keeps your input.

Your light or dark mode choice is stored per device rather than in the database. Each device also keeps a read-only copy of the last sync for offline viewing, which is replaced on every sync and removed when you sign out.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm test` | Run unit tests |
| `npm run build` | Type-check and build for production |
