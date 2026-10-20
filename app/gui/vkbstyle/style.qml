// Copyright (C) 2016 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only
//
// StreamLight's style for Qt Virtual Keyboard, the library search's on-screen keyboard
// (7.1.0). Qt's "default" style (qtvirtualkeyboard v6.8.3, src/styles/builtin/default) with
// its colours, font and icons taken from Theme, so it follows Light and Dark and the accent.
// The keys are UnlockPad's: a faint wash with a hairline border, and the D-pad cursor is the
// accent tint with the ink border, as a focused key there.
//
// Found by name: main.cpp sets QT_VIRTUALKEYBOARD_STYLE=streamlight, and qml.qrc puts this
// file at qrc:/QtQuick/VirtualKeyboard/content/styles/streamlight/style.qml, one of the
// places Qt looks for a style (QQuickVirtualKeyboardSettings::stylePath).
//
// ⚠️ The icons are SVGs in two inks, white and dark, picked by Theme.light (as pin.svg and
// pin_dark.svg are): Qt 6 has no way to recolour them here, the default style's KeyIcon
// shader being Qt 5 GLSL.

import QtQuick
import QtQuick.Layouts
import QtQuick.VirtualKeyboard
import QtQuick.VirtualKeyboard.Styles
import Theme 1.0

KeyboardStyle {
    id: currentStyle
    readonly property bool compactSelectionList: [InputEngine.InputMode.Pinyin, InputEngine.InputMode.Cangjie, InputEngine.InputMode.Zhuyin].indexOf(InputContext.inputEngine.inputMode) !== -1
    readonly property string fontFamily: Theme.family
    readonly property real keyBackgroundMargin: Math.max(2, Math.round(10 * scaleHint))
    readonly property real keyContentMargin: Math.round(40 * scaleHint)
    readonly property real keyIconScale: scaleHint * 0.8
    readonly property real keyRadius: Math.max(4, Math.round(22 * scaleHint))
    readonly property string resourcePrefix: "qrc:/QtQuick/VirtualKeyboard/content/styles/streamlight/"
    // What this style has no icon of its own for: handwriting, which this build leaves out.
    readonly property string builtinPrefix: "qrc:/qt-project.org/imports/QtQuick/VirtualKeyboard/Styles/Builtin/default/"

    readonly property string inputLocale: InputContext.locale

    // An icon in the ink that reads on the key: dark on Light's pale keys, white on Dark's.
    function icon(name) {
        return resourcePrefix + "images/" + name + (Theme.light ? "_dark" : "") + ".svg"
    }
    // The same on the accent (Enter, Caps Lock), in the ink Theme picked for it.
    function iconOnAccent(name) {
        return resourcePrefix + "images/" + name + (Theme.onAccent.hslLightness < 0.5 ? "_dark" : "") + ".svg"
    }
    function _tint(alpha) { return Qt.rgba(Theme.tintBase.r, Theme.tintBase.g, Theme.tintBase.b, alpha) }
    function _accent(alpha) { return Qt.rgba(Theme.accent.r, Theme.accent.g, Theme.accent.b, alpha) }
    /// A key's fill. action: the keys that do something rather than type (Backspace, Shift,
    /// the mode keys) sit a step stronger, as the secondary buttons do elsewhere.
    function keyColor(control, action) {
        if (control && control.pressed) return _accent(0.32)
        if (control && control.highlighted) return _tint(0.16)
        return _tint(action ? 0.12 : 0.07)
    }

    property color keyboardBackgroundColor: Theme.card
    property color keyTextColor: Theme.text
    property color keySmallTextColor: Theme.text2
    property color actionKeyTextColor: Theme.text2
    property color popupBackgroundColor: Theme.cardHigh
    property color popupBorderColor: Theme.lineHigh
    property color popupTextColor: Theme.text
    property color popupHighlightColor: _accent(0.30)
    property color selectionListTextColor: Theme.text
    property color selectionListSeparatorColor: Theme.lineHigh
    property color selectionListBackgroundColor: Theme.card

    property real inputLocaleIndicatorOpacity: 1.0
    property Timer inputLocaleIndicatorHighlightTimer: Timer {
        interval: 1000
        onTriggered: inputLocaleIndicatorOpacity = 0.5
    }
    onInputLocaleChanged: {
        inputLocaleIndicatorOpacity = 1.0
        inputLocaleIndicatorHighlightTimer.restart()
    }

    property Component component_settingsIcon: Component {
        Image {
            sourceSize.width: 80 * keyIconScale
            sourceSize.height: 80 * keyIconScale
            smooth: true
            opacity: 0.75
            source: currentStyle.icon("settings")
        }
    }

    keyboardDesignWidth: 2560
    keyboardDesignHeight: 800
    keyboardRelativeLeftMargin: 16 / keyboardDesignWidth
    keyboardRelativeRightMargin: 16 / keyboardDesignWidth
    keyboardRelativeTopMargin: 16 / keyboardDesignHeight
    keyboardRelativeBottomMargin: 16 / keyboardDesignHeight

    // A card, as the dialogs are: it sits over the library rather than pushing it up.
    keyboardBackground: Rectangle {
        color: keyboardBackgroundColor
        radius: Math.round(keyRadius * 1.6)
        border.width: 1
        border.color: Theme.lineHigh
    }

    keyPanel: KeyPanel {
        id: keyPanel
        Rectangle {
            id: keyBackground
            radius: keyRadius
            color: currentStyle.keyColor(control, false)
            border.width: 1
            border.color: Theme.lineHigh
            anchors.fill: keyPanel
            anchors.margins: keyBackgroundMargin
            Text {
                id: keySmallText
                text: control.smallText
                visible: control.smallTextVisible
                color: keySmallTextColor
                anchors.right: parent.right
                anchors.top: parent.top
                anchors.margins: keyContentMargin / 3
                font {
                    family: fontFamily
                    weight: Font.Normal
                    pixelSize: 44 * scaleHint
                    capitalization: control.uppercased ? Font.AllUppercase : Font.MixedCase
                }
            }
            Loader {
                id: loader_settingsIcon
                anchors.right: parent.right
                anchors.top: parent.top
                anchors.margins: keyContentMargin / 3
            }
            Text {
                id: keyText
                text: control.displayText
                color: keyTextColor
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                anchors.fill: parent
                anchors.leftMargin: keyContentMargin
                anchors.topMargin: keyContentMargin
                anchors.rightMargin: keyContentMargin
                anchors.bottomMargin: keyContentMargin
                font {
                    family: fontFamily
                    weight: Font.Medium
                    pixelSize: 64 * scaleHint
                    capitalization: control.uppercased ? Font.AllUppercase : Font.MixedCase
                }
            }
            states: [
                State {
                    when: control.smallText === "⚙" && control.smallTextVisible
                    PropertyChanges {
                        target: keySmallText
                        visible: false
                    }
                    PropertyChanges {
                        target: loader_settingsIcon
                        sourceComponent: component_settingsIcon
                    }
                }
            ]
        }
        states: [
            State {
                name: "disabled"
                when: !control.enabled
                PropertyChanges {
                    target: keyText
                    opacity: 0.25
                }
            }
        ]
    }

    backspaceKeyPanel: KeyPanel {
        id: backspaceKeyPanel
        Rectangle {
            id: backspaceKeyBackground
            radius: keyRadius
            color: currentStyle.keyColor(control, true)
            border.width: 1
            border.color: Theme.lineHigh
            anchors.fill: backspaceKeyPanel
            anchors.margins: keyBackgroundMargin
            Image {
                id: backspaceKeyIcon
                anchors.centerIn: parent
                sourceSize.height: 88 * keyIconScale
                smooth: true
                opacity: 0.8
                source: currentStyle.icon("backspace")
            }
        }
        states: [
            State {
                name: "disabled"
                when: !control.enabled
                PropertyChanges {
                    target: backspaceKeyIcon
                    opacity: 0.2
                }
            }
        ]
    }

    languageKeyPanel: KeyPanel {
        id: languageKeyPanel
        Rectangle {
            id: languageKeyBackground
            radius: keyRadius
            color: currentStyle.keyColor(control, true)
            border.width: 1
            border.color: Theme.lineHigh
            anchors.fill: languageKeyPanel
            anchors.margins: keyBackgroundMargin
            Image {
                id: languageKeyIcon
                anchors.centerIn: parent
                sourceSize.height: 110 * keyIconScale
                smooth: true
                opacity: 0.8
                source: currentStyle.icon("globe")
            }
        }
        states: [
            State {
                name: "disabled"
                when: !control.enabled
                PropertyChanges {
                    target: languageKeyIcon
                    opacity: 0.2
                }
            }
        ]
    }

    // Enter is the accent, as the primary button is in the dialogs: in the search it is
    // the way to the results.
    enterKeyPanel: KeyPanel {
        id: enterKeyPanel
        Rectangle {
            id: enterKeyBackground
            radius: keyRadius
            color: control && control.pressed ? Qt.darker(Theme.accentFill, 1.15) : Theme.accentFill
            anchors.fill: enterKeyPanel
            anchors.margins: keyBackgroundMargin
            Image {
                id: enterKeyIcon
                visible: enterKeyText.text.length === 0
                anchors.centerIn: parent
                readonly property size enterKeyIconSize: {
                    switch (control.actionId) {
                    case EnterKeyAction.Go:
                    case EnterKeyAction.Send:
                    case EnterKeyAction.Next:
                    case EnterKeyAction.Done:
                        return Qt.size(170, 119)
                    case EnterKeyAction.Search:
                        return Qt.size(148, 148)
                    default:
                        return Qt.size(211, 80)
                    }
                }
                sourceSize.height: enterKeyIconSize.height * keyIconScale
                smooth: true
                source: {
                    switch (control.actionId) {
                    case EnterKeyAction.Go:
                    case EnterKeyAction.Send:
                    case EnterKeyAction.Next:
                    case EnterKeyAction.Done:
                        return currentStyle.iconOnAccent("check")
                    case EnterKeyAction.Search:
                        return currentStyle.iconOnAccent("search")
                    default:
                        return currentStyle.iconOnAccent("enter")
                    }
                }
            }
            Text {
                id: enterKeyText
                visible: text.length !== 0
                text: control.actionId !== EnterKeyAction.None ? control.displayText : ""
                clip: true
                fontSizeMode: Text.HorizontalFit
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                color: Theme.onAccent
                font {
                    family: fontFamily
                    weight: Font.DemiBold
                    pixelSize: 50 * scaleHint
                    capitalization: Font.AllUppercase
                }
                anchors.fill: parent
                anchors.margins: Math.round(42 * scaleHint)
            }
        }
        states: [
            State {
                name: "disabled"
                when: !control.enabled
                PropertyChanges {
                    target: enterKeyBackground
                    opacity: 0.4
                }
            }
        ]
    }

    hideKeyPanel: KeyPanel {
        id: hideKeyPanel
        Rectangle {
            id: hideKeyBackground
            radius: keyRadius
            color: currentStyle.keyColor(control, true)
            border.width: 1
            border.color: Theme.lineHigh
            anchors.fill: hideKeyPanel
            anchors.margins: keyBackgroundMargin
            Image {
                id: hideKeyIcon
                anchors.centerIn: parent
                sourceSize.height: 110 * keyIconScale
                smooth: true
                opacity: 0.8
                source: currentStyle.icon("hidekeyboard")
            }
        }
        states: [
            State {
                name: "disabled"
                when: !control.enabled
                PropertyChanges {
                    target: hideKeyIcon
                    opacity: 0.2
                }
            }
        ]
    }

    // Shift on for one letter: the accent tint, as a selected chip. Caps Lock: the accent.
    shiftKeyPanel: KeyPanel {
        id: shiftKeyPanel
        Rectangle {
            id: shiftKeyBackground
            radius: keyRadius
            color: currentStyle.keyColor(control, true)
            border.width: 1
            border.color: Theme.lineHigh
            anchors.fill: shiftKeyPanel
            anchors.margins: keyBackgroundMargin
            Image {
                id: shiftKeyIcon
                anchors.centerIn: parent
                sourceSize.height: 120 * keyIconScale
                smooth: true
                opacity: 0.8
                source: currentStyle.icon("shift")
            }
            states: [
                State {
                    name: "capsLockActive"
                    when: InputContext.capsLockActive
                    PropertyChanges {
                        target: shiftKeyBackground
                        color: Theme.accentFill
                        border.width: 0
                    }
                    PropertyChanges {
                        target: shiftKeyIcon
                        opacity: 1
                        source: currentStyle.iconOnAccent("shift")
                    }
                },
                State {
                    name: "shiftActive"
                    when: InputContext.shiftActive
                    PropertyChanges {
                        target: shiftKeyBackground
                        color: currentStyle._accent(0.30)
                        border.color: Theme.ink
                    }
                    PropertyChanges {
                        target: shiftKeyIcon
                        opacity: 1
                    }
                }
            ]
        }
        states: [
            State {
                name: "disabled"
                when: !control.enabled
                PropertyChanges {
                    target: shiftKeyIcon
                    opacity: 0.2
                }
            }
        ]
    }

    spaceKeyPanel: KeyPanel {
        id: spaceKeyPanel
        Rectangle {
            id: spaceKeyBackground
            radius: keyRadius
            color: currentStyle.keyColor(control, false)
            border.width: 1
            border.color: Theme.lineHigh
            anchors.fill: spaceKeyPanel
            anchors.margins: keyBackgroundMargin
            Text {
                id: spaceKeyText
                text: Qt.locale(InputContext.locale).nativeLanguageName
                color: Theme.text3
                opacity: inputLocaleIndicatorOpacity
                Behavior on opacity { enabled: !Theme.reduceAnimations; PropertyAnimation { duration: 250 } }
                anchors.centerIn: parent
                font {
                    family: fontFamily
                    weight: Font.Normal
                    pixelSize: 48 * scaleHint
                }
            }
        }
    }

    symbolKeyPanel: KeyPanel {
        id: symbolKeyPanel
        Rectangle {
            id: symbolKeyBackground
            radius: keyRadius
            color: currentStyle.keyColor(control, true)
            border.width: 1
            border.color: Theme.lineHigh
            anchors.fill: symbolKeyPanel
            anchors.margins: keyBackgroundMargin
            Text {
                id: symbolKeyText
                text: control.displayText
                color: actionKeyTextColor
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                anchors.fill: parent
                anchors.margins: keyContentMargin
                font {
                    family: fontFamily
                    weight: Font.DemiBold
                    pixelSize: 52 * scaleHint
                    capitalization: Font.AllUppercase
                }
            }
        }
        states: [
            State {
                name: "disabled"
                when: !control.enabled
                PropertyChanges {
                    target: symbolKeyText
                    opacity: 0.2
                }
            }
        ]
    }

    modeKeyPanel: KeyPanel {
        id: modeKeyPanel
        Rectangle {
            id: modeKeyBackground
            radius: keyRadius
            color: currentStyle.keyColor(control, true)
            border.width: 1
            border.color: Theme.lineHigh
            anchors.fill: modeKeyPanel
            anchors.margins: keyBackgroundMargin
            Text {
                id: modeKeyText
                text: control.displayText
                color: actionKeyTextColor
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                anchors.fill: parent
                anchors.margins: keyContentMargin
                font {
                    family: fontFamily
                    weight: Font.DemiBold
                    pixelSize: 52 * scaleHint
                    capitalization: Font.AllUppercase
                }
            }
            Rectangle {
                id: modeKeyIndicator
                implicitHeight: parent.height * 0.1
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                anchors.leftMargin: parent.width * 0.4
                anchors.rightMargin: parent.width * 0.4
                anchors.bottomMargin: parent.height * 0.12
                color: Theme.ink
                radius: height / 2
                visible: control.mode
            }
        }
        states: [
            State {
                name: "disabled"
                when: !control.enabled
                PropertyChanges {
                    target: modeKeyText
                    opacity: 0.2
                }
            }
        ]
    }

    handwritingKeyPanel: KeyPanel {
        id: handwritingKeyPanel
        Rectangle {
            id: hwrKeyBackground
            radius: keyRadius
            color: currentStyle.keyColor(control, true)
            border.width: 1
            border.color: Theme.lineHigh
            anchors.fill: handwritingKeyPanel
            anchors.margins: keyBackgroundMargin
            Image {
                id: hwrKeyIcon
                anchors.centerIn: parent
                sourceSize.height: 127 * keyIconScale
                smooth: true
                source: builtinPrefix + (keyboard.handwritingMode ? "images/textmode-fff.svg" : "images/handwriting-fff.svg")
            }
        }
    }

    characterPreviewMargin: 0
    characterPreviewDelegate: Item {
        property string text
        property string flickLeft
        property string flickTop
        property string flickRight
        property string flickBottom
        readonly property bool flickKeysSet: flickLeft || flickTop || flickRight || flickBottom
        readonly property bool flickKeysVisible: text && flickKeysSet &&
                                                 text !== flickLeft && text !== flickTop && text !== flickRight && text !== flickBottom
        id: characterPreview
        Rectangle {
            id: characterPreviewBackground
            anchors.fill: parent
            color: popupBackgroundColor
            border.width: 1
            border.color: popupBorderColor
            radius: keyRadius
            readonly property int largeTextHeight: Math.round(height / 3 * 2)
            readonly property int smallTextHeight: Math.round(height / 3)
            readonly property int smallTextMargin: Math.round(3 * scaleHint)
            Text {
                id: characterPreviewText
                color: popupTextColor
                text: characterPreview.text
                fontSizeMode: Text.VerticalFit
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.verticalCenter: parent.verticalCenter
                height: characterPreviewBackground.largeTextHeight
                font {
                    family: fontFamily
                    weight: Font.Medium
                    pixelSize: 82 * scaleHint
                }
            }
            Text {
                color: popupTextColor
                text: characterPreview.flickLeft
                visible: characterPreview.flickKeysVisible
                opacity: 0.8
                fontSizeMode: Text.VerticalFit
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                anchors.left: parent.left
                anchors.leftMargin: characterPreviewBackground.smallTextMargin
                anchors.verticalCenter: parent.verticalCenter
                height: characterPreviewBackground.smallTextHeight
                font {
                    family: fontFamily
                    weight: Font.Normal
                    pixelSize: 62 * scaleHint
                }
            }
            Text {
                color: popupTextColor
                text: characterPreview.flickTop
                visible: characterPreview.flickKeysVisible
                opacity: 0.8
                fontSizeMode: Text.VerticalFit
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                anchors.top: parent.top
                anchors.topMargin: characterPreviewBackground.smallTextMargin
                anchors.horizontalCenter: parent.horizontalCenter
                height: characterPreviewBackground.smallTextHeight
                font {
                    family: fontFamily
                    weight: Font.Normal
                    pixelSize: 62 * scaleHint
                }
            }
            Text {
                color: popupTextColor
                text: characterPreview.flickRight
                visible: characterPreview.flickKeysVisible
                opacity: 0.8
                fontSizeMode: Text.VerticalFit
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                anchors.right: parent.right
                anchors.rightMargin: characterPreviewBackground.smallTextMargin
                anchors.verticalCenter: parent.verticalCenter
                height: characterPreviewBackground.smallTextHeight
                font {
                    family: fontFamily
                    weight: Font.Normal
                    pixelSize: 62 * scaleHint
                }
            }
            Text {
                color: popupTextColor
                text: characterPreview.flickBottom
                visible: characterPreview.flickKeysVisible
                opacity: 0.8
                fontSizeMode: Text.VerticalFit
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                anchors.bottom: parent.bottom
                anchors.bottomMargin: characterPreviewBackground.smallTextMargin
                anchors.horizontalCenter: parent.horizontalCenter
                height: characterPreviewBackground.smallTextHeight
                font {
                    family: fontFamily
                    weight: Font.Normal
                    pixelSize: 62 * scaleHint
                }
            }
            states: State {
                name: "flickKeysVisible"
                when: characterPreview.flickKeysVisible
                PropertyChanges {
                    target: characterPreviewText
                    height: characterPreviewBackground.smallTextHeight
                }
            }
        }
    }

    alternateKeysListItemWidth: 120 * scaleHint
    alternateKeysListItemHeight: 170 * scaleHint
    alternateKeysListDelegate: Item {
        id: alternateKeysListItem
        width: alternateKeysListItemWidth
        height: alternateKeysListItemHeight
        Text {
            id: listItemText
            text: model.text
            color: popupTextColor
            opacity: 0.8
            font {
                family: fontFamily
                weight: Font.Normal
                pixelSize: 60 * scaleHint
            }
            anchors.centerIn: parent
        }
        states: State {
            name: "current"
            when: alternateKeysListItem.ListView.isCurrentItem
            PropertyChanges {
                target: listItemText
                opacity: 1
            }
        }
    }
    alternateKeysListHighlight: Rectangle {
        color: popupHighlightColor
        border.width: 2
        border.color: Theme.ink
        radius: keyRadius
    }
    alternateKeysListBackground: Item {
        Rectangle {
            readonly property real margin: 20 * scaleHint
            x: -margin
            y: -margin
            width: parent.width + 2 * margin
            height: parent.height + 2 * margin
            radius: keyRadius
            color: popupBackgroundColor
            border {
                width: 1
                color: popupBorderColor
            }
        }
    }

    selectionListHeight: 85 * scaleHint
    selectionListDelegate: SelectionListItem {
        id: selectionListItem
        width: Math.round(selectionListLabel.width + selectionListLabel.anchors.leftMargin * 2)
        Text {
            id: selectionListLabel
            anchors.left: parent.left
            anchors.leftMargin: Math.round((compactSelectionList ? 50 : 140) * scaleHint)
            anchors.verticalCenter: parent.verticalCenter
            text: decorateText(display, wordCompletionLength)
            color: selectionListTextColor
            opacity: 0.9
            font {
                family: fontFamily
                weight: Font.Normal
                pixelSize: 44 * scaleHint
            }
            function decorateText(text, wordCompletionLength) {
                if (wordCompletionLength > 0) {
                    return text.slice(0, -wordCompletionLength) + '<u>' + text.slice(-wordCompletionLength) + '</u>'
                }
                return text
            }
        }
        Rectangle {
            id: selectionListSeparator
            width: 4 * scaleHint
            height: 36 * scaleHint
            radius: 2
            color: selectionListSeparatorColor
            anchors.verticalCenter: parent.verticalCenter
            anchors.right: parent.left
        }
        states: State {
            name: "current"
            when: selectionListItem.ListView.isCurrentItem
            PropertyChanges {
                target: selectionListLabel
                opacity: 1
            }
        }
    }
    selectionListBackground: Rectangle {
        color: selectionListBackgroundColor
    }
    selectionListAdd: Transition {
        NumberAnimation { property: "y"; from: wordCandidateView.height; duration: 200 }
        NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 200 }
    }
    selectionListRemove: Transition {
        NumberAnimation { property: "y"; to: -wordCandidateView.height; duration: 200 }
        NumberAnimation { property: "opacity"; to: 0; duration: 200 }
    }

    // The D-pad's cursor: a focused key, as on UnlockPad — the accent tinting the key and the
    // ink drawing its border. Laid over the whole key, so it is drawn in from the key's gap.
    navigationHighlight: Item {
        Rectangle {
            anchors.fill: parent
            anchors.margins: keyBackgroundMargin
            radius: keyRadius
            color: currentStyle._accent(0.22)
            border.color: Theme.ink
            border.width: 2
        }
    }

    traceInputKeyPanelDelegate: TraceInputKeyPanel {
        id: traceInputKeyPanel
        traceMargins: keyBackgroundMargin
        Rectangle {
            id: traceInputKeyPanelBackground
            radius: keyRadius
            color: currentStyle._tint(0.07)
            anchors.fill: traceInputKeyPanel
            anchors.margins: keyBackgroundMargin
        }
    }

    traceCanvasDelegate: TraceCanvas {
        id: traceCanvas
        onAvailableChanged: {
            if (!available)
                return
            var ctx = getContext("2d")
            ctx.lineWidth = 10 * scaleHint
            ctx.strokeStyle = Theme.text
            ctx.lineCap = "round"
            ctx.fillStyle = ctx.strokeStyle
        }
        autoDestroyDelay: 800
        onTraceChanged: if (trace === null) opacity = 0
        Behavior on opacity { PropertyAnimation { easing.type: Easing.OutCubic; duration: 150 } }
    }

    popupListDelegate: SelectionListItem {
        property real cursorAnchor: popupListLabel.x + popupListLabel.width
        id: popupListItem
        width: popupListLabel.width + popupListLabel.anchors.leftMargin * 2
        height: popupListLabel.height + popupListLabel.anchors.topMargin * 2
        Text {
            id: popupListLabel
            anchors.left: parent.left
            anchors.top: parent.top
            anchors.leftMargin: popupListLabel.height / 2
            anchors.topMargin: popupListLabel.height / 3
            text: decorateText(display, wordCompletionLength)
            color: popupTextColor
            opacity: 0.8
            font {
                family: fontFamily
                weight: Font.Normal
                pixelSize: Qt.inputMethod.cursorRectangle.height * 0.8
            }
            function decorateText(text, wordCompletionLength) {
                if (wordCompletionLength > 0) {
                    return text.slice(0, -wordCompletionLength) + '<u>' + text.slice(-wordCompletionLength) + '</u>'
                }
                return text
            }
        }
        states: State {
            name: "current"
            when: popupListItem.ListView.isCurrentItem
            PropertyChanges {
                target: popupListLabel
                opacity: 1.0
            }
        }
    }

    popupListBackground: Item {
        Rectangle {
            width: parent.width
            height: parent.height
            radius: keyRadius
            color: popupBackgroundColor
            border {
                width: 1
                color: popupBorderColor
            }
        }
    }

    popupListAdd: Transition {
        NumberAnimation { property: "opacity"; from: 0; to: 1.0; duration: 200 }
    }

    popupListRemove: Transition {
        NumberAnimation { property: "opacity"; to: 0; duration: 200 }
    }

    languagePopupListEnabled: true

    languageListDelegate: SelectionListItem {
        id: languageListItem
        width: languageNameTextMetrics.width * 17
        height: languageNameTextMetrics.height + languageListLabel.anchors.topMargin + languageListLabel.anchors.bottomMargin
        Text {
            id: languageListLabel
            anchors.left: parent.left
            anchors.top: parent.top
            anchors.leftMargin: languageNameTextMetrics.height / 2
            anchors.rightMargin: anchors.leftMargin
            anchors.topMargin: languageNameTextMetrics.height / 3
            anchors.bottomMargin: anchors.topMargin
            text: languageNameFormatter.elidedText
            color: popupTextColor
            opacity: 0.8
            font {
                family: fontFamily
                weight: Font.Normal
                pixelSize: 44 * scaleHint
            }
        }
        TextMetrics {
            id: languageNameTextMetrics
            font {
                family: fontFamily
                weight: Font.Normal
                pixelSize: 44 * scaleHint
            }
            text: "X"
        }
        TextMetrics {
            id: languageNameFormatter
            font {
                family: fontFamily
                weight: Font.Normal
                pixelSize: 44 * scaleHint
            }
            elide: Text.ElideRight
            elideWidth: languageListItem.width - languageListLabel.anchors.leftMargin - languageListLabel.anchors.rightMargin
            text: displayName
        }
        states: State {
            name: "current"
            when: languageListItem.ListView.isCurrentItem
            PropertyChanges {
                target: languageListLabel
                opacity: 1
            }
        }
    }

    languageListHighlight: Rectangle {
        color: popupHighlightColor
        border.width: 2
        border.color: Theme.ink
        radius: keyRadius
    }

    languageListBackground: Rectangle {
        color: popupBackgroundColor
        radius: keyRadius
        border {
            width: 1
            color: popupBorderColor
        }
    }

    languageListAdd: Transition {
        NumberAnimation { property: "opacity"; from: 0; to: 1.0; duration: 200 }
    }

    languageListRemove: Transition {
        NumberAnimation { property: "opacity"; to: 0; duration: 200 }
    }

    selectionHandle: Image {
        sourceSize.width: 20
        source: builtinPrefix + "images/selectionhandle-bottom.svg"
    }

    fullScreenInputContainerBackground: Rectangle {
        color: Theme.card
    }

    fullScreenInputBackground: Rectangle {
        color: Theme.ground
    }

    fullScreenInputMargins: Math.round(15 * scaleHint)

    fullScreenInputPadding: Math.round(30 * scaleHint)

    fullScreenInputCursor: Rectangle {
        width: 1
        color: Theme.text
        visible: parent.blinkStatus
    }

    fullScreenInputFont.pixelSize: 58 * scaleHint

    functionPopupListDelegate: Item {
        id: functionPopupListItem
        readonly property real iconMargin: 40 * scaleHint
        readonly property real iconWidth: 144 * keyIconScale
        readonly property real iconHeight: 144 * keyIconScale
        width: iconWidth + 2 * iconMargin
        height: iconHeight + 2 * iconMargin
        Image {
            id: functionIcon
            anchors.centerIn: parent
            sourceSize.height: iconHeight
            smooth: true
            source: {
                switch (keyboardFunction) {
                case QtVirtualKeyboard.KeyboardFunction.HideInputPanel:
                    return currentStyle.icon("hidekeyboard")
                case QtVirtualKeyboard.KeyboardFunction.ChangeLanguage:
                    return currentStyle.icon("globe")
                case QtVirtualKeyboard.KeyboardFunction.ToggleHandwritingMode:
                    return builtinPrefix + (keyboard.handwritingMode ? "images/textmode-fff.svg" : "images/handwriting-fff.svg")
                }
            }
        }
    }

    functionPopupListBackground: Item {
        Rectangle {
            readonly property real backgroundMargin: 20 * scaleHint
            x: -backgroundMargin
            y: -backgroundMargin
            width: parent.width + 2 * backgroundMargin
            height: parent.height + 2 * backgroundMargin
            radius: keyRadius
            color: popupBackgroundColor
            border {
                width: 1
                color: popupBorderColor
            }
        }
    }

    functionPopupListHighlight: Rectangle {
        color: popupHighlightColor
        radius: keyRadius
    }
}
