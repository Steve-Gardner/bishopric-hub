# 5th Ward Bishopric Hub: Audit and Recommendations

Audit date: October 24, 2026. Covers every source file, the demo data, and a phone-sized walkthrough of each screen.

---

## Status (updated October 24, 2026)

Work is done in Claude Code (Sonnet), following the build order in section 6. Done so far: rec 2 (B1, the device role was being erased on load) and rec 3's first half (the project is now in git). Rec 3 is done: the app is live at https://steve-gardner.github.io/bishopric-hub/ and redeploys on every push to main. Rec 4 (store people by identity) is done. Rec 1 (shared data) is built and working: sign-in codes are emailed. The Supabase project `bishopric-hub` exists, with the tables and access rules in `supabase/schema.sql`. The app signs in by emailed code and reads and writes the shared database. Sign-in codes are sent through a Gmail account's SMTP (a Gmail app password stored in Supabase). The people who may sign in are listed in the `allowed_users` table in Supabase.

### Advice we are not taking

The audit was written without the conversation history. These recommendations undo decisions Steve made on purpose, so they stay on the shelf. Revisit them if real use shows a problem.

| Rec | Why we are not doing it (yet) |
|-----|-------------------------------|
| 7. Splash once per install | Steve asked to see the splash more often, on every refresh. |
| 11 / B2. Always show the big red button | Steve asked for the waiting block to replace the button until it is placed. The block has a remove button, so nobody is stuck. Watch for confusion in real use. |
| 10. Rebuild booking as a form with suggested slots | Steve designed the wizard and chose true drag and drop. Suggested open slots (the useful part) can be added later without replacing it. |
| 21. Edit events on the Calendar itself | Steve asked for editing to live on the Schedule tab, with the Calendar linking there. |
| 25. Remember open sections between visits | Steve asked for every section to start closed on each load. |
| 29. Remove the Youth Council "Coming Soon" tab | Steve asked for it, as a signal of what is planned. |

---

## 1. The three things that matter most

**A. Nothing is shared.** Every phone has its own private copy of the data (browser localStorage). If the Executive Secretary books an interview on their phone, the Bishop's phone never sees it. The only way to move data is Setup → Backup & Restore (download a file, send it, restore it on the other phone, which wipes that phone's data). For a bishopric, this makes the app a personal notebook, not a hub. The data layer was built to be swapped for a shared backend (the comment in `src/data/store.ts` says so), and every page already goes through that one interface, so this is a contained change.

**B. Viewing and editing live on different pages.** The Calendar shows things but you cannot change them there. Every pencil, "+ Add", and "Edit" sends you to the Schedule page, which is actually a settings page of eight collapsed red bars. Agenda's gratitude pencil, Youth's "+ Add", Calendar's "+ Add" and edit taps all jump to Schedule and open one fold. The Clerk and Exec Secretary will experience this as "I tapped a thing and it took me somewhere else and now I'm lost."

**C. The word "schedule" means five different things.** Schedule (the page), Bishopric Schedule (the three-column day grid), Conducting Schedule, Default Monthly Meeting Schedule, Change a Month's Schedule, plus "Schedule for Sunday" on the interview board and "This Month's Meeting Schedule" on the Calendar. Underneath, there are also three separate data models for Sunday meetings (calendar events, the week-of-month template table, and per-Sunday edits) that are stitched together by matching titles as text. That is the hardest part of the app to understand, for users and for future maintenance.

---

## 2. How things connect (and where it is fragile)

