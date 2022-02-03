import { Uri, EventEmitter, workspace, window } from 'vscode';
import { atob, btoa } from './utils';
import { debounce } from 'lodash';

const SVELTE_URI_SCHEME = 'svelte-compiled';

function toSvelteSchemeUri(srcUri, asString) {
    srcUri = typeof srcUri == 'string' ? Uri.parse(srcUri) : srcUri;
    const src = btoa(srcUri.toString());
    const destUri = srcUri.with({
        scheme: SVELTE_URI_SCHEME,
        fragment: src,
        path: srcUri.path + '.js'
    });
    return asString ? destUri.toString() : destUri;
}

function fromSvelteSchemeUri(destUri, asString) {
    destUri = typeof destUri == 'string' ? Uri.parse(destUri) : destUri;
    const src = atob(destUri.fragment);
    return asString ? src : Uri.parse(src);
}

export default class CompiledCodeContentProvider {
    static scheme = SVELTE_URI_SCHEME;
    static toSvelteSchemeUri = toSvelteSchemeUri;
    static fromSvelteSchemeUri = fromSvelteSchemeUri;

    disposed = false;
    didChangeEmitter = new EventEmitter();
    subscriptions = [];
    watchedSourceUri = new Set();

    get onDidChange() {
        return this.didChangeEmitter.event;
    }

    constructor(getLanguageClient) {
        this.getLanguageClient = getLanguageClient;
        this.subscriptions.push(
            workspace.onDidChangeTextDocument(
                debounce(async (changeEvent) => {
                    if (changeEvent.document.languageId !== 'svelte') {
                        return;
                    }

                    const srcUri = changeEvent.document.uri.toString();
                    if (this.watchedSourceUri.has(srcUri)) {
                        this.didChangeEmitter.fire(toSvelteSchemeUri(srcUri));
                    }
                }, 500)
            )
        );

        window.onDidChangeVisibleTextEditors((editors) => {
            const previewEditors = editors.filter(
                (editor) => editor?.document?.uri?.scheme === SVELTE_URI_SCHEME
            );
            this.watchedSourceUri = new Set(
                previewEditors.map((editor) => fromSvelteSchemeUri(editor.document.uri, true))
            );
        });
    }

    async provideTextDocumentContent(uri) {
        const srcUriStr = fromSvelteSchemeUri(uri, true);
        this.watchedSourceUri.add(srcUriStr);

        const resp = await this.getLanguageClient().sendRequest('$/getCompiledCode', srcUriStr);
        if (resp?.js?.code) {
            return resp.js.code;
        } else {
            window.setStatusBarMessage(`Svelte: fail to compile ${uri.path}`, 3000);
        }
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.didChangeEmitter.dispose();
        this.subscriptions.forEach((d) => d.dispose());
        this.subscriptions.length = 0;
        this.disposed = true;
    }
}
