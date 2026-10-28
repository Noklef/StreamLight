const assert = require('node:assert/strict');
const test = require('node:test');
const { qmlSource } = require('./qml-source.cjs');

// Library search (7.1.0): the page's search logic and the shell's B and status-bar prompts,
// run from the production QML against doubles. What a query matches is C++ and tested in
// tests/library; the on-screen keyboard is a stand-in here, so these hold whichever keyboard
// plan step 4 settles on.
const page = qmlSource('AppsScreen.qml');
const shell = qmlSource('AppShell.qml');

const declared = (name) => JSON.parse(page.source.match(new RegExp(`property var ${name}: (\\[[^\\]\\n]*\\])`))[1]);
const ring = declared('_ring');
const tabs = declared('_tabs');

// The page's search functions running for real over a model, a view and a field that record
// what is done to them. The keyboard stands in for VirtualKeyboard.qml: offer() opens it for a
// key the pad sent (no scan code), and closing it hands the focus back to the field, as its
// onClosed does.
function searchFixture({ tab = 'all', count = 5, padActive = false, foundAt = 3 } = {}) {
    const calls = [];
    const model = {
        category: tab,
        filterText: '',
        saveTab(t) { calls.push(['saveTab', t]); },
        // As AppModel::setFilterText: true only when the words changed and the rows were rebuilt.
        setFilterText(text) {
            const words = (s) => s.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
            const rebuilt = words(text) !== words(model.filterText);
            model.filterText = text;
            return rebuilt;
        },
        indexOfAppId(id) { return id === 42 ? foundAt : -1; },
    };
    const view = {
        appModel: model, count, currentIndex: count > 0 ? 1 : -1, currentItem: { _appId: 42 },
        positionViewAtBeginning() { calls.push(['top']); },
        positionViewAtIndex(i) { calls.push(['show', i]); },
        updateContinue() {},
    };
    const field = {
        text: '', cursorPosition: 0, activeFocus: false,
        forceActiveFocus() { field.activeFocus = true; calls.push(['focus', 'field']); },
        insert(at, t) { field.text = field.text.slice(0, at) + t + field.text.slice(at); field.cursorPosition = at + t.length; },
        remove(from, to) { field.text = field.text.slice(0, from) + field.text.slice(to); field.cursorPosition = from; },
        clear() { field.text = ''; field.cursorPosition = 0; },
    };
    const globals = {
        Qt: new Proxy({}, { get: (_, key) => key }),
        InputHints: { padActive },
        ListView: { Contain: 'Contain' },
        _ring: ring, _tabs: tabs,
        libraryTab: tab, _tabBeforeSearch: 'all', _tabChosenByUser: false,
        searchKeyboardOpen: false, _playtimeEpoch: 0,
        appGrid: view, searchField: field,
        searchKeyboard: {
            offer(event) {
                if (event.nativeScanCode !== 0) return false;
                globals.openKeyboard();
                event.accepted = true;
                return true;
            },
            close() { globals.closeKeyboard(); },
        },
        searchDebounce: { stop() { calls.push(['debounce stopped']); } },
        get searching() { return globals.libraryTab === 'search'; },
        get searchTyping() { return globals.searching && field.activeFocus; },
        focusLibrary() { field.activeFocus = false; calls.push(['focus', 'library']); },
        openKeyboard() { globals.searchKeyboardOpen = true; calls.push(['keyboard']); },
        closeKeyboard() {
            if (!globals.searchKeyboardOpen) return;
            globals.searchKeyboardOpen = false;
            field.forceActiveFocus();
        },
    };
    globals.appsRoot = globals;
    for (const name of ['setLibraryTab', 'switchLibraryTab', 'enterSearch', 'exitSearch', '_applyQuery',
                        'focusSearch', 'showResults', 'searchBackspace', 'backOut',
                        '_selectAppIdAnyTab']) {
        globals[name] = page.qmlFunction(name, globals);
    }
    return { globals, model, view, field, calls };
}

