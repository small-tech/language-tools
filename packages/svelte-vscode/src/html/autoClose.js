// Original source: https://github.com/Microsoft/vscode/blob/master/extensions/html-language-features/client/src/tagClosing.ts

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { window, workspace, Disposable, Position, SnippetString } from 'vscode';

export function activateTagClosing(tagProvider, supportedLanguages, configName) {
    const disposables = [];
    workspace.onDidChangeTextDocument(
        (event) => onDidChangeTextDocument(event.document, event.contentChanges),
        null,
        disposables
    );

    let isEnabled = false;
    updateEnabledState();
    window.onDidChangeActiveTextEditor(updateEnabledState, null, disposables);

    let timeout = void 0;

    function updateEnabledState() {
        isEnabled = false;
        const editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        const document = editor.document;
        if (!supportedLanguages[document.languageId]) {
            return;
        }
        if (!workspace.getConfiguration(void 0, document.uri).get(configName)) {
            return;
        }
        isEnabled = true;
    }

    function onDidChangeTextDocument(document, changes) {
        if (!isEnabled) {
            return;
        }
        const activeDocument = window.activeTextEditor && window.activeTextEditor.document;
        if (document !== activeDocument || changes.length === 0) {
            return;
        }
        if (typeof timeout !== 'undefined') {
            clearTimeout(timeout);
        }
        const lastChange = changes[changes.length - 1];
        const lastCharacter = lastChange.text[lastChange.text.length - 1];
        if (
            ('range' in lastChange && (lastChange.rangeLength ?? 0) > 0) ||
            (lastCharacter !== '>' && lastCharacter !== '/')
        ) {
            return;
        }
        const rangeStart =
            'range' in lastChange
                ? lastChange.range.start
                : new Position(0, document.getText().length);
        const version = document.version;
        timeout = setTimeout(() => {
            const position = new Position(
                rangeStart.line,
                rangeStart.character + lastChange.text.length
            );
            tagProvider(document, position).then((text) => {
                if (text && isEnabled) {
                    const activeEditor = window.activeTextEditor;
                    if (activeEditor) {
                        const activeDocument = activeEditor.document;
                        if (document === activeDocument && activeDocument.version === version) {
                            const selections = activeEditor.selections;
                            if (
                                selections.length &&
                                selections.some((s) => s.active.isEqual(position))
                            ) {
                                activeEditor.insertSnippet(
                                    new SnippetString(text),
                                    selections.map((s) => s.active)
                                );
                            } else {
                                activeEditor.insertSnippet(new SnippetString(text), position);
                            }
                        }
                    }
                }
            });
            timeout = void 0;
        }, 100);
    }
    return Disposable.from(...disposables);
}