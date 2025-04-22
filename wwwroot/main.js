import { initViewer, loadModel, getMyAccesToken } from './viewer.js';

initViewer(document.getElementById('preview')).then(viewer => {
    const urn = window.location.hash?.substring(1);
    setupModelSelection(viewer, urn);
    setupModelUpload(viewer);
});

async function setupModelSelection(viewer, selectedUrn) {
    const dropdown = document.getElementById('models');
    dropdown.innerHTML = '';
    try {
        const resp = await fetch('/api/models');
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const models = await resp.json();
        dropdown.innerHTML = models.map(model => `<option value=${model.urn} ${model.urn === selectedUrn ? 'selected' : ''}>${model.name}</option>`).join('\n');
        dropdown.onchange = () => onModelSelected(viewer, dropdown.value);
        if (dropdown.value) {
            onModelSelected(viewer, dropdown.value);
        }

        updateSidebarModelList(models, dropdown.value, viewer);
    } catch (err) {
        alert('Could not list models. See the console for more details.');
        console.error(err);
    }
}

async function setupModelUpload(viewer) {
    const upload = document.getElementById('upload');
    const input = document.getElementById('input');
    const models = document.getElementById('models');
    upload.onclick = () => input.click();
    input.onchange = async () => {
        const file = input.files[0];
        let data = new FormData();
        data.append('model-file', file);
        if (file.name.endsWith('.zip')) { // When uploading a zip file, ask for the main design file in the archive
            const entrypoint = window.prompt('Please enter the filename of the main design inside the archive.');
            data.append('model-zip-entrypoint', entrypoint);
        }
        upload.setAttribute('disabled', 'true');
        models.setAttribute('disabled', 'true');
        showNotification(`Uploading model <em>${file.name}</em>. Do not reload the page.`);
        try {
            const resp = await fetch('/api/models', { method: 'POST', body: data });
            if (!resp.ok) {
                throw new Error(await resp.text());
            }
            const model = await resp.json();
            setupModelSelection(viewer, model.urn);
        } catch (err) {
            alert(`Could not upload model ${file.name}. See the console for more details.`);
            console.error(err);
        } finally {
            clearNotification();
            upload.removeAttribute('disabled');
            models.removeAttribute('disabled');
            input.value = '';
        }
    };
}

async function onModelSelected(viewer, urn) {
    if (window.onModelSelectedTimeout) {
        clearTimeout(window.onModelSelectedTimeout);
        delete window.onModelSelectedTimeout;
    }
    window.location.hash = urn;
    try {
        const resp = await fetch(`/api/models/${urn}/status`);
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const status = await resp.json();
        switch (status.status) {
            case 'n/a':
                showNotification(`Model has not been translated.`);
                break;
            case 'inprogress':
                showNotification(`Model is being translated (${status.progress})...`);
                window.onModelSelectedTimeout = setTimeout(onModelSelected, 5000, viewer, urn);
                break;
            case 'failed':
                showNotification(`Translation failed. <ul>${status.messages.map(msg => `<li>${JSON.stringify(msg)}</li>`).join('')}</ul>`);
                break;
            default:
                clearNotification();
                loadModel(viewer, urn);
                break; 
        }
    } catch (err) {
        alert('Could not load model. See the console for more details.');
        console.error(err);
    }
}

function showNotification(message) {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `<div class="notification">${message}</div>`;
    overlay.style.display = 'flex';
}

function clearNotification() {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = '';
    overlay.style.display = 'none';
}

let loadedUrns = new Map();

function updateSidebarModelList(models, selectedUrn, viewer) {
    const listContainer = document.getElementById('model-list');
    models.sort((a, b) => a.name.localeCompare(b.name));

    listContainer.innerHTML = models.map(model => `
        <div>
            <label>
                <input type="checkbox" value="${model.urn}">
                ${model.name}
            </label>
            <button class="delete-model" data-urn="${model.name}" style="margin-left: 8px; color: red;">Excluir</button>
        </div>
    `).join('\n');

    listContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', async (event) => {
            const urn = event.target.value;

            if (event.target.checked) {
                if (!loadedUrns.has(urn)) {
                    try {
                        showNotification(`Carregando modelo ${urn}...`);
                        // const model = await addViewable(viewer, urn);
                        const accessToken = await getMyAccesToken();
                        if (!accessToken) {
                            alert('Could not obtain access token. See the console for more details.');
                            return;
                        }
                        const model = await addViewableWithToken(viewer, urn, accessToken.access_token);
                        loadedUrns.set(urn, model);
                        clearNotification();
                    } catch (err) {
                        alert(`Erro ao carregar modelo ${urn}`);
                        console.error(err);
                    }
                }
            } else {
                const model = loadedUrns.get(urn);
                if (model) {
                    viewer.unloadModel(model);
                    loadedUrns.delete(urn);
                    console.log(`Modelo ${urn} descarregado`);
                }
            }
        });
    });

    listContainer.querySelectorAll('.delete-model').forEach(button => {
        button.addEventListener('click', async (event) => {
            const urn = event.target.dataset.urn;
    
            if (!confirm(`Deseja realmente excluir o modelo ${urn}?`)) return;
    
            try {
                const resp = await fetch(`/api/models/${urn}`, { method: 'DELETE' });
                if (!resp.ok) {
                    throw new Error(await resp.text());
                }
    
                // Se estiver carregado, descarrega
                if (loadedUrns.has(urn)) {
                    viewer.unloadModel(loadedUrns.get(urn));
                    loadedUrns.delete(urn);
                }
    
                // Remove da interface
                const modelDiv = listContainer.querySelector(`div[data-urn="${urn}"]`);
                if (modelDiv) modelDiv.remove();
    
                showNotification(`Modelo ${urn} excluído com sucesso.`);
                setTimeout(clearNotification, 2000);
            } catch (err) {
                alert(`Erro ao excluir modelo ${urn}`);
                console.error(err);
            }
        });
    });
    
}


function addViewable(viewer, urn, xform, offset) {
    return new Promise(function (resolve, reject) {
        function onDocumentLoadSuccess(doc) {
            const viewable = doc.getRoot().getDefaultGeometry();
            const options = {
                keepCurrentModels: true
            };
            if (xform) options.placementTransform = xform;
            if (offset) options.globalOffset = offset;

            viewer
                .loadDocumentNode(doc, viewable, options)
                .then(model => resolve(model)) // <- retorna o model carregado
                .catch(reject);
        }

        function onDocumentLoadFailure(code) {
            reject(`Could not load document (${code}).`);
        }

        Autodesk.Viewing.Document.load(
            "urn:" + urn,
            onDocumentLoadSuccess,
            onDocumentLoadFailure
        );
    });
}

async function addViewableWithToken(viewer, urn, accessToken, xform, offset) {
    return new Promise((resolve, reject) => {
        // Troca o token antes de carregar o modelo
        Autodesk.Viewing.endpoint.HTTP_REQUEST_HEADERS = {
            Authorization: `Bearer ${accessToken}`
        };

        Autodesk.Viewing.Document.load(
            "urn:" + urn,
            (doc) => {
                const viewable = doc.getRoot().getDefaultGeometry();
                const options = {
                    keepCurrentModels: true
                };
                if (xform) options.placementTransform = xform;
                if (offset) options.globalOffset = offset;

                viewer
                    .loadDocumentNode(doc, viewable, options)
                    .then(model => {
                        resolve(model);
                    })
                    .catch(reject);
            },
            (error) => {
                reject(`Erro ao carregar documento ${urn}: ${error}`);
            }
        );
    });
}

