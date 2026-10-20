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
// what is done to them. Opening the keyboard only raises searchKeyboardOpen.
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
        searchDebounce: { stop() { calls.push(['debounce stopped']); } },
        get searching() { return globals.libraryTab === 'search'; },
        get searchTyping() { return globals.searching && field.activeFocus; },
        focusLibrary() { field.activeFocus = false; calls.push(['focus', 'library']); },
        openKeyboard() { globals.searchKeyboardOpen = true; calls.push(['keyboard']); },
        closeKeyboard() { globals.searchKeyboardOpen = false; },
    };
    globals.appsRoot = globals;
    for (const name of ['setLibraryTab', 'switchLibraryTab', 'enterSearch', 'exitSearch', '_applyQuery',
                        'focusSearch', 'showResults', 'searchBackspace', 'searchType', 'backOut',
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

test('entering search shows ALL from the first row, with the keyboard only for the pad', () => {
    for (const padActive of [false, true]) {
        const f = searchFixture({ tab: 'games', padActive });
        f.globals.setLibraryTab('search', true);
        assert.equal(f.model.category, 'all');
        assert.equal(f.view.currentIndex, 0);
        assert.equal(f.globals._tabBeforeSearch, 'games');
        assert.equal(f.globals.searchKeyboardOpen, padActive);
        assert.equal(f.calls.some((c) => c[0] === 'focus' && c[1] === 'field'), !padActive);
    }
    const empty = searchFixture({ count: 0 });
    empty.globals.enterSearch(false);
    assert.equal(empty.view.currentIndex, -1);
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

test('B closes the keyboard, then the search back to its tab with the find selected, then leaves', () => {
    const f = searchFixture({ tab: 'games', padActive: true });
    f.globals.setLibraryTab('search', true);
    assert.equal(f.globals.searchKeyboardOpen, true);

    assert.equal(f.globals.backOut(), true);
    assert.equal(f.globals.searchKeyboardOpen, false);
    assert.equal(f.globals.searching, true);
    assert.deepEqual(f.calls.at(-1), ['focus', 'library']);

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

test('with no results, Done and B keep the field', () => {
    const f = searchFixture({ count: 0, padActive: true });
    f.globals.enterSearch(true);
    assert.equal(f.globals.backOut(), true);
    assert.equal(f.globals.searching, true);
    assert.deepEqual(f.calls.at(-1), ['focus', 'field']);
});

test('Up from the results goes back to the keyboard with the pad, the field otherwise', () => {
    for (const padActive of [true, false]) {
        const f = searchFixture({ padActive });
        f.globals.enterSearch(false);
        f.calls.length = 0;
        f.globals.focusSearch();
        assert.equal(f.globals.searchKeyboardOpen, padActive);
        assert.deepEqual(f.calls, padActive ? [['keyboard']] : [['focus', 'field']]);
    }
});

test('the status-bar keyboard prompts edit the field at its cursor', () => {
    const f = searchFixture();
    f.globals.searchBackspace();
    assert.equal(f.field.text, '');
    f.globals.searchType('hal');
    f.globals.searchType(' ');
    assert.equal(f.field.text, 'hal ');
    f.globals.searchBackspace();
    f.globals.searchBackspace();
    assert.equal(f.field.text, 'ha');
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
    const press = (key) => { const e = { key, accepted: false }; handler(e); return e.accepted; };

    f.field.text = 'halo';
    assert.equal(press('Key_Down'), true);
    assert.equal(f.model.filterText, 'halo', 'applied without waiting for the debounce');
    assert.deepEqual(f.calls.at(-1), ['focus', 'library']);

    assert.equal(press('Key_Left'), false, 'the cursor keys stay the field\'s');

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

test('with the keyboard up: X deletes, Y spaces, B closes it, and the triggers and LS do nothing', () => {
    const f = searchFixture({ tab: 'games', padActive: true });
    f.globals.setLibraryTab('search', true);
    const handler = page.keyHandler('onPressed', f.globals, { after: 'id: searchField' });
    const press = (key) => { const e = { key, accepted: false }; handler(e); return e.accepted; };

    f.globals.searchType('halo');
    assert.equal(press('Key_Menu'), true);
    assert.equal(f.field.text, 'hal');
    assert.equal(press('Key_Hangup'), true, 'accepted, or Settings opens');
    assert.equal(f.field.text, 'hal ');
    for (const key of ['Key_F14', 'Key_F15', 'Key_F20']) assert.equal(press(key), true, key);
    for (const key of ['Key_F16', 'Key_F17']) assert.equal(press(key), false, `${key} still switches tabs`);

    assert.equal(press('Key_Escape'), true);
    assert.equal(f.globals.searchKeyboardOpen, false);
    assert.equal(f.field.text, 'hal ', 'the query is kept');
    assert.equal(f.globals.searching, true);
    for (const key of ['Key_F14', 'Key_F15', 'Key_F20']) assert.equal(press(key), false, `${key} once it is down`);
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
    const hints = (item) => shell.qmlBinding('_hintsApps', { appsLoader: { item }, qsTr: (s) => s });
    const base = { layoutActionLabel: 'List layout', gridLayout: false, focusedAppName: '',
                   focusedPinnable: false, focusedMoveLabel: '' };

    const keyboard = hints({ ...base, searching: true, searchKeyboardOpen: true });
    // Array.from: the bar's array comes from the vm context, and so would a .map() of it.
    assert.deepEqual(Array.from(keyboard, (h) => [h.btn, h.kind]),
                     [['A', 'oskType'], ['X', 'oskDelete'], ['Y', 'oskSpace'], ['START', 'oskDone'], ['B', 'back']]);
    assert.ok(keyboard.every((h) => typeof h.key === 'string'), 'ActionHint.keyLabel is a string');

    // Typing in the field, in Grid with a cover selected: none of the cover's prompts, whose
    // keys would type letters.
    const grid = { ...base, gridLayout: true, focusedAppName: 'Halo', focusedVerb: 'Play',
                   focusedAppIsRunning: true, focusedPinnable: true, focusedPinned: false };
    for (const [searchHasText, b] of [[true, 'Clear'], [false, 'Close search']]) {
        const typing = hints({ ...grid, searching: true, searchTyping: true, searchHasText,
                               searchKeyboardOpen: false });
        assert.deepEqual(Array.from(typing, (h) => [h.btn, h.key, h.kind]),
                         [['A', 'Enter', 'oskDone'], ['Y', '', 'settings'], ['B', 'Esc', 'back']]);
        assert.equal(typing[2].act, b);
    }

    const searching = hints({ ...base, searching: true, searchTyping: false, searchKeyboardOpen: false });
    assert.equal(searching.find((h) => h.btn === 'B').act, 'Close search');
    assert.ok(searching.some((h) => h.kind === 'settings'));

    assert.equal(hints({ ...base, searching: false, searchKeyboardOpen: false }).find((h) => h.btn === 'B').act, 'Hosts');
    assert.equal(hints(null).find((h) => h.btn === 'B').act, 'Hosts');
});

test('clicking a keyboard prompt does what its button does', () => {
    const calls = [];
    const trigger = shell.qmlFunction('triggerStatusBarAction', {
        Qt: { Key_Return: 'Return' },
        SdlGamepadKeyNavigation: { simulateKey: (k) => calls.push(['key', k]) },
        appsLoader: { item: {
            searchBackspace: () => calls.push('delete'),
            searchType: (t) => calls.push(['type', t]),
            showResults: () => calls.push('done'),
        } },
    });
    for (const kind of ['oskType', 'oskDelete', 'oskSpace', 'oskDone']) trigger(kind);
    assert.deepEqual(calls, [['key', 'Return'], 'delete', ['type', ' '], 'done']);
});
