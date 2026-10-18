// Lifts JavaScript out of a QML file under app/gui and runs it under node:vm, with the globals
// a test supplies standing in for everything the code reaches outside itself (ids, properties,
// other functions, Qt). No Qt: what is tested is the production code, not a copy of it.
//
// Blocks end at the first line holding their closing brace at the indent they opened on, the
// way every file under app/gui is laid out. A block that closes on its opening line is taken
// whole from that line.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function qmlSource(file) {
    const source = fs.readFileSync(path.join(__dirname, '../../app/gui', file), 'utf8');

    // From `start` (on a line indented by `indent`) to the brace closing what that line opens.
    function block(start, indent, what) {
        const lineEnd = source.indexOf('\n', start);
        const line = source.slice(start, lineEnd < 0 ? undefined : lineEnd).trimEnd();
        const opens = line.split('{').length - 1;
        if (opens > 0 && opens === line.split('}').length - 1) return line;
        const end = source.indexOf(`\n${indent}}`, start);
        assert.ok(end > start, `Missing end of ${what} in ${file}`);
        return source.slice(start, end + indent.length + 2);
    }

    function run(code, globals) {
        return vm.runInNewContext(`(${code})`, globals);
    }

    /** `function name(...) { ... }`, as a callable. */
    function qmlFunction(name, globals) {
        const signature = new RegExp(`^([ \\t]*)function ${name}\\([^\\n]*\\) \\{`, 'm');
        const match = source.match(signature);
        assert.ok(match, `Missing QML function in ${file}: ${name}`);
        return run(block(match.index + match[1].length, match[1], `function ${name}`), globals);
    }

    /**
     * `Keys.<signal>: function(event) { ... }`, the first one in the file, or the first after
     * the text `after` (and, when given, before the text `before`, so a handler missing from
     * one item is not found on the next).
     */
    function keyHandler(signal, globals, { after = '', before = '' } = {}) {
        const from = source.indexOf(after);
        assert.ok(from >= 0, `Missing ${after} in ${file}`);
        const pattern = new RegExp(`^([ \\t]*)Keys\\.${signal}: function\\(event\\) \\{`, 'mg');
        pattern.lastIndex = from;
        const match = pattern.exec(source);
        assert.ok(match, `Missing Keys.${signal} after ${after || 'the start'} in ${file}`);
        if (before) {
            const limit = source.indexOf(before, from);
            assert.ok(limit < 0 || match.index < limit, `Missing Keys.${signal} between ${after} and ${before} in ${file}`);
        }
        const start = match.index + match[0].indexOf('function');
        return run(block(start, match[1], `Keys.${signal}`), globals);
    }

    /** The page's own key handler: the file's first Keys.onPressed. */
    function pageKeyHandler(globals) {
        return keyHandler('onPressed', globals);
    }

    /** A `property var name: { ... }` binding, evaluated once against the globals. */
    function qmlBinding(name, globals) {
        const signature = new RegExp(`^([ \\t]*)(?:readonly )?property var ${name}: \\{`, 'm');
        const match = source.match(signature);
        assert.ok(match, `Missing QML binding in ${file}: ${name}`);
        const start = match.index + match[0].length - 1;
        const body = block(start, match[1], `binding ${name}`);
        return run(`function () ${body}`, globals)();
    }

    return { source, qmlFunction, keyHandler, pageKeyHandler, qmlBinding };
}

module.exports = { qmlSource };