```
Setup › Roles (names)  ──► used as free text everywhere: "assignedTo", "leader", conducting, suggestions
Setup › Ward Members   ──► Sacrament prayers/adult speakers, "Not asked lately", interview name suggestions
Setup › Youth Roster   ──► Youth speakers, Patriarchal Blessings, youth interview suggestions
Calendar events        ──► Calendar, Home "Coming up", Agenda meeting dates (events flagged agenda=bishopric/council),
                           Interview board (gray blocks), Youth tab (events with youth groups), Upcoming Events table
Appointments           ──► Calendar day grid, Interview board, Agenda › Bishopric Schedule
Default schedule rows  ──► Calendar › This Month's Meeting Schedule, Change a Month's Schedule
Schedule edits         ──► layered on rows per Sunday; moving a block also moves the matching calendar event BY TITLE
Conducting rules       ──► Conducting Schedule, Sacrament "Conducting" dropdown, Agenda "Conducting:" label
Special dates          ──► Sacrament labels, Calendar Sunday designation, closed Sundays
Lists (ListEditor)     ──► Agenda sections, To Do lists, Ward Goals, event checklists (all free text, keyed by string)
Individuals            ──► Bishopric agenda (private notes) and Ward Council agenda (council notes), one-way privacy
```

Fragile joints found:

1. **People are matched by typed text, not by identity.** An appointment stores `leader: "Bishop Hale"` as a string. If the name in Roles is edited later (even to fix a typo), every past and future appointment with that string drops out of the Bishop's column. Same for "assignedTo" on events. Recommend storing role keys and member IDs, with the display name looked up at render time.
2. **Moving a Sunday block only moves the Agenda's meeting if the titles match exactly.** A template row named "Ward Council" and a calendar event named "Ward Council Meeting" silently diverge. Then Ward Council appears on one Sunday in the Calendar and a different Sunday on the Agenda.
3. **Sunday meetings exist twice on the Calendar page.** The day grid shows the calendar event "Ward Council" and the fold underneath shows the template row "Ward Council". Users will not know which one is real.
4. **To-do lists are not connected to the things they track.** Booking a youth interview does not tick "Youth interviews to do". Sustaining someone (an announcement) does not add them to "Need to be set apart". Callings flow through four unconnected free-text lists (Callings to discuss → Callings to extend → Announcements → Need to be set apart).
5. **The Interview wizard throws away the purpose.** Every booking is saved as purpose "Interview". The demo data shows what is wanted (Tithing declaration, Temple recommend, Youth interview, Calling, Setting apart) but the wizard never asks.
6. **FSY references are orphaned.** The `fsy` store and demo data exist, but no page shows them any more. The Youth page replaced them.
7. **Curriculum data runs out soon.** Youth lesson titles are hard-coded through October 2026 only, and Come, Follow Me is only loaded for 2026. In January the lesson card says "No lesson schedule loaded." Either load 2027 before then or link to the Church's page by date instead of storing titles.

---

## 3. Bugs found

| # | Bug | Where | Effect |
|---|-----|-------|--------|
| B1 | "This Device" role is erased on every page load | `src/main.tsx:11` removes the key `bishopric.myRole`, which `useMyRole.ts` still uses | The "On this device I am" setting never sticks. Verified in the browser: set it, reload, it is gone. The Bishop's "my schedule" calendar default never works. |
| B2 | Interview wizard hides itself | `BookingWizard.tsx` returns nothing while anything is waiting to be placed | If a user makes an interview and does not understand the drag, the big red button disappears and there is no way to make another one. Dead end for a new user. |
| B3 | Day-of-week drag on Change a Month's Schedule uses HTML5 drag events | `MonthlySchedule.tsx` `draggable` / `onDragStart` | These do not fire on iPhone or Android touch. Only the tap-select fallback works on phones, and the help text leads with "drag". |
| B4 | Safari can delete the data | Any site's localStorage is purged by Safari after 7 days without a visit, unless the app is added to the Home Screen | A counselor who opens the link in Safari once a month can lose everything. Another reason for a shared backend. |
| B5 | Nothing is under version control | The folder is not a git repository | No history, no rollback, no safe deploy. |
| B6 | Same-page deep links sometimes do not scroll | `useOpenFromLink.ts` with a 150 ms timer | Observed once: going from Interviews to "Change a Month's Schedule" on the same page left the view where it was. Low priority, worth a retest after restructuring. |
| B7 | Deletes are instant with no undo | List items, program entries, appointments, assignments (the ✕ buttons) | One mis-tap on a phone removes a sacrament speaker or an agenda item permanently. |

