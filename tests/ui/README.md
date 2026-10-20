# Library layout MVP

The library opens in Grid mode by default. Left-stick click (LS/L3), the V key,
or the clickable layout prompt switches between Grid and List. The choice is
saved globally across hosts and restarts. X retains its existing Stop action.

In Settings, under Session > Interface (after Date format), Grid cover size offers
Small / Medium / Large, and Show grid titles toggles the names below covers. Both
apply without restarting and are saved globally. Defaults are Medium and titles
on. Hiding titles removes their reserved row space, but missing-cover names and
accessible game names remain available. List mode is unchanged.

Grid mode shows covers and game titles across the full page, without the
spotlight, store metadata, play time or session figures. Covers reuse the spotlight's
rounded corners, shadow and 2:3 crop, with no idle frame or padding; the focused
cover has a rounded accent outline. Missing covers display
the title as a fallback. List mode keeps the existing sections and spotlight.

Grid covers show a top-right STREAMING badge for a running app, or a subdued
LAST PLAYED badge for the same single game that List mode promotes. STREAMING
takes priority when both apply. Badges remain visible with titles hidden and
when the card is not selected. The existing ordering and List mode are unchanged.

## Library search

A search stop sits at the left end of the tab ring: `[LB] 🔍 ALL GAMES APPS [RB]`.
LB from ALL opens it, as do `/`, Ctrl+F and clicking the 🔍. Search shows what
ALL shows, filtered as you type; case, accents and punctuation are ignored and
every word must appear in the title, in any order. With a controller, A in the
search field opens an on-screen keyboard (Qt Virtual Keyboard, in our own
Theme-following style, `app/gui/vkbstyle`), drawn over the bottom of the
library; keyboard and mouse users get only the text field. B (or Esc) closes
the keyboard, then the search, landing on the tab it was opened from with the
game found still selected.

## Running the tests

Run the JavaScript selection, session and search regressions without Qt
dependencies. A glob, not the directory: Node 22 treats a directory argument
as a file.

```powershell
node --test "tests/ui/*.test.cjs"
```

These tests execute production QML JavaScript against view/session doubles and
check that grid covers use the shared styling component. `qml-source.cjs` lifts
the functions, key handlers and bindings out of the QML files.
They do not validate QML loading, rendering or physical controller input.

What a search matches is C++ (`app/backend/librarysearch.h`), tested by
`tests/library/tst_searchmatch.cpp`. CI builds and runs it after installing Qt.

## Manual verification

Using the Windows CI build:

1. Browse a host with enough games for multiple rows. Use the D-pad, left stick
   and keyboard arrows to move in all four directions and scroll into later rows.
2. Select a game halfway down the grid. Click the left stick twice and verify
   that both layouts keep that game selected and visible. Repeat with V and the
   clickable prompt, and check an empty Games or Apps tab.
3. Launch and resume with A/Enter and by clicking a cover. Launch another game
   while one is running and check the existing quit confirmation. Return from
   a stream and verify selection follows the game that was just played.
4. Check LB/RB tabs, LT/RT profiles, Start pinning, right-stick category moves,
   Select per-game settings, Y Settings, B Hosts and X Stop retain their actions.
5. Resize the window, scroll with the mouse, and check missing/portrait covers
   and long titles. Check rounded corners and shadows match the spotlight, with
   no grey frame or inner padding and a rounded cyan outline only on the focused
   cover. Grid mode must have no right-hand details panel.
6. Restart the application and check that the last layout choice is remembered.
7. Change Grid cover size through all three choices, then switch Show grid titles
   off and on. Check column count, row spacing, scrolling, selection and launch,
   including the last row and missing covers. Verify both options survive a restart
   and do not affect List mode.
8. With a running app, check its STREAMING badge remains visible while selecting
   another cover and with titles off. Check only the existing single last-played
   game has LAST PLAYED, and STREAMING replaces that badge if it is also running.
   After stopping or ending a session, verify the badges follow the model's state.
   Check hosts with no play history and the Apps tab do not mark an arbitrary first
   entry as LAST PLAYED. Confirm badges do not intercept cover clicks.
9. Library search, in both layouts:
   - Keyboard, List: `/`, type part of a title, Down, then Enter launches it.
     Back in search, Esc clears the text, a second Esc returns to the previous
     tab with the found game still selected.
   - Keyboard, Grid: Ctrl+F; Up from the top row returns to the field; PgUp and
     PgDn leave search for the neighbouring tabs.
   - Controller, List: LB from ALL lands in the search field with no keyboard;
     A opens it. Type with A, delete with X, add a space with Y (Settings must
     not open); Start or the keyboard's Enter goes to the results and the
     spotlight follows the selection; B closes the keyboard, a second B closes
     the search. In the field with the keyboard down, Y opens Settings.
   - Controller, Grid: the same, checking the keyboard slides up over the
     covers without moving them, and Up from the top row returns to the field
     with the keyboard still down.
   - Keyboard style, in Light and Dark and with a couple of accents: the panel
     is a card, keys have the hairline border, the D-pad cursor is the accent
     tint with the ink border, Enter is filled with the accent, and every icon
     is legible (Shift, Caps Lock, Backspace, hide, Enter).
   - Mouse: click 🔍, the × clear and ⌨ keyboard buttons, the keyboard's keys,
     and the status-bar prompts (Type, Delete, Space, Done, Close search).
   - Matching: `pokemon` finds Pokémon, `halflife` and `half life` find
     Half-Life, `eternal doom` finds DOOM™ Eternal.
   - A query with no matches shows `No matches for "…"` beside the results'
     place, not across the page. Pin and unpin a result; stream from a result
     and return to it; switch layout mid-search; leave a host poll to run
     mid-search. None of these should end the search.