const saved = (f) => f.calls.filter((c) => c[0] === 'saveTab').map((c) => c[1]);

test('search is the ring stop before ALL, and LB/RB wrap through it', () => {
    assert.deepEqual(ring, ['search', 'all', 'games', 'apps']);
    assert.deepEqual(tabs, ['all', 'games', 'apps'], '_tabs stays the three real tabs');

    const f = searchFixture({ tab: 'all' });
    f.globals.switchLibraryTab(-1);
    assert.equal(f.globals.libraryTab, 'search');
    assert.equal(f.globals._tabBeforeSearch, 'all');
    f.globals.switchLibraryTab(-1);
    assert.equal(f.globals.libraryTab, 'apps', 'LB from search wraps to APPS');
    f.globals.switchLibraryTab(1);
    assert.equal(f.globals.libraryTab, 'search', 'RB from APPS wraps to search');
    f.globals.switchLibraryTab(1);
    assert.equal(f.globals.libraryTab, 'all');
});

test('search is never saved as a tab; the tab LB/RB leave it for is', () => {
    const f = searchFixture({ tab: 'all' });
    for (let i = 0; i < 8; i++) f.globals.switchLibraryTab(i < 4 ? 1 : -1);
    f.globals.setLibraryTab('search', true);
    assert.ok(!saved(f).includes('search'), `saved: ${saved(f)}`);

    const g = searchFixture({ tab: 'all' });
    g.globals.switchLibraryTab(-1);
    g.globals.switchLibraryTab(-1);
    assert.deepEqual(saved(g), ['apps']);
    assert.equal(g.globals._tabChosenByUser, true);
});

test('entering search shows ALL from the first row, in the field, with the keyboard still down', () => {
    for (const padActive of [false, true]) {
        const f = searchFixture({ tab: 'games', padActive });
        f.globals.setLibraryTab('search', true);
        assert.equal(f.model.category, 'all');
        assert.equal(f.view.currentIndex, 0);
        assert.equal(f.globals._tabBeforeSearch, 'games');
        assert.equal(f.globals.searchKeyboardOpen, false, 'A in the field opens it, with the pad');
        assert.ok(f.calls.some((c) => c[0] === 'focus' && c[1] === 'field'));
    }
    const empty = searchFixture({ count: 0 });
    empty.globals.enterSearch(false);
    assert.equal(empty.view.currentIndex, -1);
});

test('clicking either shoulder into search keeps the field focused; leaving focuses the library', () => {
    for (const [tab, button] of [['all', 'LB'], ['apps', 'RB']]) {
        const f = searchFixture({ tab });
        const click = page.signalHandler('onTriggered', f.globals, { after: `buttonKey: "${button}"; keyLabel:` });
        click();
        assert.equal(f.globals.searching, true, button);
        assert.equal(f.field.activeFocus, true, `${button}: typing must stay in the search field`);
        assert.deepEqual(f.calls.at(-1), ['focus', 'field']);

        click();
        assert.equal(f.globals.searching, false, button);
        assert.equal(f.field.activeFocus, false);
        assert.deepEqual(f.calls.at(-1), ['focus', 'library']);
    }
});

test('clicking Results applies pending text before deciding where to focus', () => {
    for (const [previousCount, nextCount] of [[0, 3], [3, 0]]) {
        const f = searchFixture({ count: previousCount });
        f.globals.enterSearch(false);
        f.model.filterText = 'old query';
        f.field.text = 'new query';
        const setFilterText = f.model.setFilterText;
        f.model.setFilterText = (text) => {
            const rebuilt = setFilterText(text);
            f.view.count = nextCount;
            return rebuilt;
        };
        const click = shell.qmlFunction('triggerStatusBarAction', { appsLoader: { item: f.globals } });
        f.calls.length = 0;
        click('oskDone');

        assert.equal(f.model.filterText, 'new query');
        assert.deepEqual(f.calls[0], ['debounce stopped']);
        assert.equal(f.view.currentIndex, nextCount > 0 ? 0 : -1);
        assert.equal(f.field.activeFocus, nextCount === 0);
        assert.deepEqual(f.calls.at(-1), ['focus', nextCount > 0 ? 'library' : 'field']);
    }
});

