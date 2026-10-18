TEMPLATE = app
TARGET = tst_searchmatch
QT = core testlib
CONFIG += console c++17 testcase
CONFIG -= app_bundle
INCLUDEPATH += $$PWD/../../app
SOURCES += $$PWD/tst_searchmatch.cpp
HEADERS += $$PWD/../../app/backend/librarysearch.h
