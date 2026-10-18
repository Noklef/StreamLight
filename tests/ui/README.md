# Library search

A search stop sits at the left end of the tab ring: `[LB] 🔍 ALL GAMES APPS [RB]`.
LB from ALL opens it, as do `/`, Ctrl+F and clicking the 🔍. Search shows what
ALL shows, filtered as you type; case, accents and punctuation are ignored and
every word must appear in the title, in any order. With a controller an
on-screen keyboard docks under the library; keyboard and mouse users get only
the text field. B (or Esc) closes the keyboard, then the search, landing on the
tab it was opened from with the game found still selected.

## Running the tests

Run the JavaScript search regressions without Qt
dependencies. A glob, not the directory: Node 22 treats a directory argument
as a file.

```powershell
node --test "tests/ui/*.test.cjs"
```

These tests execute production QML JavaScript against view/session doubles. `qml-source.cjs` lifts
the functions, key handlers and bindings out of the QML files.
They do not validate QML loading, rendering or physical controller input.

What a search matches is C++ (`app/backend/librarysearch.h`), tested by
`tests/library/tst_searchmatch.cpp`. CI builds and runs it after installing Qt.

## Manual verification

Using the Windows CI build:

1. Library search, in both layouts:
   - Keyboard, List: `/`, type part of a title, Down, then Enter launches it.
     Back in search, Esc clears the text, a second Esc returns to the previous
     tab with the found game still selected.
   - Keyboard, Grid: Ctrl+F; Up from the top row returns to the field; PgUp and
     PgDn leave search for the neighbouring tabs.
   - Controller, List: LB from ALL opens the on-screen keyboard. Type with A,
     delete with X, add a space with Y (Settings must not open); Start goes to
     the results and the spotlight follows the selection; B closes the keyboard,
     a second B closes the search.
   - Controller, Grid: the same, checking the grid shrinks above the keyboard
     and keeps the selection in view, and Up from the top row reopens it.
   - Mouse: click 🔍, the × clear and ⌨ keyboard buttons, the keyboard's keys,
     and the status-bar prompts (Type, Delete, Space, Done, Close search).
   - Matching: `pokemon` finds Pokémon, `halflife` and `half life` find
     Half-Life, `eternal doom` finds DOOM™ Eternal.
   - A query with no matches shows `No matches for "…"` beside the results'
     place, not across the page. Pin and unpin a result; stream from a result
     and return to it; switch layout mid-search; leave a host poll to run
     mid-search. None of these should end the search.
