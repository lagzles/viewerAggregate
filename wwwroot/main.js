import { initViewer, loadModel, getMyAccesToken } from './viewer.js';

initViewer(document.getElementById('preview')).then(viewer => {
    const urn = window.location.hash?.substring(1);
    setupModelSelection(viewer, urn);
    setupModelUpload(viewer);
});

let refGlobalOffset = null;
let refModelData


async function setupModelSelection(viewer, selectedUrn) {
    const dropdown = document.getElementById('models');
    dropdown.innerHTML = '';
    try {
        const resp = await fetch('/api/models');
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        let models = await resp.json();
        models.sort((a, b) => a.name.localeCompare(b.name));

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
                // loadModel(viewer, urn);

                const model = await loadModel(viewer, urn);
                debugModelInfo(model, 'modelo base carregado');
                refModelData = model.getData();
                const rawOffset = model.getData().globalOffset;
                refGlobalOffset = new THREE.Vector3(rawOffset.x, rawOffset.y, rawOffset.z);
                console.log(`refGlobalOffset ${refGlobalOffset.x}, ${refGlobalOffset.y}, ${refGlobalOffset.z}`);
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

function debugModelInfo(model, label = 'Modelo') {
    const data = model.getData();

    console.log(`\n===== DEBUG ${label} =====`);

    // Global Offset
    console.log('Global Offset:', data.globalOffset);

    // Placement With Offset
    if (data.placementWithOffset) {
        const placementMatrix = new THREE.Matrix4().fromArray(data.placementWithOffset.elements);
        console.log('Placement With Offset Matrix:');
        console.log(placementMatrix);
    } else {
        console.log('Placement With Offset: undefined');
    }

    // Ref Point Transform
    if (data.refPointTransform) {
        const refPointMatrix = new THREE.Matrix4().fromArray(data.refPointTransform.elements);
        console.log('Reference Point Transform Matrix:');
        console.log(refPointMatrix);
    } else {
        console.log('Reference Point Transform: undefined');
    }

    // Model Bounding Box
    if (data.modelSpaceBBox) {
        console.log('Model Space Bounding Box:');
        console.log('  Min:', data.modelSpaceBBox.min);
        console.log('  Max:', data.modelSpaceBBox.max);
    } else {
        console.log('Model Space Bounding Box: undefined');
    }

    console.log('===== END DEBUG =====\n');
}

// After loading all models
function alignAllModels(viewer, models) {
    if (models.length < 2) return;
    
    const refModel = models[0];
    const refBbox = refModel.getFragmentList().getWorldBoundingBox();
    
    for (let i = 1; i < models.length; i++) {
        const model = models[i];
        const bbox = model.getFragmentList().getWorldBoundingBox();
        
        const dx = refBbox.min.x - bbox.min.x;
        const dy = refBbox.min.y - bbox.min.y;
        const dz = refBbox.min.z - bbox.min.z;
        
        const fragments = model.getFragmentList();
        const fragCount = fragments.fragments.fragId2dbId.length;
        
        for (let fragId = 0; fragId < fragCount; fragId++) {
            fragments.updateFragmentTransform(fragId, 
                new THREE.Matrix4().makeTranslation(dx, dy, dz));
        }
        
        model.getFragmentList().updateAnimTransform();
    }
}

function calculateSimpleTranslationCorrection(refModelData, modelData) {
    const refElements = refModelData.refPointTransform.elements;
    const modelElements = modelData.refPointTransform.elements;

    const deltaX = refElements[12] - modelElements[12];
    const deltaY = refElements[13] - modelElements[13];
    const deltaZ = refElements[14] - modelElements[14];

    return new THREE.Matrix4().makeTranslation(deltaX, deltaY, deltaZ);
}



// Get model metadata without loading the full model
async function getModelMetadata2(urn, token) {
    return new Promise((resolve, reject) => {
        Autodesk.Viewing.endpoint.HTTP_REQUEST_HEADERS = {
            Authorization: `Bearer ${token}`
        };
        
        Autodesk.Viewing.Document.load(
            "urn:" + urn,
            (doc) => {
                const metadata = {
                    name: doc.getRoot().name,
                    refPointTransform: doc.getRoot().getDefaultGeometry().refPointTransform,
                    globalOffset: doc.getRoot().getDefaultGeometry().globalOffset
                };
                resolve(metadata);
            },
            (error) => reject(error)
        );
    });
}

async function getModelMetadata(urn, token) {
    return new Promise((resolve, reject) => {
        Autodesk.Viewing.endpoint.HTTP_REQUEST_HEADERS = {
            Authorization: `Bearer ${token}`
        };

        Autodesk.Viewing.Document.load(
            "urn:" + urn,
            (doc) => {
                const geometry = doc.getRoot().getDefaultGeometry();
                const metadata = {
                    name: doc.getRoot().name,
                    refPointTransform: geometry.refPointTransform,
                    globalOffset: geometry.globalOffset,
                    modelSpaceBBox: geometry.boundingBox 
                };
                resolve(metadata);
            },
            (error) => reject(error)
        );
    });
}


function calculateOptimalAlignment(refData, modelData) {
    // First try using Revit's reference points if available
    if (refData?.refPointTransform && modelData?.refPointTransform) {
        try {
            const refMatrix = new THREE.Matrix4().fromArray(refData.refPointTransform.elements);
            const modelMatrix = new THREE.Matrix4().fromArray(modelData.refPointTransform.elements);
            
            const correctionMatrix = new THREE.Matrix4()
                .copy(modelMatrix)
                .invert()
                .multiply(refMatrix);
                
            return {
                matrix: correctionMatrix,
                offset: { x: 0, y: 0, z: 0 }
            };
        } catch (err) {
            console.warn('Failed to use refPointTransform, falling back to bounding box:', err);
        }
    }
    
    // Fallback to bounding box alignment
    return calculateBoundingBoxAlignment(refData, modelData);
}

function calculateBoundingBoxAlignment(refData, modelData) {
    // Default safe values if bounding boxes are missing
    const defaultBbox = {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 }
    };
    
    // Safely get bounding boxes with fallbacks
    const refBbox = refData?.modelSpaceBBox || defaultBbox;
    const modelBbox = modelData?.modelSpaceBBox || defaultBbox;
    
    // Calculate centroids safely
    const refCenter = new THREE.Vector3(
        (refBbox.min.x + refBbox.max.x) / 2,
        (refBbox.min.y + refBbox.max.y) / 2,
        (refBbox.min.z + refBbox.max.z) / 2
    );
    
    const modelCenter = new THREE.Vector3(
        (modelBbox.min.x + modelBbox.max.x) / 2,
        (modelBbox.min.y + modelBbox.max.y) / 2,
        (modelBbox.min.z + modelBbox.max.z) / 2
    );
    
    const translation = new THREE.Vector3()
        .subVectors(refCenter, modelCenter);
    
    return {
        matrix: new THREE.Matrix4().makeTranslation(
            translation.x,
            translation.y,
            translation.z
        ),
        offset: { x: 0, y: 0, z: 0 }
    };
}




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
                        showNotification(`Loading model ${urn}...`);
                        
                        const accessToken = await getMyAccesToken();
                        if (!accessToken) {
                            throw new Error('Could not obtain access token');
                        }
        
                        const isFirstModel = loadedUrns.size === 0;
                        const loadOptions = {
                            globalOffset: { x: 0, y: 0, z: 0 },
                            placementTransform: new THREE.Matrix4(),
                            applyRefPoint: true,
                            keepCurrentModels: true
                        };
        
                        if (!isFirstModel && refModelData) {
                            try {
                                const modelData = await getModelMetadata(urn, accessToken.access_token);
                                const correction = calculateOptimalAlignment(refModelData, modelData);
                                loadOptions.placementTransform = correction.matrix;
                                loadOptions.globalOffset = correction.offset;
                            } catch (err) {
                                console.warn('Alignment calculation failed, using default position:', err);
                            }
                        }
        
                        const model = await addViewableWithToken(
                            viewer,
                            urn,
                            accessToken.access_token,
                            loadOptions.placementTransform,
                            loadOptions.globalOffset
                        );
        
                        if (isFirstModel) {
                            refModelData = model.getData();
                            const rawOffset = refModelData.globalOffset;
                            refGlobalOffset = new THREE.Vector3(rawOffset.x, rawOffset.y, rawOffset.z);
                        }
        
                        loadedUrns.set(urn, model);
                        clearNotification();
                    } catch (err) {
                        console.error(`Error loading model ${urn}:`, err);
                        event.target.checked = false; // Uncheck the box
                        alert(`Failed to load model: ${err.message}`);
                    }
                }
            } else {
                const model = loadedUrns.get(urn);
                if (model) {
                    viewer.unloadModel(model);
                    loadedUrns.delete(urn);
                    console.log(`Unloaded model ${urn}`);
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

