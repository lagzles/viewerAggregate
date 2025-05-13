/// import * as Autodesk from "@types/forge-viewer";
import  MultiModelExtensionBase from './multiModelExtensionBase.js';

export async function getMyAccesToken(){
    try {
        const resp = await fetch('/api/auth/token');
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const { access_token, expires_in } = await resp.json();
        return { access_token, expires_in };
    } catch (err) {
        alert('Could not obtain access token. See the console for more details.');
        console.error(err);
    }
}

async function getAccessToken(callback) {
    try {
        const { access_token, expires_in } = await getMyAccesToken();
        callback(access_token, expires_in);
    } catch (err) {
        alert('Could not obtain access token. See the console for more details.');
        console.error(err);
    }
}

Autodesk.Viewing.theExtensionManager.registerExtension(
    'MultiModelExtensionBase', 
    MultiModelExtensionBase // Your extension class
);

export function initViewer(container) {
    return new Promise(function (resolve, reject) {
        Autodesk.Viewing.Initializer({ env: 'AutodeskProduction', getAccessToken }, function () {
            const config = {
                extensions: ['Autodesk.DocumentBrowser', 'MultiModelExtensionBase']
            };
            const viewer = new Autodesk.Viewing.GuiViewer3D(container, config);
            viewer.start();
            viewer.setTheme('light-theme');
            viewer.setBackgroundColor(255, 255, 255, 255, 255, 255);
            viewer.setLightPreset(0);
            resolve(viewer);
        });
    });
}

export function loadMultimodelExtension(viewer) {
    return new Promise(function (resolve, reject) {
        viewer.loadExtension(MultiModelExtensionBase, {}).then(() => {
                resolve(viewer);
            }).catch(err => {
                console.error('Error loading extension:\n', err);
                reject(err);
            });
            resolve(viewer);
    });
}

export function loadModel(viewer, urn, options = {}) {
    return new Promise(function (resolve, reject) {
        function onDocumentLoadSuccess(doc) {
            const viewable = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, viewable, options)
                .then(model => resolve(model)) // só resolve quando o modelo estiver pronto
                .catch(reject);
        }

        function onDocumentLoadFailure(code, message, errors) {
            reject({ code, message, errors });
        }

        viewer.setLightPreset(0);
        Autodesk.Viewing.Document.load('urn:' + urn, onDocumentLoadSuccess, onDocumentLoadFailure);
    });
}


export function loadModelNoOptions(viewer, urn) {
    return new Promise(function (resolve, reject) {
        function onDocumentLoadSuccess(doc) {
            const viewable = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, viewable)
                .then(model => resolve(model)) // só resolve quando o modelo estiver pronto
                .catch(reject);
        }

        function onDocumentLoadFailure(code, message, errors) {
            reject({ code, message, errors });
        }

        viewer.setLightPreset(0);
        Autodesk.Viewing.Document.load('urn:' + urn, onDocumentLoadSuccess, onDocumentLoadFailure);
    });
}



export async function loadCompositeModel(viewer, compositeUrn) {
    // This would be similar to loadModel but for composites
    const options = {
        applyRefPoint: true,
        keepCurrentModels: false
    };
    
    return new Promise((resolve, reject) => {
        Autodesk.Viewing.Document.load(
            `urn:${compositeUrn}`,
            doc => {
                const viewable = doc.getRoot().getDefaultGeometry();
                viewer.loadDocumentNode(doc, viewable, options)
                    .then(model => resolve(model))
                    .catch(reject);
            },
            reject
        );
    });
}
