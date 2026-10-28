# Library search

A search stop sits at the left end of the tab ring: `[LB] 🔍 ALL GAMES APPS [RB]`.
LB from ALL opens it, as do `/`, Ctrl+F and clicking the 🔍. Search shows what
ALL shows, filtered as you type; case, accents and punctuation are ignored and
every word must appear in the title, in any order. With a controller, A in the
search field opens the app's on-screen keyboard (`app/gui/VirtualKeyboard.qml`,
8.0.0), over the bottom of the library; keyboard and mouse users get only the
text field. B (or Esc) closes the keyboard, then the search, landing on the tab
it was opened from with the game found still selected.

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
`tests/library/tst_searchmatch.cpp`. The Windows workflow has no test steps
(8.0.0), so run it by hand from an empty folder in a Visual Studio x64 prompt
with Qt's `bin` on the PATH (`check` builds it and runs it):

```powershell
qmake <repo>\tests\library\searchmatch.pro CONFIG+=release
<repo>\scripts\jom.exe check
```

## Manual verification

Using the Windows CI build:

1. Library search, in both layouts:
   - Keyboard, List: `/`, type part of a title, Down, then Enter launches it.
     Back in search, Esc clears the text, a second Esc returns to the previous
     tab with the found game still selected.
   - Keyboard, Grid: Ctrl+F; Up from the top row returns to the field; PgUp and
     PgDn leave search for the neighbouring tabs.
   - Controller, List: LB from ALL lands in the search field with no keyboard;
     A opens it. Type with A, delete with X, add a space with Y (Settings must
     not open), LB/RB move the text cursor; the results filter as you type.
     Start (Done) goes to the results and the spotlight follows the selection.
     B closes the keyboard back to the field with the query kept; B again
     clears it, then closes the search. In the field with the keyboard down,
     X deletes and Y opens Settings.
   - Controller, Grid: the same, checking the keyboard comes up over the covers
     without moving them, and Up from the top row returns to the field with
     the keyboard still down.
   - Mouse: click 🔍, the × clear and ⌨ keyboard buttons, the keyboard's keys,
     and the status-bar prompts (Keyboard, Results, Close search).
   - Matching: `pokemon` finds Pokémon, `halflife` and `half life` find
     Half-Life, `eternal doom` finds DOOM™ Eternal.
   - A query with no matches shows `No matches for "…"` beside the results'
     place, not across the page. Pin and unpin a result; stream from a result
     and return to it; switch layout mid-search; leave a host poll to run
     mid-search. None of these should end the search.
