import { initViewer, loadModel, getMyAccesToken, loadModelNoOptions } from './viewer.js';

initViewer(document.getElementById('preview')).then(viewer => {
    const urn = window.location.hash?.substring(1);
    setupModelSelection(viewer, urn);
    setupModelUpload(viewer);
    setupCompositeControls(viewer);
});

let refGlobalOffset = null;
let refModelData
let compositeDesigns = [];
let currentCompositeModels = new Set();


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
            // onModelSelected(viewer, dropdown.value);
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
                // const accessToken = await getMyAccesToken();
                // if (!accessToken) {
                //     throw new Error('Could not obtain access token');
                // }

                // const loadOptions = {
                //     globalOffset: { x: 0, y: 0, z: 0 },
                //     placementTransform: new THREE.Matrix4(),
                //     applyRefPoint: true,
                //     keepCurrentModels: true
                // };

                // let model = await loadModel(viewer, urn, loadOptions);
                // const modelData = model.getData();
                // refModelData = model.getData();
                // const rawOffset = refModelData.globalOffset;
                // refGlobalOffset = new THREE.Vector3(rawOffset.x, rawOffset.y, rawOffset.z);

                // const correction = calculateOptimalAlignment(refModelData, modelData);
                // loadOptions.placementTransform = correction.matrix;
                // loadOptions.globalOffset = correction.offset;
                // viewer.unloadModel(model);
                // model = await loadModel(viewer, urn, loadOptions);

                // debugModelInfo(model, 'modelo base carregado');
                
                loadedUrns = new Map();
                loadedUrns.set(urn, model);
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



async function loadAndAlignModel(urn, viewer) {
    // 1. First load the model with default settings to get its raw data
    const initialLoadOptions = {
        globalOffset: { x: 0, y: 0, z: 0 },
        placementTransform: new THREE.Matrix4(),
        applyRefPoint: true,
        keepCurrentModels: true
    };

    const accessToken = await getMyAccesToken();
    if (!accessToken) {
        throw new Error('Could not obtain access token');
    }

    const isFirstModel = loadedUrns.size === 0;
    const isReferenceModel = isFirstModel;
    let model = null;

    if(isFirstModel) {
        model = await loadModelNoOptions(viewer, urn);
        
    }else{
        model = await addViewableWithToken(viewer, urn, accessToken.access_token, null, null);
    }
    
    const modelData = model.getData();
    
    // 2. Analyze all available transformation data
    const transformAnalysis = {
        hasGlobalOffset: !!modelData.globalOffset,
        hasPlacementWithOffset: !!modelData.placementWithOffset,
        hasRefPointTransform: !!modelData.refPointTransform,
        bbox: modelData.bbox
    };
    
    console.log(`Transform analysis for ${urn}:`, transformAnalysis);

    // 3. Determine the optimal loading strategy
    let finalLoadOptions = { ...initialLoadOptions };
    
    if (isReferenceModel) {
        // For reference model, store its data and load as-is
        refModelData = modelData;
        refGlobalOffset = modelData.globalOffset;
        finalLoadOptions.globalOffset = refGlobalOffset;
        // loadedUrns.set(urn, model);
        // return model;
    }
    else if (modelData.refPointTransform && refModelData?.refPointTransform) {
        // Case 1: Use refPointTransform if available in both models
        const refMatrix = new THREE.Matrix4().fromArray(refModelData.refPointTransform);
        const modelMatrix = new THREE.Matrix4().fromArray(modelData.refPointTransform);
        const correctionMatrix = new THREE.Matrix4()
            .copy(modelMatrix)
            .invert()
            .multiply(refMatrix);
        
        finalLoadOptions.placementTransform = correctionMatrix;
        finalLoadOptions.globalOffset = refModelData.globalOffset;
    }
    else if (modelData.placementWithOffset) {
        // Case 2: Use placementWithOffset if available
        finalLoadOptions.placementTransform = new THREE.Matrix4()
            .fromArray(modelData.placementWithOffset.elements);
    }
    else if (modelData.globalOffset) {
        // Case 3: Use globalOffset as last resort
        finalLoadOptions.globalOffset = modelData.globalOffset;
    }

    if (!isReferenceModel) {
        finalLoadOptions.globalOffset = refGlobalOffset;
    }

    viewer.unloadModel(model);
    const lastModelloaded = await addViewableWithToken(
            viewer,
            urn,
            accessToken.access_token,
            finalLoadOptions.placementTransform,
            finalLoadOptions.globalOffset
        );

    loadedUrns.set(urn, lastModelloaded);
    // 4. Reload the model with proper transforms if needed
    if (hasTransformChanged(initialLoadOptions, finalLoadOptions)) {
        return 
    }else{
        return await addViewableWithToken(
            viewer,
            urn,
            accessToken.access_token,
            finalLoadOptions.placementTransform,
            finalLoadOptions.globalOffset
        );
    }
}

