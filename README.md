# Daanav

A gym workout tracker: pick a body part, choose an exercise, log each set's weight and reps, and follow your progress by day, week and month.

**Live app:** https://aggvishal.github.io/daanav/

- Frontend: plain HTML, CSS and JavaScript, hosted on GitHub Pages
- Backend: Firebase Authentication (email + password) and Cloud Firestore
- Works offline. Changes sync when you're back online.

## Features
- Pick the body part you're training, then log each exercise's sets (weight × reps)
- See what you lifted last time and get a PR badge when you beat your best
- Weekly and monthly progress: new PRs, "Getting stronger" (estimated 1-rep max vs your previous best), sets per muscle against the 10–20 sets/week guideline, and volume (weight × reps)
- Strength chart for each exercise, with estimated 1-rep max
- Workout history by date, sign in with Google or email
- Log a workout for a past day if you forgot (Today / Yesterday / any earlier date)
- Start and end photos for every exercise, with step-by-step instructions and muscles worked — tap the photo for the full How-to
- Three themes (Daanav Red, Iron, Chalk), saved to your account
- An animated celebration when you finish a workout
- Consistency calendar with ticked training days, week streak and best streak
- Share your finished workout (with your month calendar and streak) as an Instagram or WhatsApp story image
- Profile photo (resized on the phone; Google photo used by default)
- Asks Female / Male / Prefer not to say and orders body parts and exercises to suit (new Glutes day: hip thrust, glute bridge, kickbacks, sumo squat, abduction and more)
- Home feed of your workouts with your week streak (Strava-style)
- Post-workout photo on the celebration screen, your story image and the Home feed
- Trophy case: 29 Daanav trophies for showing up, consistency, strength, intensity and variety — you vs you
- Share your weekly or monthly recap as a story image from the Progress tab
- Back button / swipe-back works on every screen
- Side menu with Account, Plans, Invite friends and Admin
- Admin (only for the admin email): pricing and free trial, sitewide offers, coupons, referrals, users list, announcement banner and guest-mode switch
- Try the app without an account (workouts stay on the phone, and move into your account when you sign up)

## Files
| File | What it does |
|---|---|
| `index.html`, `styles.css`, `app.js` | The app |
| `figures.js` | Form tips, muscles worked, and simple figures for custom exercises |
| `exdata.js`, `img/ex/` | Exercise photos and step-by-step instructions |
| `config.js` | Firebase web config (public by design) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and Home Screen icon |
| `firebase/firestore.rules` | Security rules: each user can only read and write their own data |

## Updating
Edit the files and commit to `main`. GitHub Pages republishes in a minute or two.

## Credits
Exercise photos and instructions come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) by yuhonas, released into the public domain under the Unlicense (see `img/ex/LICENSE-free-exercise-db.md`).