---

## 4. Role-by-role walkthrough

### Bishop
Wants, in order: today's interviews and who they are with, this week's agenda, who is conducting, the needs list with private notes, the program for Sunday. The app has all of it, but spread across Calendar, Agenda, Schedule and Sacrament, and the "my schedule" default is broken (B1). The Bishop should open the app on Sunday morning and see one screen: "Sunday, Oct 25. You are conducting. 8:15 Bishopric Meeting. 10:40 Alex Rivera (tithing). Program: 2 speakers set, closing prayer missing. 3 agenda items." Private notes on individuals are well handled and should stay as they are.

### Counselors
Want their own column of interviews, the youth and organization they oversee, and the agenda. The three-column day grid is a good idea for them. The youth activities and youth lesson links are useful for the counselor over the youth. They will mostly consume, rarely configure.

### Ward Clerk
The Clerk's actual job: record what happened (who spoke, prayed, was sustained, released, set apart, confirmed, blessed), produce the printed program and conducting sheet, keep the calendar, and enter everything into LCR afterwards. Today the app:
- has no "ward business" items in the program (sustainings, releases, confirmations, baby blessings, new members), which is the Clerk's main reason to be at the meeting;
- cannot print or export anything (Export Script is "Coming Soon"; there is no print stylesheet);
- keeps callings in four free-text lists with no stage, so the Clerk cannot tell what has been extended, sustained, or set apart;
- offers no "done, entered in LCR" checkbox anywhere.
The Clerk will be won over by one thing: open the app after church, tap "This Sunday", and see a list they can read straight into LCR.

### Executive Secretary
The Exec Secretary's job is almost entirely: get interview requests, find a slot that works for the right bishopric member, confirm with the member, and keep the Sunday interview schedule accurate. Today, booking one interview is: Calendar → + Add → "Interview or meeting" → new page → big red button → Interview → type name → pick length → a chip appears → drag the chip onto a three-column grid where five minutes is 17 pixels → hope it lands in the right column. The purpose is never captured. There is no phone number, no "text the member a confirmation", and if the drag is misunderstood the button vanishes (B2). This flow is the single most important thing to redesign. It should be: tap "Book an interview", type a name (suggested from the roster), pick who it is with, tap a suggested open slot (the app knows the free slots), done, with a "Copy confirmation message" button. Drag can stay as a power feature for rearranging.

### High Councilor
Listed in Roles but has no place in the app. Either drop the role for now or give it one thing: the Sundays they speak (from the Conducting Schedule notes).

---

## 5. Recommendations

Numbered so we can go through them. Priority: **P1** do before anyone else uses it, **P2** makes it magical, **P3** later.

### Foundation