function hasTransformChanged(initial, final) {
    return (
        !initial.placementTransform.equals(final.placementTransform) ||
        initial.globalOffset.x !== final.globalOffset.x ||
        initial.globalOffset.y !== final.globalOffset.y ||
        initial.globalOffset.z !== final.globalOffset.z
    );
}

async function loadUrnToViewer(urn, viewer){
    try {
        showNotification(`Loading model ${urn}...`);
        
        const accessToken = await getMyAccesToken();
        if (!accessToken) {
            throw new Error('Could not obtain access token');
        }

        const isFirstModel = loadedUrns.size === 0;
        let loadedCleanModel = null;

        if(isFirstModel) {
            loadedCleanModel = await loadModelNoOptions(viewer, urn);
        }else{
            loadedCleanModel = await addViewableWithToken(viewer, urn, accessToken.access_token, null, null);
        }

        const modelData = loadedCleanModel.getData();

        const loadOptions = {
            globalOffset: modelData.globalOffset,//  { x: 0, y: 0, z: 0 },
            // placementTransform: modelData.placementWithOffset,
            placementTransform: new THREE.Matrix4(),
            applyRefPoint: true,
            keepCurrentModels: true
        };

        if (isFirstModel) {
            refModelData = modelData; // model.getData();
            const rawOffset = modelData.globalOffset;
            refGlobalOffset = new THREE.Vector3(rawOffset.x, rawOffset.y, rawOffset.z);
        }
        
        if (!isFirstModel && refModelData) {// || true) {
            try {
                loadOptions.globalOffset = refGlobalOffset;
                loadOptions.placementTransform = new THREE.Matrix4();
            } catch (err) {
                console.warn('Alignment calculation failed, using default position:', err);
            }
        }
        console.log('loadOptions', loadOptions);
        viewer.unloadModel(loadedCleanModel);

        const model = await addViewableWithToken(
            viewer,
            urn,
            accessToken.access_token,
            loadOptions.placementTransform,
            loadOptions.globalOffset
        );

        loadedUrns.set(urn, model);
        clearNotification();
    } catch (err) {
        console.error(`Error loading model ${urn}:`, err);
        event.target.checked = false; // Uncheck the box
        alert(`Failed to load model: ${err.message}`);
    }
}

