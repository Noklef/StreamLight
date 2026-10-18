// What the host page's search matches (app/backend/librarysearch.h). Built and run by CI after
// Qt is installed; see .github/workflows/build-windows.yml.
//
// Non-ASCII test strings are written as \u escapes, with a comment saying what they spell: some
// rows differ only in characters that look the same (a precomposed letter, or one followed by
// a combining mark), and escapes keep that visible.

#include "backend/librarysearch.h"

#include <QtTest>

using namespace LibrarySearch;

class TestSearchMatch : public QObject
{
    Q_OBJECT

private slots:
    void searchKey_data()
    {
        QTest::addColumn<QString>("text");
        QTest::addColumn<QString>("key");

        QTest::newRow("case") << "HALO Infinite" << "halo infinite";
        // Pokémon Légendes, precomposed.
        QTest::newRow("accents") << QStringLiteral("Pokémon Légendes") << "pokemon legendes";
        // The trademark sign must not be spelled out as "TM" and glued to the word.
        QTest::newRow("trademark") << QStringLiteral("DOOM™ Eternal") << "doom eternal";
        QTest::newRow("registered") << QStringLiteral("Rainbow Six® Siege") << "rainbow six siege";
        QTest::newRow("punctuation") << "Tom Clancy's: The-Division 2" << "tom clancy s the division 2";
        QTest::newRow("spaces") << "  Steam   Big Picture " << "steam big picture";
        // Full-width FIFA 23, with an ideographic space.
        QTest::newRow("full-width") << QStringLiteral("ＦＩＦＡ　２３") << "fifa 23";
        // Pokémon with the accent as a combining mark after the e.
        QTest::newRow("decomposed input") << QStringLiteral("Pokémon") << "pokemon";
        // A letter outside the BMP (Fraktur A, which NFKD folds to A): read as one code point,
        // not as two surrogates that would each become a space.
        QTest::newRow("outside the BMP") << QStringLiteral("\U0001D504lan Wake") << "alan wake";
        // Ведьмак 3 → ведьмак 3.
        QTest::newRow("cyrillic") << QStringLiteral("Ведьмак 3")
                                  << QStringLiteral("ведьмак 3");
        // A spacing vowel sign (U+093F, U+0940) stays inside the word; the non-spacing anusvara
        // (U+0902) goes like an accent.
        QTest::newRow("devanagari") << QStringLiteral("हिंदी")
                                    << QStringLiteral("हिदी");
        QTest::newRow("symbols only") << QStringLiteral("™ - :") << "";
    }
    void searchKey()
    {
        QFETCH(QString, text);
        QFETCH(QString, key);
        QCOMPARE(LibrarySearch::searchKey(text), key);
    }

    void matches_data()
    {
        QTest::addColumn<QString>("title");
        QTest::addColumn<QString>("query");
        QTest::addColumn<bool>("match");

        QTest::newRow("prefix") << "Halo Infinite" << "hal" << true;
        QTest::newRow("inside a word") << "Halo Infinite" << "finite" << true;
        QTest::newRow("case") << "Halo Infinite" << "HALO" << true;
        QTest::newRow("no match") << "Halo Infinite" << "zelda" << false;
        QTest::newRow("accent in title") << QStringLiteral("Pokémon Legends: Arceus") << "pokemon" << true;
        QTest::newRow("accent in query") << "Pokemon Legends" << QStringLiteral("POKÉMON") << true;
        QTest::newRow("trademark") << QStringLiteral("DOOM™ Eternal") << "doom eternal" << true;
        QTest::newRow("words in any order") << QStringLiteral("DOOM™ Eternal") << "eternal doom" << true;
        QTest::newRow("every word must match") << QStringLiteral("DOOM™ Eternal") << "doom halo" << false;
        QTest::newRow("joined hyphen") << "Half-Life 2" << "halflife" << true;
        QTest::newRow("split hyphen") << "Half-Life 2" << "half life" << true;
        QTest::newRow("joined apostrophe") << "Tom Clancy's Rainbow Six" << "clancys" << true;
        QTest::newRow("query punctuation") << "Tom Clancy's Rainbow Six" << "clancy's" << true;
        QTest::newRow("digit") << "Half-Life 2" << "2" << true;
        QTest::newRow("empty") << "Halo" << "" << true;
        QTest::newRow("whitespace") << "Halo" << "   " << true;
        QTest::newRow("punctuation only") << "Halo" << "- :" << true;
        // Final Fantasy XIV in katakana, searched for its first word. The voiced mark on ji
        // decomposes and goes like an accent, the same in title and query.
        QTest::newRow("japanese")
            << QStringLiteral("ファイナルファンタジーXIV")
            << QStringLiteral("ファイナル") << true;
        QTest::newRow("japanese voiced") << QStringLiteral("ファンタジー")
                                         << QStringLiteral("タジ") << true;
        // ВЕДЬМАК finds Ведьмак 3.
        QTest::newRow("cyrillic case") << QStringLiteral("Ведьмак 3")
                                       << QStringLiteral("ВЕДЬМАК") << true;
        QTest::newRow("full-width title") << QStringLiteral("ＦＩＦＡ　２３")
                                          << "fifa 23" << true;
    }
    void matches()
    {
        QFETCH(QString, title);
        QFETCH(QString, query);
        QFETCH(bool, match);
        QCOMPARE(matchesSearch(title, searchTokens(query)), match);
    }

    void tokens()
    {
        QCOMPARE(searchTokens(QStringLiteral("  Half-Life:  2 ")),
                 QStringList({ QStringLiteral("half"), QStringLiteral("life"), QStringLiteral("2") }));
        QVERIFY(searchTokens(QStringLiteral(" ™ ")).isEmpty());
    }
};

QTEST_APPLESS_MAIN(TestSearchMatch)
#include "tst_searchmatch.moc"
