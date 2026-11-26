# Daanav

A gym workout tracker: pick a body part, choose an exercise, log each set's weight and reps, and follow your progress by day, week and month.

**Live app:** https://aggvishal.github.io/daanav/

- Frontend: plain HTML, CSS and JavaScript, hosted on GitHub Pages
- Backend: Firebase Authentication (email + password) and Cloud Firestore
- Works offline. Changes sync when you're back online.

## Files
| File | What it does |
|---|---|
| `index.html`, `styles.css`, `app.js` | The app |
| `config.js` | Firebase web config (public by design) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and Home Screen icon |
| `firebase/firestore.rules` | Security rules: each user can only read and write their own data |

## Updating
Edit the files and commit to `main`. GitHub Pages republishes in a minute or two.