function updateSidebarModelList(models, selectedUrn, viewer) {
    const listContainer = document.getElementById('model-list');
    models.sort((a, b) => a.name.localeCompare(b.name));

    listContainer.innerHTML = models.map(model => `
        <div>
            <label class="checkbox-label" data-urn="${model.urn}">
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
                    loadUrnToViewer(urn, viewer);
                    // loadAndAlignModel(urn, viewer);
                }
            } else {
                // viewer.impl.modelQueue().getModels().forEach(m => console.log(m));

                const model = loadedUrns.get(urn);
                if (model) {
                    try {
                        viewer.unloadModel(model);
                        loadedUrns.delete(urn);
                        console.log(`Successfully unloaded ${urn}`);
                        // logLoadedModels(viewer); // Debug helper
                    } catch (err) {
                        console.error(`Failed to unload ${urn}:`, err);
                    }
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





// ==========================================================================================
// inserindo functions para buscar agregados

async function createCompositeDesign(name, primaryUrn, secondaryUrns) {
    showNotification(`Creating composite design "${name}"...`);
    
    try {
        const response = await fetch('/api/composite-designs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                primaryUrn,
                secondaryUrns: Array.from(secondaryUrns)
            })
        });
        
        if (!response.ok) {
            throw new Error(await response.text());
        }
        
        const result = await response.json();
        compositeDesigns.push(result);
        renderCompositeDesigns();
        clearNotification();
        return result;
    } catch (err) {
        console.error('Error creating composite:', err);
        alert(`Failed to create composite: ${err.message}`);
        clearNotification();
        throw err;
    }
}

// composite list
function renderCompositeDesigns() {
    const container = document.getElementById('composite-list');
    container.innerHTML = '';
    
    compositeDesigns.forEach(design => {
        const item = document.createElement('div');
        item.className = 'composite-item';
        item.innerHTML = `
            <span>${design.name}</span>
            <button class="load-composite" data-design-id="${design.id}">Load</button>
        `;
        container.appendChild(item);
    });
}

// composite design - esta sendo chamada no renderCompositeDesigns
async function loadCompositeDesign(viewer, design) {
    try {
        // Clear existing models first
        if(loadedUrns.size > 0) {
            for (const model of loadedUrns.values()) {
                viewer.unloadModel(model);
            }
            loadedUrns.clear();
        }
        // viewer.unloadAllModels();
        
        // Load primary model
        // Load primary model
        const primaryModel = await loadModel(viewer, design.primaryUrn);

        const accessToken = await getMyAccesToken();
        if (!accessToken) {
            throw new Error('Could not obtain access token');
        }
        
        // Parallel load all secondary models
        await Promise.all(design.secondaryModels.map(async (secondary) => {
            const matrix = new THREE.Matrix4();
            matrix.fromArray(secondary.matrix);

            const added_model = await addViewableWithToken(
                viewer,
                secondary.urn,
                accessToken.access_token,
                matrix,
                secondary.offset,
            )

            // const model = await loadModel(viewer, secondary.urn);

            // const matrix = new THREE.Matrix4();
            // matrix.fromArray(secondary.matrix);
            // model.setPlacementTransform(matrix);

            // if (secondary.offset) {
            //     model.resetGlobalOffset();
            //     model.setGlobalOffset(secondary.offset);
            // }
            
            // Force visibility
            viewer.showAll();
        }));
        
        // Double-check visibility
        viewer.isolate([]); // Hide all
        viewer.showAll(); // Show all
        viewer.fitToView();
    } catch (error) {
        console.error('Failed to load composite design:', error);
        alert('Failed to load composite design. Check console for details.');
    }
}

function setupCompositeControls(viewer) {
    const compositeSection = document.getElementById('composite-section');
    const createBtn = document.getElementById('create-composite');
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'c' && e.ctrlKey) {
            compositeSection.style.display = compositeSection.style.display === 'none' ? 'block' : 'none';
        }
    });
    
    createBtn.addEventListener('click', async () => {
        const name = document.getElementById('composite-name').value.trim();
        if (!name) {
            alert('Please enter a name for the composite design');
            return;
        }
        
        if (loadedUrns.size < 2) {
            alert('You need at least 2 models loaded to create a composite');
            return;
        }
        
        const urns = Array.from(loadedUrns.keys());
        const primaryUrn = urns[0]; // First loaded model is primary
        const secondaryUrns = urns.slice(1);
        
        const secondaryModels = [];
        for (const urn of secondaryUrns) {
            const model = loadedUrns.get(urn);
            const data = model.getData();
            
            secondaryModels.push({
                urn,
                matrix: data.placementWithOffset.elements,
                offset: data.globalOffset
            });
        }
        
        await createCompositeDesign(name, primaryUrn, secondaryModels);
    });
    
    fetch('/api/composite-designs')
        .then(res => res.json())
        .then(designs => {
            compositeDesigns = designs;
            renderCompositeDesigns();
        })
        .catch(console.error);



    document.getElementById('composite-list').addEventListener('click', async (e) => {
        if (e.target.classList.contains('load-composite')) {
            const designId = e.target.dataset.designId;
            const design = compositeDesigns.find(d => d.id === designId);
            
            if (design) {
                await loadCompositeDesign(viewer, design);
            }
        }
    });    
}