test('a query applies once its words change, and only then resets the cursor', () => {
    const f = searchFixture();
    f.field.text = 'halo';
    f.globals._applyQuery();
    assert.equal(f.model.filterText, '', 'not searching: nothing to filter');

    f.globals.enterSearch(false);
    f.view.currentIndex = 3;
    f.globals._applyQuery();
    assert.equal(f.model.filterText, 'halo');
    assert.equal(f.view.currentIndex, 0);

    f.view.currentIndex = 2;
    f.field.text = 'halo ';
    f.globals._applyQuery();
    assert.equal(f.view.currentIndex, 2, 'a trailing space changes no words');
});

test('leaving search clears the field and the filter', () => {
    const f = searchFixture({ tab: 'all' });
    f.globals.enterSearch(false);
    f.field.text = 'halo';
    f.globals._applyQuery();
    f.globals.switchLibraryTab(1);
    assert.equal(f.globals.libraryTab, 'all');
    assert.equal(f.model.category, 'all');
    assert.equal(f.model.filterText, '');
    assert.equal(f.field.text, '');
    assert.ok(f.calls.some((c) => c[0] === 'debounce stopped'), 'a pending keystroke must not refilter');
});

test('B closes the keyboard to the field, then the search back to its tab with the find selected, then leaves', () => {
    const f = searchFixture({ tab: 'games', padActive: true });
    f.globals.setLibraryTab('search', true);
    f.globals.openKeyboard();

    assert.equal(f.globals.backOut(), true);
    assert.equal(f.globals.searchKeyboardOpen, false);
    assert.equal(f.globals.searching, true);
    assert.deepEqual(f.calls.at(-1), ['focus', 'field']);

    assert.equal(f.globals.backOut(), true);
    assert.equal(f.globals.libraryTab, 'games');
    assert.equal(f.model.category, 'games');
    assert.equal(f.view.currentIndex, 3, 'the game found stays selected');
    assert.ok(f.calls.some((c) => c[0] === 'show' && c[1] === 3));

    assert.equal(f.globals.backOut(), false, 'nothing left to undo: B leaves the page');
    assert.deepEqual(saved(f), [], 'B is not a tab choice');
});

test('B in the field clears what was typed before it closes the search', () => {
    const f = searchFixture({ tab: 'games' });
    f.globals.enterSearch(false);
    f.field.text = 'halo';
    assert.equal(f.globals.backOut(), true);
    assert.equal(f.field.text, '');
    assert.equal(f.globals.searching, true);
    assert.equal(f.globals.backOut(), true);
    assert.equal(f.globals.libraryTab, 'games');
});

test('with no results, Done keeps the field', () => {
    const f = searchFixture({ count: 0, padActive: true });
    f.globals.enterSearch(true);
    f.calls.length = 0;
    f.globals.showResults();
    assert.equal(f.globals.searchKeyboardOpen, false);
    assert.equal(f.globals.searching, true);
    assert.deepEqual(f.calls.at(-1), ['focus', 'field']);
});

test('Up from the results goes back to the field, the keyboard still down, with the pad too', () => {
    for (const padActive of [true, false]) {
        const f = searchFixture({ padActive });
        f.globals.enterSearch(false);
        f.calls.length = 0;
        f.globals.focusSearch();
        assert.equal(f.globals.searchKeyboardOpen, false);
        assert.deepEqual(f.calls, [['focus', 'field']]);
    }
});

test('X in the field deletes before the text cursor', () => {
    const f = searchFixture();
    f.globals.searchBackspace();
    assert.equal(f.field.text, '');
    f.field.text = 'halo';
    f.field.cursorPosition = 2;
    f.globals.searchBackspace();
    assert.equal(f.field.text, 'hlo');
    assert.equal(f.field.cursorPosition, 1);
});