1. **(P1) Shared data with simple sign-in.** Replace localStorage with a hosted backend (Supabase is the natural fit given the comment in `store.ts`) behind the same `Store` interface, so page code stays untouched. Sign-in should be a one-time link or six-digit code by email or text, never a password to remember. Once signed in, the server knows the role, so "This Device" goes away. Live updates (the Bishop's phone refreshes when the Exec Secretary books something) come almost free with Supabase realtime.
2. **(P1) Fix B1** (the role wipe) now, so the device role works until sign-in replaces it. One-line change in `src/main.tsx`.
3. **(P1) Put the project in git and deploy from it.** `git init`, push to GitHub, deploy to GitHub Pages or Netlify with one command. The Vite config already supports a base path. Add an installable link and a short "Add to Home Screen" card on first visit (also fixes B4 for Safari).
4. **(P1) Store identity, not names.** Appointments and events keep `role: 'bishop'` or `memberId`, and display the name from Roles or the roster at render time. Add a one-time migration for existing data.

### First-time experience (the "magical first time")

5. **(P1) First-run welcome, three screens, then done.** "Welcome to the 5th Ward Hub. Who are you?" (tap your name from the bishopric list). "Here is what you'll use most" (one card for that role). "You're in." No settings, no folds, no Setup page visible. The Bishop or Steve sets up roles once; everyone else just picks their name.
6. **(P1) A role-aware Home screen ("This Sunday").** Replace the six tiles with the coming Sunday at a glance: date and designations (Fast Sunday, Ward Conference), who conducts, the program's status (speakers set, prayers missing), interview count per bishopric member, agenda open-item counts, and the to-dos for *this* role. Each line is a tap into the right place. The tiles duplicate the top nav and add nothing.
7. **(P1) Remove the splash on every load**, or show it once per install. A 3.8-second animation on every refresh reads as "the app is slow" to a change-averse user.
8. **(P2) Hide what each role does not need.** The Exec Secretary's nav: Interviews, Calendar, Sacrament (read), This Sunday. The Clerk's: This Sunday, Sacrament, Calendar, Agenda. Advanced setup (default schedule table, year planning, special dates, demo data) lives behind a single "Settings" entry that only the Bishop and Clerk see. Fewer doors, each one obvious.
9. **(P2) Move Demo Data and Clear All out of reach.** Behind Settings → Advanced, with a typed confirmation ("type DELETE"). Never on the same screen as Roles. Keep demo data available for Steve, not for the ward.

### Interviews (Executive Secretary first)

10. **(P1) Rebuild booking as a short form with suggested slots.** Name (roster suggestions, with "new person" allowed), Purpose (Tithing declaration, Temple recommend, Youth interview, Calling, Setting apart, Other), With (Bishop, 1st, 2nd, or "whoever is free"), Length (10/15/20/30), then a list of open slots on the next few Sundays computed from the interview blocks and existing bookings. Tap a slot, saved. Keep conflict blocking. Drag stays as the way to *rearrange* an existing booking.
11. **(P1) Fix B2.** The big button is always visible. Unplaced bookings show as a short list ("Not yet scheduled: Alex Rivera, 15 min, with anyone") with a "Pick a time" button, not a chip that must be dragged.
12. **(P2) Confirmation message.** After booking, a "Copy message" button produces "Hi Alex, your interview with Bishop Hale is Sunday, Nov 2 at 11:10 AM in the bishop's office." Optional phone number on the roster so it opens Messages directly. This is the step the Exec Secretary does by hand today.
13. **(P2) Weekday interviews.** The board defaults to Sunday; make Tuesday-night temple recommend interviews a first-class choice (the date picker exists, but "next Sunday" is the only thing the UI suggests).
14. **(P2) Link youth interviews to the roster.** "Youth interviews to do" becomes "Youth not interviewed in the last 6 months", computed from the roster and past appointments, and booking one clears it automatically.

### Sacrament meeting (Ward Clerk first)

15. **(P1) Ward business in the program.** New entry types: Sustaining (name, calling), Release (name, calling, with thanks), Confirmation, Baby blessing, Ordination, Welcome new members. The Clerk records these during the meeting.
16. **(P1) Printable program and conducting sheet.** A print stylesheet plus a "Print / Share" button on each meeting that lays out: presiding, conducting, announcements (pulled from that week's Bishopric agenda), opening hymn, invocation, ward business, sacrament hymn, speakers, musical numbers, closing hymn, benediction. Share as PDF from the phone's share sheet. This replaces "Export Script (Coming Soon)".
17. **(P2) "Entered in LCR" checkbox** on each ward-business item, so the Clerk's post-meeting to-do is visible and finishes itself.
18. **(P2) Distinguish opening, sacrament, intermediate, and closing hymns** rather than one "Congregational Hymn" type sorted by hand. Pre-create the program skeleton for a normal Sunday (opening hymn, invocation, sacrament hymn, speaker, speaker, closing hymn, benediction) so the Clerk fills blanks instead of building from nothing.
19. **(P2) Undo for deletes (B7).** A small "Removed Alex Rivera. Undo" bar for five seconds on every ✕.

### Callings (connects the Clerk, the Exec Secretary, and the agenda)

20. **(P2) One callings tracker with stages.** Person, calling, stage: Discussing → Approved → Extended → Accepted → Sustained → Set apart → Recorded. The Bishopric agenda shows the "Discussing/Approved" ones, the Exec Secretary sees "Extended" and "Set apart" as interviews to book, the Sunday program auto-suggests sustainings from "Accepted", and the Clerk ticks "Recorded". This replaces four disconnected free-text lists and is the clearest single win for the Clerk.

### Calendar and Sunday schedule

21. **(P1) Edit in place.** Tapping an event on the Calendar opens its sheet right there. "+ Add" on a day opens the form on that day. No jump to another page. The Schedule page's "Meetings and Calendar Events" fold becomes an "All events" list reachable from the Calendar.
22. **(P2) One model for Sunday meetings.** Make the week-of-month pattern generate recurring calendar events (Bishopric Meeting every Sunday 8:15, Ward Council 2nd and 4th, Youth Council 2nd, Family Sunday 3rd), and make "Change a Month's Schedule" edit those occurrences. Drop the parallel template rows and title matching. The Calendar page then shows each meeting once, and moving Ward Council moves the Agenda with it by identity, not by matching text.
23. **(P2) Rename the Schedule page.** Whatever survives after 21 and 22 is "Settings" (or split: Interviews becomes its own tab; the rest is Settings). Rename "Bishopric Schedule" to "Sunday at a glance", "Conducting Schedule" to "Who conducts", "Default Monthly Meeting Schedule" to "Normal Sunday pattern".
24. **(P3) Replace HTML5 drag on the month view (B3)** with the same pointer-event approach the interview board uses, so it works on phones, or lean fully on tap-to-move and say so in the help text.
25. **(P3) Open sections remembered per device.** Folds currently reset to closed on every load. Remember them, and open the first one by default on pages with only folds, so no page is ever a wall of closed bars.

### Agenda

26. **(P2) Gratitude and roles assignments editable from the agenda card**, not via a pencil to another page. Tap the name, type, done.
27. **(P2) Print / Share the Ward Council agenda** (names only for individuals, as the privacy design already enforces) so organization presidents can receive it before the meeting. The code already mentions "the PDF"; it does not exist yet.
28. **(P2) Make carry-forward visible and reversible.** "9 items carried over" is good; add "Show which" and a way to drop one without deleting it from the previous meeting.
29. **(P3) Youth Council agenda** or remove the "Coming Soon" tab until it exists. A disabled tab is noise for a nervous user.

### Youth

30. **(P1) Load Come, Follow Me 2027 and the remaining youth lesson months**, or switch both cards to date-based links so they never go stale. The CFM card goes blank on December 28, 2026.
31. **(P3) Remove the orphaned FSY reference store** or bring back a small "FSY info" card if the ward wants it.

### Polish for change-averse users

32. **(P2) Visible save feedback.** Fields save on blur with no sign. Add a brief "Saved" flash on the field or card. Consider an explicit Save button on multi-field sheets (already there) and on the organization reports table (not there).
33. **(P2) Bigger tap targets on the ✕ / ↑ / ↓ clusters** and a light theme option. The dark red on black is striking but the muted gray text is hard to read in sunlight in a church parking lot. The dyslexia font toggle is a good touch and should stay.
34. **(P3) Drop the duplicate home controls.** The brand text, the house icon, and the Home tile all go home. Keep one.
35. **(P3) High Councilor** either gets a purpose (speaking Sundays) or leaves the Roles list.

---

## 6. Suggested build order

1. Foundation: items 2, 3, 1, 4 (fix the bug, get it in git, add shared data and sign-in, store identities). Everything else depends on people seeing the same data.
2. Executive Secretary: items 10, 11, 12. Ship this to the Exec Secretary alone and watch them use it once.
3. Clerk: items 15, 16, 20, 17. Ship to the Clerk.
4. Everyone: items 5, 6, 7, 8, 21 (first run, This Sunday home, in-place editing).
5. Structure: items 22, 23, 9, 25 (one Sunday model, rename, settings).
6. Remaining P2 and P3 items as time allows.

Each stage is shippable on its own, and stages 2 and 3 are the "magical first time" for the two people who matter most.
