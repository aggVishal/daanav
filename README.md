# Daanav

A gym workout tracker: pick a body part, choose an exercise, log each set's weight and reps, and follow your progress by day, week and month.

**Live app:** https://aggvishal.github.io/daanav/

- Frontend: plain HTML, CSS and JavaScript, hosted on GitHub Pages
- Backend: Firebase Authentication (email + password) and Cloud Firestore
- Works offline. Changes sync when you're back online.

## Features
- Pick the body part you're training, then log each exercise's sets (weight × reps)
- See what you lifted last time and get a PR badge when you beat your best
- Weekly and monthly progress: total weight lifted, sets, workouts and new PRs
- Strength chart for each exercise, with estimated 1-rep max
- Workout history by date, sign in with Google or email
- Animated figure and form tip for every exercise, with a rest timer between sets
- Three themes (Daanav Red, Iron, Chalk), saved to your account
- An animated celebration when you finish a workout

## Files
| File | What it does |
|---|---|
| `index.html`, `styles.css`, `app.js` | The app |
| `figures.js` | Animated exercise figures and form tips |
| `config.js` | Firebase web config (public by design) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and Home Screen icon |
| `firebase/firestore.rules` | Security rules: each user can only read and write their own data |

## Updating
Edit the files and commit to `main`. GitHub Pages republishes in a minute or two.