test('a launch confirmation finds its entry among the results, or leaves search for the tabs', () => {
    const f = searchFixture();
    f.globals.enterSearch(false);
    assert.equal(f.globals._selectAppIdAnyTab(42), true);
    assert.equal(f.globals.searching, true);
    assert.equal(f.view.currentIndex, 3);

    const g = searchFixture({ tab: 'all' });
    g.model.indexOfAppId = (id) => (id === 7 && g.model.category === 'games' && !g.model.filterText ? 2 : -1);
    g.globals.enterSearch(false);
    g.field.text = 'halo';
    g.globals._applyQuery();
    assert.equal(g.globals._selectAppIdAnyTab(7), true);
    assert.equal(g.globals.libraryTab, 'games');
    assert.equal(g.view.currentIndex, 2);
    assert.equal(g.model.filterText, '');
});

test('a change of counts mid-search keeps the search', () => {
    const calls = [];
    const globals = {
        appGrid: { appModel: { remoteMonitorActive: true, appsCount: 3 } },
        appsRoot: {
            searching: true, _tabChosenByUser: false, libraryTab: 'search',
            _pickOpeningTab: () => calls.push('opening tab'),
            setLibraryTab: (t) => calls.push(t),
            _countFor: () => 0,
        },
    };
    const onCountsChanged = page.qmlFunction('onCountsChanged', globals);
    onCountsChanged();
    assert.deepEqual(calls, []);
    globals.appsRoot.searching = false;
    onCountsChanged();
    assert.deepEqual(calls, ['opening tab']);
});

test('/ and Find open search from the page, without the keyboard', () => {
    const calls = [];
    const handler = page.pageKeyHandler({
        Qt: new Proxy({}, { get: (_, key) => key }),
        StandardKey: { Find: 'Find' },
        enterSearch: (withKeyboard) => calls.push(withKeyboard),
    });
    for (const event of [{ key: 'Key_Slash', matches: () => false },
                         { key: 'Key_F', matches: (k) => k === 'Find' }]) {
        event.accepted = false;
        handler(event);
        assert.equal(event.accepted, true, event.key);
    }
    assert.deepEqual(calls, [false, false]);
    const other = { key: 'Key_Left', matches: () => false, accepted: false };
    handler(other);
    assert.equal(other.accepted, false);
});

test('the search field: Enter and Down apply now and go to the results, Escape clears then exits', () => {
    const f = searchFixture({ tab: 'games' });
    f.globals.enterSearch(false);
    const handler = page.keyHandler('onPressed', f.globals, { after: 'id: searchField' });
    // A real keyboard: every key has a scan code.
    const press = (key) => { const e = { key, nativeScanCode: 28, accepted: false }; handler(e); return e.accepted; };

    f.field.text = 'halo';
    assert.equal(press('Key_Down'), true);
    assert.equal(f.model.filterText, 'halo', 'applied without waiting for the debounce');
    assert.deepEqual(f.calls.at(-1), ['focus', 'library']);

    assert.equal(press('Key_Left'), false, 'the cursor keys stay the field\'s');

    f.globals.enterSearch(false);
    f.field.text = 'gears';
    assert.equal(press('Key_Return'), true);
    assert.equal(f.model.filterText, 'gears', 'Enter on a keyboard: the results, not the keyboard');
    assert.equal(f.globals.searchKeyboardOpen, false);
    assert.deepEqual(f.calls.at(-1), ['focus', 'library']);
    f.globals.enterSearch(false);
    assert.equal(press('Key_Hangup'), false, 'Y with the keyboard down: Settings, typing no space');
    assert.equal(f.field.text, 'gears');

    f.field.text = 'doom';
    assert.equal(press('Key_F18'), true, 'Start is Done');
    assert.equal(f.model.filterText, 'doom');
    assert.deepEqual(f.calls.at(-1), ['focus', 'library']);
    f.globals.enterSearch(false);
    f.calls.length = 0;
    assert.equal(press('Key_F13'), true, 'Select: not the settings of a selection out of sight');
    assert.equal(press('Key_F19'), true, 'the right stick: no move either');
    assert.deepEqual(f.calls, []);
    f.field.text = 'halo';

    assert.equal(press('Key_Escape'), true);
    assert.equal(f.field.text, '');
    assert.equal(f.globals.searching, true, 'the first Escape only clears');
    assert.equal(press('Key_Escape'), true, 'accepted, or the shell would go Home');
    assert.equal(f.globals.libraryTab, 'games');
});

test('the pad\'s A in the field opens the keyboard; its Done applies and goes to the results', () => {
    const f = searchFixture({ tab: 'games', padActive: true });
    f.globals.setLibraryTab('search', true);
    const handler = page.keyHandler('onPressed', f.globals, { after: 'id: searchField' });
    // The pad's keys are built by hand, with no scan code (SdlGamepadKeyNavigation).
    const press = (key) => { const e = { key, nativeScanCode: 0, accepted: false }; handler(e); return e.accepted; };

    f.field.text = 'halo';
    f.field.cursorPosition = 4;
    assert.equal(press('Key_Return'), true, 'pad A');
    assert.equal(f.globals.searchKeyboardOpen, true);
    assert.equal(f.globals.searching, true, 'still in the field, not the results');
    assert.equal(f.model.filterText, '', 'A types nothing and applies nothing');

    assert.equal(press('Key_Menu'), true, 'X deletes in the field too');
    assert.equal(f.field.text, 'hal');
    assert.equal(press('Key_Hangup'), false, 'Y is left to Settings with the keyboard down');

    // Start / Done on the keyboard: the keyboard's own accepted() handler, whose close() is
    // the popup's. VirtualKeyboard gives the field the focus before it, so its onClosed then
    // leaves the focus where the handler put it.
    const done = page.signalHandler('onAccepted', f.globals, { after: 'id: searchKeyboard' });
    f.globals.close = () => { f.globals.searchKeyboardOpen = false; };
    f.calls.length = 0;
    done();
    assert.equal(f.globals.searchKeyboardOpen, false);
    assert.equal(f.model.filterText, 'hal', 'applied without waiting for the debounce');
    assert.deepEqual(f.calls.at(-1), ['focus', 'library'], 'the results');
});

test('Up from the top row goes back to the search, only while searching', () => {
    const g = {
        calls: [], count: 5, currentIndex: 0, columns: 4,
        appsRoot: { searching: true, focusSearch: () => g.calls.push('search') },
        _noteStep: () => {},
        _bounce: (d) => g.calls.push(['bounce', d]),
    };
    const list = page.keyHandler('onUpPressed', g, { after: 'id: appList', before: 'id: coverGrid' });
    const grid = page.keyHandler('onUpPressed', g, { after: 'id: coverGrid' });
    const up = (handler, { searching, currentIndex }) => {
        g.calls.length = 0;
        g.appsRoot.searching = searching;
        g.currentIndex = currentIndex;
        const e = { accepted: false };
        handler(e);
        return [e.accepted, ...g.calls];
    };

    assert.deepEqual(up(list, { searching: true, currentIndex: 0 }), [true, 'search'], 'no bounce');
    assert.deepEqual(up(list, { searching: true, currentIndex: -1 }), [true, 'search'], 'no results');
    assert.deepEqual(up(list, { searching: true, currentIndex: 2 }), [false]);
    assert.deepEqual(up(list, { searching: false, currentIndex: 0 }), [false, ['bounce', 1]]);

    assert.deepEqual(up(grid, { searching: true, currentIndex: 3 }), [true, 'search'], 'top row');
    assert.deepEqual(up(grid, { searching: true, currentIndex: -1 }), [true, 'search'], 'no results');
    assert.deepEqual(up(grid, { searching: true, currentIndex: 4 }), [false]);
    assert.deepEqual(up(grid, { searching: false, currentIndex: 0 }), [false]);
});

test('B asks the host page before leaving it, and Settings never does', () => {
    for (const handled of [true, false]) {
        const g = { currentPage: 1, _settingsReturnPage: 0, appsLoader: { item: { backOut: () => handled } } };
        assert.equal(shell.qmlFunction('_goBack', g)(), true);
        assert.equal(g.currentPage, handled ? 1 : 0);
    }
    const loading = { currentPage: 1, _settingsReturnPage: 0, appsLoader: { item: null } };
    shell.qmlFunction('_goBack', loading)();
    assert.equal(loading.currentPage, 0);

    const settings = {
        currentPage: 2, _settingsReturnPage: 1,
        appsLoader: { item: { backOut() { throw new Error('Settings asked the host page'); } } },
    };
    shell.qmlFunction('_goBack', settings)();
    assert.equal(settings.currentPage, 1);
});

test('the status bar: keyboard prompts while it is up, Close search while searching', () => {
    const hints = (item, padActive = false) =>
        shell.qmlBinding('_hintsApps', { appsLoader: { item }, qsTr: (s) => s, InputHints: { padActive } });
    const base = { layoutActionLabel: 'List layout', gridLayout: false, focusedAppName: '',
                   focusedPinnable: false, focusedMoveLabel: '' };

    // The keyboard names its own buttons under its keys.
    assert.equal(hints({ ...base, searching: true, searchKeyboardOpen: true }).length, 0);

    // Typing in the field, in Grid with a cover selected: none of the cover's prompts, whose
    // keys would type letters. Nor Settings, which has no key here: no lone Y glyph.
    const grid = { ...base, gridLayout: true, focusedAppName: 'Halo', focusedVerb: 'Play',
                   focusedAppIsRunning: true, focusedPinnable: true, focusedPinned: false };
    for (const [searchHasText, b] of [[true, 'Clear'], [false, 'Close search']]) {
        const typing = hints({ ...grid, searching: true, searchTyping: true, searchHasText,
                               searchKeyboardOpen: false });
        // Array.from: the bar's array comes from the vm context, and so would a .map() of it.
        assert.deepEqual(Array.from(typing, (h) => [h.btn, h.key, h.kind]),
                         [['A', 'Enter', 'oskDone'], ['B', 'Esc', 'back']]);
        assert.equal(typing[1].act, b);
    }
    // With the pad, A is the keyboard and Start the results.
    const padTyping = hints({ ...grid, searching: true, searchTyping: true, searchHasText: true,
                              searchKeyboardOpen: false }, true);
    assert.deepEqual(Array.from(padTyping, (h) => [h.btn, h.kind]),
                     [['A', 'oskOpen'], ['START', 'oskDone'], ['Y', 'settings'], ['B', 'back']]);
    assert.equal(padTyping[0].act, 'Keyboard');

    const searching = hints({ ...base, searching: true, searchTyping: false, searchKeyboardOpen: false });
    assert.equal(searching.find((h) => h.btn === 'B').act, 'Close search');
    assert.ok(searching.some((h) => h.kind === 'settings'));

    assert.equal(hints({ ...base, searching: false, searchKeyboardOpen: false }).find((h) => h.btn === 'B').act, 'Hosts');
    assert.equal(hints(null).find((h) => h.btn === 'B').act, 'Hosts');
});

test('clicking a search prompt does what its button does', () => {
    const calls = [];
    const trigger = shell.qmlFunction('triggerStatusBarAction', {
        appsLoader: { item: {
            showResults: () => calls.push('results'),
            openKeyboard: () => calls.push('keyboard'),
        } },
    });
    for (const kind of ['oskOpen', 'oskDone']) trigger(kind);
    assert.deepEqual(calls, ['keyboard', 'results']);
});
